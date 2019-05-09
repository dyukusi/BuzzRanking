const appRoot = require('app-root-path');
const Config = require('config');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const QueryString = require('query-string');
const Twitter = require('twitter');
const sprintf = require('sprintf-js').sprintf;
const BatchUtil = require(appRoot + '/my_libs/batch_util.js');
const async = require('async');

const TweetModel = require(appRoot + '/models/tweet');
const A8ProgramModel = require(appRoot + '/models/a8_program');
const A8ProgramModelTwitterSearchWord = require(appRoot + '/models/a8_program_twitter_search_word');

var queue = [];
var RANGE_DAYS_AGO = 7;
var DATING_PRODUCT_TYPE = 2;
var TWITTER_SEARCH_OPTIONS = '-filter:links source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App';

if (!process.argv[2]) {
  console.log('pls specify base date.   ex... node hoge.js 2019-04-28')
  return;
}

var baseDate = new Date(process.argv[2]);
var tempDate = new Date(baseDate);
var thresholdDate = new Date(new Date(tempDate.setDate(tempDate.getDate() - RANGE_DAYS_AGO)).toDateString());

initQueue()
  .then(() => {
    console.log("initialization process finished");
    // queue = [createTask(11, 'YYC')];
    main();
  });

function initQueue() {
  var d = Q.defer();

  async.waterfall([
      (callback) => {
        A8ProgramModel.selectByProductTypeId(DATING_PRODUCT_TYPE)
          .then(a8ProgramModels => {
            var targetA8ProductIds = _.map(a8ProgramModels, m => {
              return m.getProductId();
            });
            callback(null, targetA8ProductIds);
          });
      },
      (targetA8ProductIds, callback) => {
        A8ProgramModelTwitterSearchWord.selectByA8ProgramLocalIds(targetA8ProductIds)
          .then(models => {
            callback(null, models);
          });
      },
      (searchWordModels, callback) => {
        _.each(searchWordModels, m => {
          queue.push(
            createTask(m.getProductId(), m.getSearchWord())
          );
        });
        callback(null);
      }],
    (err) => {
      if (err) {
        throw new Error(err);
      }
      d.resolve();
    });

  return d.promise;
}

function createTask(a8ProgramLocalId, searchWord) {
  return {
    api_param: {
      q: sprintf(
        '"%s" since:%s until:%s %s',
        searchWord,
        thresholdDate.toLocaleDateString(),
        baseDate.toLocaleDateString(),
        TWITTER_SEARCH_OPTIONS
      ),
      lang: 'ja',
      locale: 'ja',
      count: 100,
      result_type: 'recent',
      max_id: '',
    },
    product_id: a8ProgramLocalId,
    product_type: DATING_PRODUCT_TYPE,
    search_word: searchWord,
  };
}

function main() {
  setTimeout(function () {
    var task = queue.pop();
    var param = task.api_param;

    if (!task) {
      console.log('task not found');
      main();
      return;
    } else {
      console.log('■ Processing... ' + task.api_param.q + ' Queue: ' + queue.length);

      BatchUtil.searchTweets(param)
        .then(function (json) {
          var excludedTweetCount = 0;
          var metaData = json['search_metadata'];
          var tweets = json['statuses'];
          var insertObjects = _.chain(tweets)
            .filter(tweet => {
              var searchWord = task.search_word;
              var text = tweet['text'];
              var regExp = new RegExp('@\\w*\\s');
              var modifiedText = text.replace(regExp, '');
              var hasTargetWord = modifiedText.indexOf(searchWord) == -1 ? false : true;
              if (!hasTargetWord) {
                excludedTweetCount++;
              }

              return hasTargetWord;
            })
            .map(tweet => {
              return BatchUtil.tweetJSONIntoInsertObject(tweet, task.product_type, task.product_id);
            })
            .value();

          if (!tweets.length) {
            console.log("Tweets not found. skip this task.");
            main();
            return;
          }

          console.log('Tweet count: ' + insertObjects.length);
          console.log('Excluded tweet count: ' + excludedTweetCount);


          TweetModel.insert(insertObjects)
            .then(function () {
              if (tweets.length >= task.api_param.count && metaData['next_results']) {
                var thresholdDate = new Date(new Date(baseDate.setDate(baseDate.getDate() - RANGE_DAYS_AGO)).toDateString());
                var shouldSearchNext = _.every(insertObjects, function (obj) {
                  var tweetedAtDate = new Date(obj.tweeted_at);
                  return tweetedAtDate - thresholdDate >= 0;
                });

                if (shouldSearchNext) {
                  console.log("should search for next page. added to queue.");
                  var newTask = createTask(task.product_id, task.search_word);

                  newTask.api_param = QueryString.parse(metaData['next_results']);
                  queue.push(newTask);
                } else {
                  console.log("skipped next page because they are expired(1week)");
                }
              }
              main();
            })
            .fail(function (e) {
              console.log(e);
              queue.push(task);
              console.log("waiting 10secs...");
              setTimeout(function () {
                main();
              }, 10000);
            });
        });

    }
  }, 6000);
}
