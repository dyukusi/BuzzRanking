var express = require('express');
var router = express.Router();
const memoryCache = require('memory-cache');
const Q = require('q');
const TweetModel = require(appRoot + '/models/tweet');
const BlockTwitterUserModel = require(appRoot + '/models/block_twitter_user');
const ReleaseControlModel = require(appRoot + '/models/release_control.js');
const A8ProgramModel = require(appRoot + '/models/a8_program.js');
const RankingModel = require(appRoot + '/models/ranking.js');

const PRODUCT_TYPE_OF_DATING = 2;

module.exports = router;

router.get('/', (req, res, next) => {
  ReleaseControlModel.selectById('dating')
    .then(releaseControlModel => {
      renderRankingByDate(releaseControlModel.getDateObj(), req, res);
    });
});

function renderRankingByDate(targetDate, req, res) {
  var targetRankingCacheKey = 'ranking_' + targetDate.toDateString().replace(/ /g, '_');
  var targetRankingHTMLCache = memoryCache.get(targetRankingCacheKey);
  var isAdmin = myUtil.isAdminByReq(req);

  ReleaseControlModel.selectById('dating')
    .then(releaseControlModel => {
      // accessing to unreleased page that only admin can see
      if (releaseControlModel.getDateObj().getTime() < targetDate.getTime()) {
        if (!isAdmin) {
          return res.redirect('/auth');
        }
      }

      // cache hit
      if (targetRankingHTMLCache && !isAdmin && false) {
        res.send(targetRankingHTMLCache);
        return;
      }
      // cache miss
      else {
        console.log("cache miss: " + targetRankingCacheKey);
        createRankingByDate(targetDate)
          .then(ranking => {
            res.sendResponse = res.send;

            // should not cache if admin
            if (!isAdmin) {
              res.send = (body) => {
                memoryCache.put(targetRankingCacheKey, body, 60 * 60 * 24 * 1000);
                res.sendResponse(body);
              };
            }

            res.render('ranking', {
              isAdmin: isAdmin,
              targetDate: targetDate,
              latestStatDate: releaseControlModel.getDateObj(),
              productType: PRODUCT_TYPE_OF_DATING,
              ranking: ranking,
            });
          })
          .fail(e => {
            console.log('Error: ' + e);
            res.render('error', {});
          });
      }
    });

}

function createRankingByDate(targetDate) {
  var d = Q.defer();

  async.waterfall([
    (callback) => {
      RankingModel.selectByProductTypeIdAndDate(targetDate, PRODUCT_TYPE_OF_DATING, {ignoreInvalidRecords: true})
        .then(statModels => {
          if (__.isEmpty(statModels)) {
            return callback('ranking not found');
          }

          callback(null, statModels);
        });
    },
    (statModels, callback) => {
      var rank = 1;
      var idx = 1;
      var previousTweetCount = null;
      var top100StatModels = __.chain(statModels)
        .sortBy(m => {
          return -1 * m.getUserCount(); // desc
        })
        .each(m => {
          var userCount = m.getUserCount();

          if (previousTweetCount != userCount) {
            rank = idx;
          }

          previousTweetCount = userCount;
          idx++;

          m.setRank(rank);
        })
        .filter(m => {
          return m.getRank() <= 100;
        })
        .value();

      var productIds = __.map(top100StatModels, function (m) {
        return m.getProductId();
      });

      Q.allSettled([
        TweetModel.selectByProductTypeIdAndProductIds(PRODUCT_TYPE_OF_DATING, productIds, {excludeRetweet: false,}),
        A8ProgramModel.selectByProductTypeIdAndProductIds(PRODUCT_TYPE_OF_DATING, productIds),
        BlockTwitterUserModel.selectAll(),
      ]).then(function (results) {
        var tweetModels = results[0].value;
        var a8ProgramModels = results[1].value;
        var blockTwitterUserModels = results[2].value;

        callback(null, top100StatModels, a8ProgramModels, tweetModels, blockTwitterUserModels);
      });
    },

    (top100StatModels, a8ProgramModels, tweetModels, blockTwitterUserModels, callback) => {
      var productIdToTweetsHash = __.groupBy(tweetModels, function (m) {
        return m.getProductId();
      });

      // build block user hash
      var excludeScreenNameHash = {};
      __.each(blockTwitterUserModels, function (blockTwitterUserModel) {
        excludeScreenNameHash[blockTwitterUserModel.getScreenName()] = true;
      });

      __.each(productIdToTweetsHash, function (tweets, productId) {
        // sorting tweets object by favourite count
        var sortedTweets = sortTweet(tweets, excludeScreenNameHash);

        // exclude duplicate tweets
        var distinctTweets = [];
        var alreadyHasHash = {};
        __.each(sortedTweets, tweetModel => {
          var tweetId = tweetModel.getRetweetTargetId() || tweetModel.getTweetId();
          if (alreadyHasHash[tweetId]) {
            return;
          }

          alreadyHasHash[tweetId] = true;
          distinctTweets.push(tweetModel);
        });

        productIdToTweetsHash[productId] = distinctTweets;
      });

      var productIdToA8ProgramModelHash = __.indexBy(a8ProgramModels, function (m) {
        return m.getId();
      });

      var ranking = __.map(top100StatModels, function (m) {
        var a8ProgramModel = productIdToA8ProgramModelHash[m.getProductId()];

        return {
          rank: m.getRank(),
          tweetCount: m.getTweetCount(),
          userCount: m.getUserCount(),
          tweetModels: __.first(productIdToTweetsHash[m.getProductId()], 100),
          productInfo: {
            a8ProgramModel: a8ProgramModel,
          },
        };
      });

      callback(null, ranking);
    },
  ], (e, rankingObj) => {
    if (e) {
      return d.reject(e);
    }

    d.resolve(rankingObj);
  });


  return d.promise;
}

function sortTweet(tweets, excludeScreenNameHash) {
  var isExcluded = function (tweet) {
    if (excludeScreenNameHash[tweet.getScreenName()]) return true;
    return false;
  };

  return tweets.sort(function (a, b) {
    // excluded tweet
    if (isExcluded(a) && !isExcluded(b)) return 1;
    if (!isExcluded(a) && isExcluded(b)) return -1;

    // RT
    if (a.getRetweetTargetId() && !b.getRetweetTargetId()) return 1;
    if (!a.getRetweetTargetId() && b.getRetweetTargetId()) return -1;

    // favourited count
    return b.getFavouriteCount() - a.getFavouriteCount();
  });
}
