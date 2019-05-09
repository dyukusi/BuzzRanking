var express = require('express');
var router = express.Router();
const Q = require('q');
const DailyBookRankingModel = require(appRoot + '/models/daily_book_ranking.js');
const RakutenBookModel = require(appRoot + '/models/rakuten_book');
const TweetModel = require(appRoot + '/models/tweet');
const BlockTwitterUserModel = require(appRoot + '/models/block_twitter_user');
const BookCaptionModel = require(appRoot + '/models/book_caption.js');
const ReleaseControlModel = require(appRoot + '/models/release_control.js');
const memoryCache = require('memory-cache');

const PRODUCT_TYPE_OF_NEW_BOOK_MANGA = 1;

/* TODO
・コンテンツの追加

・過去ランキングへの導線
　・1ヶ月以上前のものはツイートは破棄して、ランキングだけ表示する
 */

module.exports = router;

router.get('/', (req, res, next) => {
  ReleaseControlModel.selectById('new_book_manga')
    .then(releaseControlModel => {
      renderRankingByDate(releaseControlModel.getDateObj(), req, res, next);
    });
});

router.get('/:date', (req, res, next) => {
  var targetDate = new Date(new Date(req.params.date).toDateString());
  renderRankingByDate(targetDate, req, res);
});

function renderRankingByDate(targetDate, req, res) {
  var targetRankingCacheKey = 'ranking_' + targetDate.toDateString().replace(/ /g, '_');
  var targetRankingHTMLCache = memoryCache.get(targetRankingCacheKey);
  var isAdmin = myUtil.isAdminByReq(req);

  ReleaseControlModel.selectById('new_book_manga')
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
              productType: PRODUCT_TYPE_OF_NEW_BOOK_MANGA,
              targetDate: targetDate,
              latestStatDate: releaseControlModel.getDateObj(),
              ranking: ranking,
            });
          })
          .fail(e => {
            res.render('error', {});
          });
      }
    });

}

function createRankingByDate(targetDate) {
  var d = Q.defer();

  async.waterfall([
    (callback) => {
      DailyBookRankingModel.selectByDate(targetDate, {ignoreInvalidRecords: true})
        .then(dailyBookRankingModels => {
          if (__.isEmpty(dailyBookRankingModels)) {
            return callback('ranking not found');
          }

          callback(null, dailyBookRankingModels);
        });
    },
    (dailyBookRankingModels, callback) => {
      var rank = 1;
      var idx = 1;
      var previousTweetCount = null;
      var top100 = __.chain(dailyBookRankingModels)
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

      var productIds = __.map(top100, function (m) {
        return m.getProductId();
      });

      Q.allSettled([
        TweetModel.selectByProductTypeIdAndProductIds(PRODUCT_TYPE_OF_NEW_BOOK_MANGA, productIds, {excludeRetweet: false,}),
        RakutenBookModel.selectByIds(productIds),
        BlockTwitterUserModel.selectAll(),
      ]).then(function (results) {
        var tweetModels = results[0].value;
        var rakutenBookModels = results[1].value;
        var blockTwitterUserModels = results[2].value;

        callback(null, top100, rakutenBookModels, tweetModels, blockTwitterUserModels);
      });
    },

    (dailyBookRankingModels, rakutenBookModels, tweetModels, blockTwitterUserModels, callback) => {
      var isbnCodes = __.map(rakutenBookModels, m => {
        return m.getISBNCode();
      });

      BookCaptionModel.selectByISBNCodes(isbnCodes)
        .then(bookCaptionModels => {
          callback(null, dailyBookRankingModels, rakutenBookModels, tweetModels, blockTwitterUserModels, bookCaptionModels, callback);
        });
    },
  ], (e, dailyBookRankingModels, rakutenBookModels, tweetModels, blockTwitterUserModels, bookCaptionModels) => {
    if (e) {
      return d.reject(e);
    }

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
      var sortedTweets = sortTweetForBookRanking(tweets, excludeScreenNameHash);

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

    var productIdToRakutenBookModelHash = __.indexBy(rakutenBookModels, function (m) {
      return m.getId();
    });

    var isbnCodeToBookCaptionModelHash = __.indexBy(bookCaptionModels, m => {
      return m.getISBNCode();
    });

    var rankingObj = __.map(dailyBookRankingModels, function (m) {
      var rakutenBookModel = productIdToRakutenBookModelHash[m.getProductId()];

      return {
        rank: m.getRank(),
        tweetCount: m.getTweetCount(),
        userCount: m.getUserCount(),
        tweetModels: __.first(productIdToTweetsHash[m.getProductId()], 100),
        productInfo: {
          rakutenBookModel: rakutenBookModel,
          bookCaptionModel: isbnCodeToBookCaptionModelHash[rakutenBookModel.getISBNCode()],
        },
      };
    });

    d.resolve(rankingObj);
  });

  return d.promise;
}

function sortTweetForBookRanking(tweets, excludeScreenNameHash) {
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
