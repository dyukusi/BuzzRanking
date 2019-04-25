const appRoot = require('app-root-path');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');

const RakutenGameModel = require(appRoot + '/models/rakuten_game');

// console.log(RakutenGameModel.hoge());
// sampleRakutenBookAPI();
// sampleTwitterAPI();
// sampleRakutenGameAPI();

var BOOKS_GENRE_ID_HASH = {
  // 'PS3': '006501',
  // 'PSP': '006502',
  // 'Wii': '006503',
  // 'Nintendo DS': '006504',
  // 'Others': '006505',
  // 'PS2': '006506',
  // 'Xbox 360': '006507',
  'Nintendo 3DS': '006508',
  'PS Vita': '006509',
  // 'Toys': '006510',
  // 'Wii U': '006511',
  'Xbox One': '006512',
  'PS4': '006513',
  'Nintendo Switch': '006514',
};

var TARGET_GENRE_IDS = [
  '006508', // 3DS
  '006509', // PS Vita
  '006512', // Xbox One
  '006513', // PS4
  '006514', // Switch
];

var EXCLUDE_GENRE_IDS = [];

var queue = [];

initQueue();
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

      getRakutenGameJSON(task.genreId, task.page)
        .then(function(json) {
          console.log('Page ' + json['page'] + '/' + json['pageCount']);
          insertItemsIntoDB(json['Items'])
            .then(function() {

              if (task.page < json['pageCount']) {
                queue.push({
                  genreId: task.genreId,
                  page: task.page + 1,
                });
              }

              main();
            })
            .fail(function(e) {
              console.log(e);
              queue.push(task);
              main();
            });
        })
        .fail(function(e) {
          console.log(e);
          queue.push(task);

          console.log("waiting 10secs...");
          setTimeout(function() {
            main();
          }, 10000);
        });
    }
  }, 1000);
}

function initQueue() {
  _.each(TARGET_GENRE_IDS, function(genreId) {
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
      applicationId: '1070442127214195482',
      // keyword: '進撃の巨人',
      format: 'json',
      formatVersion: 2,
      page: page,
      availability: 0,
      sort: '-releaseDate',
      // hardware: 'Nintendo Switch',
      booksGenreId: genreId,

      affiliateId: '1836ca53.70853406.1836ca54.54f28f4a',
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

  var insertObjects = [];
  _.each(items, function(item) {
    insertObjects.push({
      jan_code: item['jan'],
      title: item['title'],
      title_kana: item['titleKana'],
      made_by: item['label'],
      maker_code: item['makerCode'],
      caption: item['itemCaption'],
      item_url: item['itemUrl'],
      affiliate_item_url: item['affiliateUrl'],
      image_url_base: item['smallImageUrl'].replace('?_ex=64x64', ''),
      price: item['itemPrice'],
      review_count: item['reviewCount'],
      review_rate_average: item['reviewAverage'],
      genre_id: item['booksGenreId'],
      sale_date_str: item['salesDate'],
      sale_date: Util.convertJapaneseDateStrIntoMysqlDate(item['salesDate']),
    });
  });

  RakutenGameModel.insert(insertObjects)
    .then(function() {
      d.resolve();
    })
    .fail(function(e) {
      d.reject(e);
    });

  return d.promise;
}
