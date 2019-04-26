const appRoot = require('app-root-path');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const QueryString = require('query-string');
const async = require('async');

const BookCaptionModel = require(appRoot + '/models/book_caption.js');
const RakutenBookModel = require(appRoot + '/models/rakuten_book.js');
const DailyBookRankingModel = require(appRoot + '/models/daily_book_ranking.js');

async.waterfall([
  (callback) => {
    DailyBookRankingModel.selectByDate(new Date('2019-04-10'))
      .then(bookRankingModels => {
        var top100productIds = _.chain(bookRankingModels)
          .filter(m => {
            return m.getRank() <= 100;
          })
          .map(m => {
            return m.getProductId();
          })
          .value();

        callback(null, top100productIds);
      });
  },
  (productIds, callback) => {
    RakutenBookModel.selectByIds(productIds)
      .then(rakutenBookModels => {
        var isbnCodes = _.map(rakutenBookModels, m => {
          return m.getISBNCode();
        })

        callback(null, isbnCodes);
      });
  },
  (isbnCodes, callback) => {
    fetchBookInfoByISBNCodes(isbnCodes)
      .then(json => {
        var insertObjects = _.chain(json)
          .map(bookInfo => {
            if (!bookInfo) return;
            var isbnCode = bookInfo['summary']['isbn'];
            var textContent = _.indexBy(bookInfo['onix']['CollateralDetail']['TextContent'], 'TextType');
            var targetTextContent = textContent['03'] || textContent['02'];
            return {
              isbn_code: isbnCode,
              caption: targetTextContent['Text'],
            };
          })
          .compact()
          .filter(obj => {
            return obj && obj['isbn_code'] && obj['caption'];
          })
          .value();

        callback(null, insertObjects);
      });
  },
  (insertObjects, callback) => {
    BookCaptionModel.insert(insertObjects)
      .then(() => {
        callback(null);
      });
  },
], (e) => {
  if (e) {
    console.log(e);
    return;
  }

  console.log('complete!');
});


function fetchBookInfoByISBNCodes(isbnCodes) {
  var d = Q.defer();

  request.get({
    url: 'https://api.openbd.jp/v1/get?isbn=9784088818269',
    qs: {
      isbn: isbnCodes.join(','),
    }
  }, function (e, response, body) {
    if (e) {
      d.reject(e);
      return;
    }

    d.resolve(JSON.parse(body));
    return;
  });

  return d.promise;
}
