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
const Moment = require('moment');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const A8ProgramModel = require(appRoot + '/models/a8_program');
const BookModel = require(appRoot + '/models/book');
const GameModel = require(appRoot + '/models/game');

const DAYS_EXPIRE_TWEET = 7;
const HOURS_EXPIRE_TWEET = DAYS_EXPIRE_TWEET * 24;

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

exports.tweetJSONIntoInsertObject = (tweet, productId) => {
  return {
    tweetId: tweet['id_str'],
    retweetTargetId: tweet['retweeted_status'] ? tweet['retweeted_status']['id_str'] : null,
    productId: productId,
    userId: tweet['user']['id'],
    name: tweet['user']['name'],
    screenName: tweet['user']['screen_name'],
    followersCount: tweet['user']['followers_count'],
    followCount: tweet['user']['friends_count'] || 0,
    tweetCount: tweet['user']['statuses_count'] || 0,
    source: tweet['source'],
    favouriteCount: tweet['favorite_count'] || 0,
    text: tweet['text'],
    isInvalid: 0,
    tweetedAt: Util.convertDateObjectIntoMySqlReadableString(new Date(tweet['created_at'])),
  };
}

exports.selectProductModels = (productTypeIds) => {
  var d = Q.defer();

  Q.allSettled([
    BookModel.selectByProductTypeIds(productTypeIds, {
      excludeUndefinedReleaseDate: true,
    }),
    GameModel.selectByProductTypeIds(productTypeIds, {
      excludeUndefinedReleaseDate: true,
    }),
    A8ProgramModel.selectByProductTypeIds(productTypeIds, {
      ignoreChildProgram: true,
    }),
  ]).then(function (results) {
    var bookModels = results[0].value;
    var gameModels = results[1].value;
    var a8ProgramModels = results[2].value;
    var productModels = _.flatten([bookModels, gameModels, a8ProgramModels]);

    d.resolve(productModels);
  });

  return d.promise;
}

exports.insertAltWordIfNeedForNewBook = async (productId, title) => {
  if (!title.match(/[\(\（]\d+[\)\）]/)) return;
  if (!productId || !title) return;
  var twitterAltSearchWordModels = await TwitterAlternativeSearchWord.findAll({
    where: {
      productId: productId,
    },
  });

  if (!_.isEmpty(twitterAltSearchWordModels)) return;

  var trimmedTitle = title.replace(/[\(\（]\d+[\)\）]/g, '').trim();
  var twitterAltSearchWordModel = await TwitterAlternativeSearchWord.create({
    productId: productId,
    searchWord: trimmedTitle,
  });

  return;
}

exports.calcBuzzByTweetModels = function (tweetModels, baseMoment) {
  var totalBuzz = 0;

  var targetTweetModels = _.chain(tweetModels)
    .sortBy(tweetModel => {
      return -1 * new Moment(tweetModel.tweetedAt).unix();
    })
    .uniq(tweetModel => {
      return tweetModel.screenName;
    })
    .value();

  _.each(targetTweetModels, tweetModel => {
    var compareMoment = new Moment(tweetModel.tweetedAt);
    var diffHours = Math.floor((baseMoment - compareMoment) / (60 * 60 * 1000));
    var buzz = (1 / HOURS_EXPIRE_TWEET) * Math.max(HOURS_EXPIRE_TWEET - diffHours, 0);

    totalBuzz += buzz;
  });

  return Math.floor(totalBuzz);
}
