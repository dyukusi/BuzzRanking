var express = require('express');
var router = express.Router();
const Q = require('q');
const DailyBookRankingModel = require(appRoot + '/models/daily_book_ranking.js');
const RakutenBookModel = require(appRoot + '/models/rakuten_book');
const TweetModel = require(appRoot + '/models/tweet');
const BlockTwitterUserModel = require(appRoot + '/models/block_twitter_user');
const BookCaptionModel = require(appRoot + '/models/book_caption.js');

router.get('/', function (req, res, next) {
  async.waterfall([
    (callback) => {
      DailyBookRankingModel.selectByDate(new Date('2019-04-10'))
        .then(dailyBookRankingModels => {
          callback(null, dailyBookRankingModels);
        });
    },

    (dailyBookRankingModels, callback) => {
      var top100 = __.chain(dailyBookRankingModels)
        .filter(function (m) {
          return m.getRank() <= 100;
        })
        .sortBy(function (m) {
          return m.getRank();
        })
        .value();

      var productIds = __.map(top100, function (m) {
        return m.getProductId();
      });

      Q.allSettled([
        TweetModel.selectByProductIds(productIds),
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
      console.log(e);
      res.render('error', {});
      return;
    }

    var productIdToTweetsHash = __.groupBy(tweetModels, function (m) {
      return m.getProductId();
    });

    // build block user hash
    var excludeScreenNameHash = {};
    __.each(blockTwitterUserModels, function(blockTwitterUserModel) {
      excludeScreenNameHash[blockTwitterUserModel.getScreenName()] = true;
    });

    // sorting tweets object by favourite count
    __.each(productIdToTweetsHash, function (tweets, productId) {
      productIdToTweetsHash[productId] = sortTweetForBookRanking(tweets, excludeScreenNameHash);
    });

    var productIdToRakutenBookModelHash = __.indexBy(rakutenBookModels, function(m) {
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
        rakutenBookModel: rakutenBookModel,
        tweetModels: __.first(productIdToTweetsHash[m.getProductId()], 100),
        bookCaptionModel: isbnCodeToBookCaptionModelHash[rakutenBookModel.getISBNCode()],
        // tweetModels: [productIdToTweetsHash[m.getProductId()][0]],
      };
    });

    res.render('book/index', {
      ranking: rankingObj,
    });
  });

});


module.exports = router;

function sortTweetForBookRanking(tweets, excludeScreenNameHash) {
  var isExcluded = function(tweet) {
    if (excludeScreenNameHash[tweet.getScreenName()]) return true;
    return false;
  };
  
  return tweets.sort(function(a, b) {
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
