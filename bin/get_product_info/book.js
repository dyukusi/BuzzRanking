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
const CONST = require(appRoot + '/my_libs/const.js');
const BatchUtil = require(appRoot + '/my_libs/batch_util.js');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

const BookModel = require(appRoot + '/models/book');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

var FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW = 365;
var C = CONST.PRODUCT_TYPE_NAME_TO_ID_HASH;
var thresholdDate = new Date(new Date().setDate(new Date().getDate() - FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW));

// remaining
// '001002', // 語学・学習参考書
// '001003', // 絵本・児童書・図鑑
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

var PRODUCT_TYPE_ID_INTO_GENRE_ID_HASH = {};
PRODUCT_TYPE_ID_INTO_GENRE_ID_HASH[C['comic']] = '001001';
PRODUCT_TYPE_ID_INTO_GENRE_ID_HASH[C['novel']] = '001004';
PRODUCT_TYPE_ID_INTO_GENRE_ID_HASH[C['it']] = '001005';

var queue = [];

console.log('product since ' + thresholdDate.toLocaleString());

initQueue();
main();

async function main() {
  await sleep(1000);

  var task = queue.pop();

  if (!task) {
    console.log('task not found');
    console.log('Finished!')
    con.end();
    return;
  } else {
    console.log('Processing... ' + task.genreId + ' ' + task.page);

    var json = await getRakutenBookJSON(task.genreId, task.page);

    console.log('Page ' + json['page'] + '/' + json['pageCount']);

    var insertObjects = _.map(json['Items'], item => {
      return itemIntoInsertObjectBase(item, task.productTypeId);
    });

    _.each(insertObjects, obj => {
      var saleDate = new Date(obj.saleDate);
      if (saleDate < thresholdDate) {
        shouldSearchNextPage = false;
      }
    });

    var bookModels = await BookModel.bulkInsert(insertObjects);

    for (var i = 0; i < bookModels.length; i++) {
      var bookModel = bookModels[i];
      await BatchUtil.insertAltWordIfNeedForNewBook(bookModel.productId, bookModel.title);
    }

    var shouldSearchNextPage = task.page < json['pageCount'];
    if (shouldSearchNextPage) {
      var newTask = _.clone(task);
      newTask.page++;

      queue.push(newTask);
    } else {
      console.log('next page isnt required to search');
    }

    main();
  }
}

function initQueue() {
  _.each(PRODUCT_TYPE_ID_INTO_GENRE_ID_HASH, function (genreId, productTypeId) {
    queue.push({
      productTypeId: productTypeId,
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

function itemIntoInsertObjectBase(item, productTypeId) {
  return {
    productTypeId: productTypeId,
    isbnCode: item['isbn'],
    title: item['title'],
    titleKana: item['titleKana'],
    subTitle: item['subTitle'],
    subTitleKana: item['subTitleKana'],
    series: item['seriesName'],
    seriesKana: item['seriesNameKana'],
    contents: item['contents'],
    author: item['author'],
    authorKana: item['authorKana'],
    publisher: item['publisherName'],
    size: item['size'],
    caption: item['itemCaption'],
    itemUrl: item['itemUrl'],
    affiliateItemUrl: item['affiliateUrl'],
    imageUrlBase: item['smallImageUrl'].replace('?_ex=64x64', ''),
    chirayomiUrl: item['chirayomiUrl'],
    price: item['itemPrice'],
    reviewCount: item['reviewCount'],
    reviewRateAverage: item['reviewAverage'],
    genreId: item['booksGenreId'],
    saleDateStr: item['salesDate'],
    saleDate: Util.convertJapaneseDateStrIntoMysqlDate(item['salesDate']),
  };
}
