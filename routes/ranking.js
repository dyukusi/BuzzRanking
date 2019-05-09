const express = require('express');
const router = express.Router();
const memoryCache = require('memory-cache');
const ReleaseControlModel = require(appRoot + '/models/release_control.js');
const A8ProgramModel = require(appRoot + '/models/a8_program.js');
const BookModel = require(appRoot + '/models/book');
const StatModel = require(appRoot + '/models/stat.js');
const StatDataModel = require(appRoot + '/models/stat_data.js');
const TweetModel = require(appRoot + '/models/tweet');
const BlockTwitterUserModel = require(appRoot + '/models/block_twitter_user');

router.get('/:product_type_name', function (req, res, next) {
  var productTypeName = req.params.product_type_name;
  var productTypeId = Const.PRODUCT_TYPE_NAME_INTO_ID_HASH[productTypeName];

  if (!productTypeId) {
    return res.send(productTypeName + ' is not defined');
  }

  ReleaseControlModel.selectByProductTypeId(productTypeId)
    .then(releaseControlModel => {
      renderRankingByProductTypeIdAndDate(productTypeId, releaseControlModel.getDateObj(), req, res);
    });
});

module.exports = router;


function renderRankingByProductTypeIdAndDate(productTypeId, targetDate, req, res) {
  var targetRankingHTMLCacheKey = 'html_ranking_' + productTypeId + '_' + targetDate.toDateString().replace(/ /g, '_');
  var targetRankingHTMLCache = memoryCache.get(targetRankingHTMLCacheKey);
  var isAdmin = myUtil.isAdminByReq(req);

  ReleaseControlModel.selectByProductTypeId(productTypeId)
    .then(releaseControlModel => {
      var latestReleaseDate = releaseControlModel.getDateObj();

      // accessing to unreleased page that only admin can see
      if (latestReleaseDate.getTime() < targetDate.getTime()) {
        if (!isAdmin) {
          return res.redirect('/auth');
        }
      }

      // cache hit
      if (targetRankingHTMLCache && !isAdmin) {
        return res.send(targetRankingHTMLCache);
      }
      // cache miss
      else {
        console.log("cache miss: " + targetRankingHTMLCacheKey);
        buildRanking(productTypeId, targetDate)
          .then(result => {
            res.sendResponse = res.send;

            // should not cache if admin
            if (!isAdmin) {
              res.send = (body) => {
                memoryCache.put(targetRankingHTMLCacheKey, body, 60 * 60 * 24 * 1000);
                res.sendResponse(body);
              };
            }

            res.render('ranking', {
              isAdmin: isAdmin,
              targetDate: targetDate,
              latestStatDate: releaseControlModel.getDateObj(),
              ranking: result.ranking,
              statModel: result.statModel,
              productTypeId: productTypeId,
            });
          })
          .fail(e => {
            console.log('Error: ' + e);
            res.render('error', {});
          });
      }
    })
    .fail(e => {
      console.log('Error: ' + e);
      res.render('error', {});
    });

}

function buildRanking(targetProductTypeId, targetDate) {
  var d = Q.defer();

  async.waterfall([
    (callback) => {
      StatModel.selectByProductTypeIdAndDate(targetProductTypeId, targetDate)
        .then(statModel => {
          if (__.isEmpty(statModel)) {
            return callback('ranking not found');
          }

          callback(null, statModel);
        });
    },
    (statModel, callback) => {
      StatDataModel.selectByStatId(statModel.getId())
        .then(statDataModels => {
          callback(null, statModel, statDataModels);
        });
    },
    (statModel, statDataModels, callback) => {
      var top100RankingDataModels = (() => {
        var rank = 1;
        var idx = 1;
        var previousTweetCount = null;
        return __.chain(statDataModels)
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
      })();

      var productIds = __.map(top100RankingDataModels, function (m) {
        return m.getProductId();
      });

      Q.allSettled([
        getProductIdIntoProductInfoHash(targetProductTypeId, productIds),
        TweetModel.selectByProductTypeIdAndProductIds(targetProductTypeId, productIds, {
          excludeRetweet: true,
          since: statModel.getStatSince(),
          until: statModel.getStatUntil(),
        }),
        BlockTwitterUserModel.selectAll(),
      ]).then(function (results) {
        var productIdIntoProductInfoHash = results[0].value;
        var tweetModels = results[1].value;
        var blockTwitterUserModels = results[2].value;

        callback(null, statModel, top100RankingDataModels, productIdIntoProductInfoHash, tweetModels, blockTwitterUserModels);
      });
    },
    (statModel, top100RankingDataModels, productIdIntoProductInfoHash, tweetModels, blockTwitterUserModels, callback) => {
      var productIdToTweetsHash = __.groupBy(tweetModels, function (m) {
        return m.getProductId();
      });

      // build block user hash
      var excludeScreenNameHash = {};
      __.each(blockTwitterUserModels, function (blockTwitterUserModel) {
        excludeScreenNameHash[blockTwitterUserModel.getScreenName()] = true;
      });

      // sort and remove duplicated tweets
      __.each(productIdToTweetsHash, function (tweets, productId) {
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

      var ranking = __.map(top100RankingDataModels, function (statDataModel) {
        var productId = statDataModel.getProductId();
        var productInfo = productIdIntoProductInfoHash[productId];
        var tweetModels = __.first(productIdToTweetsHash[productId], 100);

        return {
          statDataModel: statDataModel,
          tweetModels: tweetModels,
          productInfo: productInfo,
        };
      });

      callback(null, statModel, ranking);
    },
  ], (e, statModel, result) => {
    if (e) {
      throw new Error(e);
      return d.reject(e);
    }

    d.resolve({
      statModel: statModel,
      ranking: result,
    });
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

function getProductIdIntoProductInfoHash(productTypeId, productIds) {
  var d = Q.defer();

  Q.allSettled([
    A8ProgramModel.selectByProductTypeIdAndProductIds(productTypeId, productIds),
    BookModel.selectByProductTypeIdAndProductIds(productTypeId, productIds),
  ]).then(function (results) {
    var a8ProgramModels = results[0].value;
    var bookModels = results[1].value;

    var a8ProgramModelHash = __.indexBy(a8ProgramModels, m => {
      return m.getProductId();
    });
    var bookModelHash = __.indexBy(bookModels, m => {
      return m.getProductId();
    });

    var productIds = __.uniq(
      __.flatten([
        __.map(a8ProgramModels, m => {
          return m.getProductId();
        }),
        __.map(bookModels, m => {
          return m.getProductId();
        }),
      ])
    );

    var result = {};
    __.each(productIds, productId => {
      result[productId] = {
        a8ProgramModel: a8ProgramModelHash[productId],
        bookModel: bookModelHash[productId],
      };
    });

    d.resolve(result);
  });

  return d.promise;
}
