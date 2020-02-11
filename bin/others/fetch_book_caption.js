const appRoot = require('app-root-path');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/lib/util.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const QueryString = require('query-string');
const async = require('async');
const con = require(appRoot + '/lib/db.js');

const BookCaptionModel = require(appRoot + '/models/book_caption.js');
const StatModel = require(appRoot + '/models/stat.js');
const StatDataModel = require(appRoot + '/models/stat_data.js');
const BookModel = require(appRoot + '/models/book');

process.on('uncaughtException', function (err) {
  console.log(err);
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
});

async.waterfall([
  (callback) => {
    con.query('SELECT * FROM stat ORDER BY ranking_date DESC',
      [],
      function (e, rows, fields) {
        if (e) {
          throw new Error(e);
        }
        var targetStatId = rows[0]['id'];

        callback(null, targetStatId);
      }
    );
  },
  (targetStatId, callback) => {
    StatDataModel.selectByStatId(targetStatId)
      .then(statDataModels => {
        var productIds = _.map(statDataModels, m => {
          return m.productId;
        });

        var productIdIntoStatDataModelHash = _.indexBy(statDataModels, m => {
          return m.productId;
        });

        ProductUtil.selectProductModels({
          productId: productIds,
        })
          .then(productModels => {
            var bookModels = _.chain(productModels)
              .filter(m => {
                return m instanceof BookModel;
              })
              .value();

            callback(null, bookModels);
          });
      });
  },
  (bookModels, callback) => {
    con.query('SELECT product_id FROM book_caption',
      [],
      function (e, rows, fields) {
        if (e) {
          throw new Error(e);
        }
        var alreadyHasHash = _.indexBy(rows, row => {
          return row['product_id'];
        });

        var filteredBookModels = _.filter(bookModels, m => {
          return !alreadyHasHash[m.productId];
        });

        callback(null, filteredBookModels);
      }
    );
  },
  (bookModels, callback) => {
    var isbnCodeIntoBookModelHash = _.indexBy(bookModels, m => {
      return m.isbnCode;
    });
    var isbnCodes = _.keys(isbnCodeIntoBookModelHash);
    console.log('Target num: ' + isbnCodes.length);

    fetchBookInfoByISBNCodes(isbnCodes)
      .then(json => {
        var isbnCodeIntoCaptionHash = {};
        _.each(json, bookInfo => {
          if (!bookInfo) return;

          var isbnCode = bookInfo['summary']['isbn'];
          var textContent = _.indexBy(bookInfo['onix']['CollateralDetail']['TextContent'], 'TextType');
          var targetTextContent = textContent['03'] || textContent['02'];

          if (!targetTextContent) {
            return
          }

          isbnCodeIntoCaptionHash[isbnCode] = targetTextContent['Text'];
        });

        var insertObject = _.map(_.keys(isbnCodeIntoCaptionHash), isbnCode => {
          var productId = isbnCodeIntoBookModelHash[isbnCode].productId;
          return [productId, isbnCodeIntoCaptionHash[isbnCode]];
        });

        callback(null, insertObject);
      });
  },
  (insertObjects, callback) => {
    console.log('insertObject.length: ' + insertObjects.length);

    if (_.isEmpty(insertObjects)) {
      return callback(null);
    }

    Promise.all(_.map(insertObjects, obj => {
      return BookCaptionModel.create({
        productId: obj[0],
        caption: obj[1],
      });
    }))
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
  process.exit(0);
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
