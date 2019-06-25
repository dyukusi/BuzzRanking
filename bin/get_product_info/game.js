const appRoot = require('app-root-path');
const Config = require('config');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const async = require('async');
const con = require(appRoot + '/my_libs/db.js');

const GameModel = require(appRoot + '/models/game');

var FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW = 365;
var TARGET_GENRE_IDS = [
  '006508', // 3DS
  '006509', // PS Vita
  '006512', // Xbox One
  '006513', // PS4
  '006514', // Switch
];
var queue = [];

initQueue();

// queue = [{
//   genreId: '001001',
//   page: 1,
// }];

main();

function main() {
  setTimeout(function () {
    var task = queue.pop();

    if (!task) {
      console.log('task not found');
      console.log('Finished!')
      con.end();
      return;
    } else {
      console.log('Processing... ' + task.genreId + ' ' + task.page);

      async.waterfall([
          (callback) => {
            getRakutenGameJSON(task.genreId, task.page)
              .then(json => {
                callback(null, json);
              });
          },
          (json, callback) => {
            console.log('Page ' + json['page'] + '/' + json['pageCount']);
            var shouldSearchNextPage = task.page < json['pageCount'];
            var thresholdDate = new Date(new Date().setDate(new Date().getDate() - FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW));
            var insertObjects = _.map(json['Items'], item => {
              var insertObject = itemIntoInsertObjectBase(item);

              // check fetch limit date
              var saleDate = new Date(insertObject.sale_date);

              if (saleDate < thresholdDate) {
                shouldSearchNextPage = false;
              }

              return insertObject;
            });

            GameModel.bulkInsert(insertObjects)
              .then(models => {
                callback(null, shouldSearchNextPage);
              });
          },
        ],
        (err, shouldSearchNextPage) => {
          if (err) {
            console.log(err);
            queue.push(task);
          }

          if (shouldSearchNextPage) {
            queue.push({
              genreId: task.genreId,
              page: task.page + 1,
            });
          } else {
            console.log('next page isnt required to search');
          }

          main();
        }
      );
    }

  }, 1000);

}

function initQueue() {
  _.each(TARGET_GENRE_IDS, function (genreId) {
    queue.push({
      genreId: genreId,
      page: 1,
    });
  });
}

function getRakutenGameJSON(genreId, page) {
  var d = Q.defer();

  request.get({
    url: 'https://app.rakuten.co.jp/services/api/BooksGame/Search/20170404',
    qs: {
      applicationId: Config.rakuten_api.applicationId,
      affiliateId: Config.rakuten_api.affiliateId,
      format: 'json',
      formatVersion: 2,
      sort: '-releaseDate',

      page: page,
      booksGenreId: genreId,
    },
  }, function (e, response, body) {
    if (e) {
      d.reject(e);
      return;
    }

    return d.resolve(JSON.parse(body));
    ;
  });

  return d.promise;
}

function itemIntoInsertObjectBase(item) {
  return {
    productTypeId: 3,
    janCode: item['jan'],
    title: item['title'],
    titleKana: item['titleKana'],
    makerCode: item['makerCode'],
    caption: item['itemCaption'],
    rakutenAffiliateItemUrl: item['affiliateUrl'],
    imageUrlBase: item['smallImageUrl'].replace('?_ex=64x64', ''),
    genreId: item['booksGenreId'],
    saleDateStr: item['salesDate'],
    saleDate: Util.convertJapaneseDateStrIntoMysqlDate(item['salesDate']),
  };
}
