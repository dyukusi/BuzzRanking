const appRoot = require('app-root-path');
const Config = require('config');
const CONST = require(appRoot + '/my_libs/const.js');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const fs = require('fs');
const _ = require('underscore');
const request = require('request');
const Q = require('q');
const Util = require(appRoot + '/my_libs/util.js');
const async = require('async');
const con = require(appRoot + '/my_libs/db.js');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const sprintf = require('sprintf-js').sprintf;
const Anime = require(appRoot + '/models/anime');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

const COURS_URL = "http://api.moemoe.tokyo/anime/v1/master/cours";
const ANIME_LIST_API_BASE = "http://api.moemoe.tokyo/anime/v1/master/%s/%s";

(async function () {
  var queue = await createTaskQueue();
  var task;

  while (task = queue.pop()) {
    await fetchAndInsertProductData(task);

    await sleep(1000);
  }

  console.log('Finished!')
})();

async function createTaskQueue() {
  var json = await doRequest({
    url: COURS_URL,
  });

  var coursHash = JSON.parse(json);

  return _.values(coursHash);
}

async function fetchAndInsertProductData(task) {
  var url = sprintf(ANIME_LIST_API_BASE, task.year, task.cours);
  console.log("target: " + url);

  var json = await doRequest({
    url: url,
  });

  var animeDataArray = JSON.parse(json);
  var animeTableInsertObjects = _.map(animeDataArray, data => {
    return {
      productTypeId: CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['anime'],
      shangrilaId: data.id,
      year: task.year,
      cours: task.cours,
      title: data.title,
      publicUrl: data.public_url,
      // ogpImageUrl: null,
      twitterAccount: data.twitter_account,
      twitterHashTag: data.twitter_hash_tag,
      sex: data.sex,
      sequel: data.sequel,
      cityCode: data.city_code,
      cityName: data.city_name,
      productCompany: data.product_companies,
    };
  });

  var insertedAnimeModels = await Anime.bulkInsert(animeTableInsertObjects);

  var shangrilaIdIntoAnimeModelHash = _.indexBy(insertedAnimeModels, model => {
    return model.shangrilaId;
  });

  _.each(animeDataArray, data => {
    var shangrilaId = data.id;
    var productId = shangrilaIdIntoAnimeModelHash[shangrilaId].productId;
    var shortTitles = _.compact([data.title_short1, data.title_short2, data.title_short3]);

    _.each(shortTitles, shortTitle => {
      TwitterAlternativeSearchWord.upsert({
        productId: productId,
        searchWord: shortTitle,
      });
    });
  });

  // get OGP image url from official site
  var fetchOgpImageUrlTargetModels = _.filter(insertedAnimeModels, model => {
    return _.isEmpty(model.ogpImageUrl);
  });

  for (var i=0; i<fetchOgpImageUrlTargetModels.length; i++) {
    var model = fetchOgpImageUrlTargetModels[i];


    var body = await doRequest({
      url: model.publicUrl,
      timeout: 3000,
    }).catch((e) => {
      console.log(e);
      console.log("error url: " + model.publicUrl);
      body = null;
    });

    if (_.isEmpty(body)) continue;

    var OGPImageLineStrArray = body.match(/meta property="og:image" content=\".*\"/g);

    if (OGPImageLineStrArray) {
      var OGPlineStr = OGPImageLineStrArray[0];
      var OGPImageURL = $('<' + OGPlineStr + '>')[0].content;

      await model.update({
        ogpImageUrl: OGPImageURL,
      });

    } else {
      console.log("og:image not found: " + model.publicUrl);
    }


  }

}

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
