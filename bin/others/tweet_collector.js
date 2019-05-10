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
const con = require(appRoot + '/my_libs/db.js');

const TweetModel = require(appRoot + '/models/tweet');
const A8ProgramModel = require(appRoot + '/models/a8_program');
const BookModel = require(appRoot + '/models/book');
const TwitterAlternativeSearchWordModel = require(appRoot + '/models/twitter_alternative_search_word');

var isNeedToSpecifyReleaseDatePeriodProductTypeIds = [
  1, // new manga
];
var STRICT_WORD_SEARCH_PRODUCT_TYPES = [
  2, // dating
];

var TWITTER_COLLECTION_RANGE_DAYS_AGO = 7;
var TWITTER_SEARCH_COMMON_SEARCH_OPTION = '-filter:links source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App';
var productTypeId = Number(process.argv[2]);
var since = process.argv[3] ? new Date(process.argv[3]) : null;
var until = process.argv[4] ? new Date(process.argv[4]) : null;

var isStrictWordSearchMode = _.contains(STRICT_WORD_SEARCH_PRODUCT_TYPES, productTypeId);

process.on('uncaughtException', (err) => {
  throw new Error(err);
  // fs.writeSync(1, `Caught exception: ${err}\n`);
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
});

if (!process.argv[2]) {
  throw new Error('pls specify args correctly.   ex... node hoge.js productTypeId 2019-04-28 2019-05-03');
}

if (_.contains(isNeedToSpecifyReleaseDatePeriodProductTypeIds, productTypeId) && !(process.argv[3] && process.argv[4])) {
  throw new Error('must specify product release date period');
}

console.log('productTypeId: ' + productTypeId);

createTaskQueue()
  .then(taskQueue => {
    console.log("initialization process finished");
    collectTweets(taskQueue);
  });

function createTaskQueue() {
  var d = Q.defer();

  async.waterfall([
      (callback) => {
        Q.allSettled([
          TwitterAlternativeSearchWordModel.selectAll(),
          BatchUtil.getProductModels(productTypeId, since, until),
        ]).then(function (results) {
          var twitterAltSearchWordModels = results[0].value;
          var productModelsHash = results[1].value;
          var productIdIntoAltSearchWords = {};

          _.each(twitterAltSearchWordModels, m => {
            var altWords = productIdIntoAltSearchWords[m.getProductId()] || [];
            altWords.push(m.getSearchWord());
            productIdIntoAltSearchWords[m.getProductId()] = altWords;
          });

          callback(null, productIdIntoAltSearchWords, productModelsHash);
        });
      },
      (productIdIntoAltSearchWords, productModelsHash, callback) => {
        var taskQueue = [];

        // Book
        _.each(productModelsHash.bookModels, bookModel => {
          var searchWords = productIdIntoAltSearchWords[bookModel.getProductId()] || [bookModel.getTitle()];
          _.each(searchWords, word => {
            taskQueue.push(createTask(productTypeId, bookModel.getProductId(), word));
          })
        });

        // A8 Program
        _.each(productModelsHash.a8ProgramModels, a8ProgramModel => {
          var searchWords = productIdIntoAltSearchWords[a8ProgramModel.getProductId()];
          if (!searchWords) {
            throw new Error('each A8Program records must have one alternative search word at least. ' + a8ProgramModel.getProgramName());
          }
          _.each(searchWords, word => {
            taskQueue.push(createTask(productTypeId, a8ProgramModel.getProductId(), word));
          })
        });

        callback(null, taskQueue);
      }],
    (err, taskQueue) => {
      if (err) {
        d.reject(err);
      }
      d.resolve(taskQueue);
    });

  return d.promise;
}

function createTask(productTypeId, productId, searchWord) {
  var searchQueryBase = isStrictWordSearchMode ? '"%s" %s' : '%s %s';

  return {
    api_param: {
      q: sprintf(
        searchQueryBase,
        searchWord,
        TWITTER_SEARCH_COMMON_SEARCH_OPTION
      ),
      lang: 'ja',
      locale: 'ja',
      count: 100,
      result_type: 'recent',
      max_id: '',
    },
    product_id: productId,
    product_type: productTypeId,
    search_word: searchWord,
  };
}

function collectTweets(taskQueue) {
  setTimeout(function () {
    var task = taskQueue.pop();
    var param = task ? task.api_param : null;

    if (!task) {
      console.log('task not found');
      console.log('Finished!');
      con.end();
      return;
    } else {
      console.log('■ Processing... ' + task.api_param.q + ' Queue: ' + taskQueue.length);

      BatchUtil.searchTweets(param)
        .then(function (json) {
          var excludedTweetCount = 0;
          var metaData = json['search_metadata'];
          var tweets = json['statuses'];
          var insertObjects = _.chain(tweets)
            .filter(tweet => {
              if (isStrictWordSearchMode) {
                var searchWord = task.search_word;
                var text = tweet['text'];
                var regExp = new RegExp('@\\w*\\s');
                var modifiedText = text.replace(regExp, '');
                var hasTargetWord = modifiedText.indexOf(searchWord) == -1 ? false : true;
                if (!hasTargetWord) {
                  excludedTweetCount++;
                }

                return hasTargetWord;
              } else {
                return true;
              }
            })
            .map(tweet => {
              return BatchUtil.tweetJSONIntoInsertObject(tweet, task.product_type, task.product_id);
            })
            .value();

          if (!tweets.length) {
            console.log("Tweets not found. skip this task.");
            collectTweets(taskQueue);
            return;
          }

          console.log('Tweet count: ' + insertObjects.length);
          console.log('Excluded tweet count: ' + excludedTweetCount);

          TweetModel.insert(insertObjects)
            .then(function () {
              if (tweets.length >= task.api_param.count && metaData['next_results']) {
                var thresholdDate = new Date(new Date().setDate(new Date().getDate() - TWITTER_COLLECTION_RANGE_DAYS_AGO)).toDateString();
                var shouldSearchNext = _.every(insertObjects, function (obj) {
                  var tweetedAtDate = new Date(obj.tweeted_at);
                  return tweetedAtDate - thresholdDate >= 0;
                });

                if (shouldSearchNext) {
                  console.log("should search for next page. added to taskQueue.");
                  var newTask = createTask(task.product_id, task.search_word);

                  newTask.api_param = QueryString.parse(metaData['next_results']);
                  taskQueue.push(newTask);
                } else {
                  console.log("skipped next page because they are expired(1week)");
                }
              }
              collectTweets(taskQueue);
            })
            .fail(function (e) {
              console.log(e);
              taskQueue.push(task);
              console.log("waiting 10secs...");
              setTimeout(function () {
                collectTweets(taskQueue);
              }, 10000);
            });
        });

    }
  }, 6000);
}
