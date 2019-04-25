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

const RakutenBookModel = require(appRoot + '/models/rakuten_book');
const TweetModel = require(appRoot + '/models/tweet');

var c = Config.twitter_api;
var twitterAPIKeyParams = {
  consumer_key: c.consumer_key,
  consumer_secret: c.consumer_secret,
  access_token_key: c.access_token_key,
  access_token_secret: c.access_token_secret,
};

var queue = [];

// forAPITesting();
initQueue()
  .then(function () {
    console.log('task initialization completed');
    main();
  });

function initQueue() {
  var d = Q.defer();

  RakutenBookModel.selectAllNewProducts()
    .then(function (models) {
      console.log(models.length + ' products found.');
      _.each(models, function (model) {
        queue.push({
          api_param: {
            q: model.getTitle(),
            lang: 'ja',
            locale: 'ja',
            count: 100,
            result_type: 'recent',
            max_id: '',
          },
          product_id: model.getId(),
          product_type: RakutenBookModel.getProductType(),
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

      gatherTweets(param)
        .then(function (json) {
          var metaData = json['search_metadata'];
          var tweets = json['statuses'];
          var insertObjects = _.map(tweets, function (tweet) {
            return {
              tweet_id: tweet['id_str'],
              retweet_target_id: tweet['retweeted_status'] ? tweet['retweeted_status']['id_str'] : null,
              product_type: task.product_type,
              product_id: task.product_id,
              user_id: tweet['user']['id'],
              name: tweet['user']['name'],
              screen_name: tweet['user']['screen_name'],
              followers_count: tweet['user']['followers_count'],
              follow_count: tweet['user']['friends_count'] || 0,
              tweet_count: tweet['user']['statuses_count'] || 0,
              source: tweet['source'],
              favourite_count: tweet['favorite_count'] || 0,
              text: tweet['text'],
              tweeted_at: new Date(tweet['created_at']).toLocaleString(),
            };
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
                var oneWeekAgoDate = new Date(new Date(new Date().setDate(new Date().getDate() - 7)).toDateString());
                var shouldSearchNext = _.every(insertObjects, function (obj) {
                  var tweetedAtDate = new Date(obj.tweeted_at);
                  return tweetedAtDate - oneWeekAgoDate >= 0;
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

function gatherTweets(param) {
  var d = Q.defer();

  var client = new Twitter(twitterAPIKeyParams);

  client.get('search/tweets', param, function (e, tweets, response) {
    if (e) {
      d.reject(e);
      return;
    }

    d.resolve(tweets);
  });

  return d.promise;
}

function forAPITesting() {
  gatherTweets({
    q: '獄丁ヒグマ 1',
    lang: 'ja',
    locale: 'ja',
    count: 100,
    result_type: 'recent',
    max_id: '',
  })
    .then(tweets => {
      console.log(tweets);
    })
    .fail(e => {
      console.log(e);
    });
}
