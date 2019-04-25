const appRoot = require('app-root-path');
const Config = require('config');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');

const RakutenBookModel = require(appRoot + '/models/rakuten_book');

var TARGET_GENRE_IDS = [
  '001001', // 漫画（コミック）
  '001002', // 語学・学習参考書
  '001003', // 絵本・児童書・図鑑
  '001004', // 小説・エッセイ
  '001005', // パソコン・システム開発
  '001006', // ビジネス・経済・就職
  '001007', // 旅行・留学・アウトドア
  '001008', // 人文・思想・社会
  '001009', // ホビー・スポーツ・美術
  '001010', // 美容・暮らし・健康・料理
  '001011', // エンタメ・ゲーム
  '001012', // 科学・技術
  '001013', // 写真集・タレント
  '001015', // その他
  '001016', // 資格・検定
  '001017', // ライトノベル
  '001018', // 楽譜
  '001019', // 文庫
  '001020', // 新書
  '001021', // ボーイズラブ（BL）
  '001022', // 付録付き
  '001023', // バーゲン本
  '001025', // コミックセット
  '001026', // カレンダー・手帳・家計簿
  '001027', // 文具・雑貨
  '001028', // 医学・薬学・看護学・歯科学
];

var queue = [];

initQueue();

queue = [{
  genreId: '001001',
  page: 1,
}];

main();

function main() {
  setTimeout(function () {
    var task = queue.pop();

    if (!task) {
      console.log('task not found');
      main();
      return;
    } else {
      console.log('Processing... ' + task.genreId + ' ' + task.page);

      getRakutenBookJSON(task.genreId, task.page)
        .then(function (json) {
          console.log('Page ' + json['page'] + '/' + json['pageCount']);

          var insertObjects = _.map(json['Items'], function (item) {
            return {
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
          });

          RakutenBookModel.insert(insertObjects)
            .then(function () {
              if (task.page < json['pageCount']) {
                var thirtyDaysAgoDate = new Date(new Date(new Date().setDate(new Date().getDate() - 30)).toDateString());
                var shouldSearchNext = _.every(insertObjects, function (obj) {
                  var saleDate = new Date(obj.sale_date);
                  return saleDate - thirtyDaysAgoDate >= 0;
                });

                if (shouldSearchNext) {
                  console.log("should search for next page. added to queue.");
                  queue.push({
                    genreId: task.genreId,
                    page: task.page + 1,
                  });
                } else {
                  console.log("skipped next page because they are expired(30days)");
                }

                main();
              }
            })
            .fail(function (e) {
              console.log(e);
              queue.push(task);
              main();
            });

        })
        .fail(function (e) {
          console.log(e);
          queue.push(task);

          console.log("waiting 10secs...");
          setTimeout(function () {
            main();
          }, 10000);
        });
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

      // keyword: '進撃の巨人',
      page: page,
      //availability: 5,
      sort: '-releaseDate',
      booksGenreId: genreId,
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

function insertItemsIntoDB(items) {
  var d = Q.defer();


  return d.promise;
}
