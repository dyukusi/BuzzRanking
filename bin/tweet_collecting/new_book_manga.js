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

const BookModel = require(appRoot + '/models/book');
const TweetModel = require(appRoot + '/models/tweet');

var RANGE_DAYS_AGO = 7;

var queue = [];
var productRangeDays = 7;

if (!process.argv[2]) {
  console.log('pls specify base date.   ex... node hoge.js 2019-04-28')
  return;
}

var baseDate = new Date(process.argv[2]);

// forAPITesting();
initQueue()
  .then(function () {
    console.log('task initialization completed');
    main();
  });

function initQueue() {
  var d = Q.defer();

  BookModel.selectAllNewProducts(baseDate, productRangeDays)
    .then(function (bookModels) {
      console.log(bookModels.length + ' products found.');

      var tempDate = new Date(baseDate);
      var thresholdDate = new Date(new Date(tempDate.setDate(tempDate.getDate() - RANGE_DAYS_AGO)).toDateString());

      _.each(bookModels, function (bookModel) {
        queue.push({
          api_param: {
            q: sprintf(
              '%s since:%s until:%s source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
              bookModel.getTitle(),
              thresholdDate.toLocaleDateString(),
              baseDate.toLocaleDateString(),
            ),
            lang: 'ja',
            locale: 'ja',
            count: 100,
            result_type: 'recent',
            max_id: '',
          },
          product_id: bookModel.getProductId(),
          product_type: bookModel.getProductTypeId(),
        });
      });

      d.resolve();
    });

  return d.promise;
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
          var metaData = json['search_metadata'];
          var tweets = json['statuses'];
          var insertObjects = _.map(tweets, function (tweet) {
            return BatchUtil.tweetJSONIntoInsertObject(tweet, task.product_type, task.product_id);
          });

          if (!insertObjects.length) {
            console.log("Tweets not found. skip this task.");
            main();
            return;
          }

          console.log('Tweet count: ' + insertObjects.length);

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
                  queue.push({
                    api_param: QueryString.parse(metaData['next_results']),
                    product_id: task.product_id,
                    product_type: task.product_type,
                  });
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

function forAPITesting() {
  BatchUtil.searchTweets({
    q: '"進撃の巨人" since:2019-04-27 until:2019-04-28 source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',

    // 'OR "ハッピーメール" source:Twitter_for_Android -filter:links -filter:hashtags',

    lang: 'ja',
    locale: 'ja',
    count: 100,
    result_type: 'recent',
    max_id: '',
  })
    .then(tweets => {
      fs.writeFile('out.json', JSON.stringify(tweets), function (e, data) {
        if (e) console.log(e);
        else console.log("finished");
      });
    })
    .fail(e => {
      console.log(e);
    });
}
