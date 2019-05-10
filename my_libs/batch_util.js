const appRoot = require('app-root-path');
const Config = require('config');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const Twitter = require('twitter');
const sprintf = require('sprintf-js').sprintf;

var twitterAPIKeyParams = {
  consumer_key: Config.twitter_api.consumer_key,
  consumer_secret: Config.twitter_api.consumer_secret,
  access_token_key: Config.twitter_api.access_token_key,
  access_token_secret: Config.twitter_api.access_token_secret,
};

exports.searchTweets = param => {
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

exports.tweetJSONIntoInsertObject = (tweet, productType, productId) => {
  return {
    tweet_id: tweet['id_str'],
    retweet_target_id: tweet['retweeted_status'] ? tweet['retweeted_status']['id_str'] : null,
    product_type: productType,
    product_id: productId,
    user_id: tweet['user']['id'],
    name: tweet['user']['name'],
    screen_name: tweet['user']['screen_name'],
    followers_count: tweet['user']['followers_count'],
    follow_count: tweet['user']['friends_count'] || 0,
    tweet_count: tweet['user']['statuses_count'] || 0,
    source: tweet['source'],
    favourite_count: tweet['favorite_count'] || 0,
    text: tweet['text'],
    tweeted_at: Util.convertDateObjectIntoMySqlDateObjectReadableString(new Date(tweet['created_at'])),
  };
}
