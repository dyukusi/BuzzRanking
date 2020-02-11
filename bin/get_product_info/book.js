const appRoot = require('app-root-path');
const Config = require('config');
const _ = require('underscore');
const Moment = require('moment');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/lib/util.js');
const con = require(appRoot + '/lib/db.js');
const CONST = require(appRoot + '/lib/const.js');
const BatchUtil = require(appRoot + '/lib/batch_util.js');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const DBUtil = require(appRoot + '/lib/db_util.js');
const ProductBundle = require(appRoot + '/models/product_bundle');

const Book = require(appRoot + '/models/book');

var sinceYear = 2015;
// var FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW = 365 * 3;
// var sinceMoment = new Moment().subtract(FETCH_PRODUCT_DATA_DAYS_AGO_FROM_NOW, 'day');

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

var stringifiedTaskTemplate = JSON.stringify({
  qs: {
    applicationId: Config.rakuten_api.applicationId,
    affiliateId: Config.rakuten_api.affiliateId,
    format: 'json',
    formatVersion: 2,

    // page: null,
    // sort: null,
    // booksGenreId: null,
    // size: null,
    // keyword: null,
    // availability: null,
  },
});

var productTypeIdIntoGenreIdHash = {
  [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.COMIC]: '001001',
  [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.NOVEL]: '001004',
};

var taskQueue = [];
var shouldSearchNextPage = true;

console.log('since year: ' + sinceYear);

(async () => {
  var task;
  taskQueue = await createTaskQueue();

  while (task = taskQueue.pop()) {
    if (task.qs.page == 1) {
      console.log(task);
    }

    var shouldSearchNext = true;

    var jsonString = null;
    try {
      jsonString = await doRequest({
        url: 'https://app.rakuten.co.jp/services/api/BooksBook/Search/20170404?',
        qs: task.qs,
      });
    } catch (e) {
      console.error(e);
      taskQueue.push(task);
      continue;
    }

    var json = JSON.parse(jsonString);
    console.log('Page ' + json['page'] + '/' + json['pageCount']);

    var insertObjects = _.chain(json['Items'])
      .map(item => {
        return itemIntoInsertObjectBase(item, task.productTypeId);
      })
      .filter(insertObject => {
        var regexResult = new RegExp(/(\d+)年/).exec(insertObject.saleDateStr);
        if (_.isEmpty(regexResult)) {
          console.log('could not analyze date string: ' + insertObject.saleDateStr);
          return true;
        }

        var saleYear = regexResult[1];
        var isInTargetRangeProduct = +sinceYear <= +saleYear;

        if (!task.ignoreReleaseDateThreshold && task.qs.sort == '-releaseDate' && !isInTargetRangeProduct) {
          shouldSearchNext = false;
          return false;
        }

        if (task.ignoreReleaseDateThreshold) {
          return true;
        }

        return isInTargetRangeProduct;
      })
      .value();

    var bookModels = await DBUtil.insertProductsUpdateOnDuplicate(Book, insertObjects);

    console.log('inserted num: ' + insertObjects.length);

    var hasNextPage = task.qs.page < +json['pageCount'];

    if (shouldSearchNext && hasNextPage) {
      task.qs.page += 1;
      taskQueue.push(task);
    } else {
      console.log("=============== NEXT TASK ================");
    }

    await sleep(1000);
  }
})();

function doRequest(options) {
  return new Promise(function (resolve, reject) {
    request(options, function (error, res, body) {
      if (!error && res.statusCode == 200) {
        resolve(body);
      } else {
        reject(error);
      }
    });
  });
}

async function createTaskQueue() {
  var queue = [];

  var protectedProductBundleModel = await ProductBundle.findAll({
    where: {
      validityStatus: CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.PROTECTED,
    },
  });

  // size & release date
  // 0:全て
  // 1:単行本
  // 2:文庫
  // 3:新書
  // 4:全集・双書
  // 5:事・辞典
  // 6:図鑑
  // 7:絵本
  // 8:カセット,CDなど
  // 9:コミック
  // 10:ムックその他
  _.each(productTypeIdIntoGenreIdHash, (genreId, productTypeId) => {

    // size
    var targetSizes = [1, 2, 3, 9];
    _.each(targetSizes, size => {
      var task = JSON.parse(stringifiedTaskTemplate);
      task.productTypeId = productTypeId;
      task.qs.booksGenreId = genreId;

      task.qs.page = 1;
      task.qs.sort = '-releaseDate';
      task.qs.size = size;

      queue.push(task);
    });

    // sales count desc
    (() => {
      var task = JSON.parse(stringifiedTaskTemplate);
      task.productTypeId = productTypeId;
      task.qs.booksGenreId = genreId;

      task.qs.page = 1;
      task.qs.sort = 'sales';
      task.qs.size = 0;

      queue.push(task);
    })();

    // review count desc
    (() => {
      var task = JSON.parse(stringifiedTaskTemplate);
      task.productTypeId = productTypeId;
      task.qs.booksGenreId = genreId;

      task.qs.page = 1;
      task.qs.sort = 'reviewCount';
      task.qs.size = 0;

      queue.push(task);
    })();

    // protected bundle series
    _.each(protectedProductBundleModel, productBundleModel => {
      var task = JSON.parse(stringifiedTaskTemplate);
      task.productTypeId = productTypeId;
      task.ignoreReleaseDateThreshold = true;

      task.qs.booksGenreId = genreId;
      task.qs.page = 1;
      task.qs.sort = '-releaseDate';
      task.qs.size = 0;
      task.qs.title = productBundleModel.name;

      queue.push(task);
    });
  });


  return queue;
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
