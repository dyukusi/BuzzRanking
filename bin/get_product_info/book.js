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

const BookModel = require(appRoot + '/models/book');

var FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW = 30;
var TARGET_GENRE_IDS = [
  '001001', // 漫画（コミック）
  // '001002', // 語学・学習参考書
  // '001003', // 絵本・児童書・図鑑
  // '001004', // 小説・エッセイ
  // '001005', // パソコン・システム開発
  // '001006', // ビジネス・経済・就職
  // '001007', // 旅行・留学・アウトドア
  // '001008', // 人文・思想・社会
  // '001009', // ホビー・スポーツ・美術
  // '001010', // 美容・暮らし・健康・料理
  // '001011', // エンタメ・ゲーム
  // '001012', // 科学・技術
  // '001013', // 写真集・タレント
  // '001015', // その他
  // '001016', // 資格・検定
  // '001017', // ライトノベル
  // '001018', // 楽譜
  // '001019', // 文庫
  // '001020', // 新書
  // '001021', // ボーイズラブ（BL）
  // '001022', // 付録付き
  // '001023', // バーゲン本
  // '001025', // コミックセット
  // '001026', // カレンダー・手帳・家計簿
  // '001027', // 文具・雑貨
  // '001028', // 医学・薬学・看護学・歯科学
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
            getRakutenBookJSON(task.genreId, task.page)
              .then(json => {
                callback(null, json);
              });
          },
          (json, callback) => {
            console.log('Page ' + json['page'] + '/' + json['pageCount']);
            var isbnCodes = _.map(json['Items'], item => {
              return item['isbn'];
            });

            BookModel.selectByISBNCodes(isbnCodes)
              .then(bookModels => {
                var isbnCodeToRakutenBookModelHash = _.indexBy(bookModels, m => {
                  return m.getISBNCode();
                });
                var newInsertObjects = [];
                var replaceInsertObjects = [];

                _.each(json['Items'], item => {
                  var isbnCode = item['isbn'];
                  var insertObjectBase = itemIntoInsertObjectBase(item);

                  // already has
                  if (isbnCodeToRakutenBookModelHash[isbnCode]) {
                    var m = isbnCodeToRakutenBookModelHash[isbnCode];
                    var productId = m.getProductId();
                    insertObjectBase.product_id = productId;
                    replaceInsertObjects.push(insertObjectBase);
                  }
                  // new product
                  else {
                    newInsertObjects.push(insertObjectBase);
                  }
                });
                callback(null, newInsertObjects, replaceInsertObjects, task.page < json['pageCount']);
              });
          },
          (newInsertObjects, replaceInsertObjects, hasNextPage, callback) => {
            Q.allSettled([
              BookModel.insert(newInsertObjects),
              BookModel.replace(replaceInsertObjects),
            ]).then(results => {
              console.log("insert: " + newInsertObjects.length + " replace: " + replaceInsertObjects.length);
              callback(null, hasNextPage);
            });
          },
        ],
        (err, hasNextPage) => {
          if (err) {
            console.log(err);
            queue.push(task);
          }

          if (hasNextPage) {
            queue.push({
              genreId: task.genreId,
              page: task.page + 1,
            });
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

function getRakutenBookJSON(genreId, page) {
  var d = Q.defer();

  request.get({
    url: 'https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?',
    qs: {
      applicationId: Config.rakuten_api.applicationId,
      affiliateId: Config.rakuten_api.affiliateId,

      format: 'json',
      formatVersion: 2,
      page: page,
      sort: '-releaseDate',
      booksGenreId: genreId,

      // keyword: '進撃の巨人',
      //availability: 5,
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

function itemIntoInsertObjectBase(item) {
  return {
    product_type_id: 1,
    isbn_code: item['isbn'],
    title: item['title'],
    title_kana: item['titleKana'],
    sub_title: item['subTitle'],
    sub_title_kana: item['subTitleKana'],
    series: item['seriesName'],
    series_kana: item['seriesNameKana'],
    contents: item['contents'],
    author: item['author'],
    author_kana: item['authorKana'],
    publisher: item['publisherName'],
    size: item['size'],
    caption: item['itemCaption'],
    item_url: item['itemUrl'],
    affiliate_item_url: item['affiliateUrl'],
    image_url_base: item['smallImageUrl'].replace('?_ex=64x64', ''),
    chirayomi_url: item['chirayomiUrl'],
    price: item['itemPrice'],
    review_count: item['reviewCount'],
    review_rate_average: item['reviewAverage'],
    genre_id: item['booksGenreId'],
    sale_date_str: item['salesDate'],
    sale_date: Util.convertJapaneseDateStrIntoMysqlDate(item['salesDate']),
  };
}
