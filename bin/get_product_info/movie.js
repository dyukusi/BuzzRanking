const appRoot = require('app-root-path');
const Util = require(appRoot + '/my_libs/util.js');
const _ = require('underscore');
const {JSDOM} = require('jsdom');
const $ = jQuery = require('jquery')(new JSDOM().window);
const Config = require('config');
const Moment = require('moment');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const Movie = require(appRoot + '/models/movie');
const CONST = require(appRoot + '/my_libs/const.js');

const TMDB_API_KEY = Config.tmdb_api_key;
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/original";

// genre list
"https://api.themoviedb.org/3/genre/movie/list?api_key=<API_KEY>&language=ja";

// movie detail
"https://api.themoviedb.org/3/movie/475557?api_key=<API_KEY>&language=en-US";

(async () => {
  var page = 1;
  var totalPage = 99999;
  var gteStr = new Moment().subtract(30, 'days').format('YYYY-MM-DD');
  var lteStr = new Moment().add(30, 'days').format('YYYY-MM-DD');

  do {
    var json = await fetchRecentMovieList(page, gteStr, lteStr);
    totalPage = json.total_pages;

    console.log("page: " + page + "/" + totalPage);

    var insertObjects = _.map(json.results, rawData => {
      return createInsertObjectBase(rawData);
    });
    
    var insertedMovieModels = await Movie.bulkInsert(insertObjects);
    
    sleep(1500);
  } while (page++ < totalPage);

  console.log("done!");
})();

function createInsertObjectBase(rawData) {
  var isValidSearchWord = Util.checkSearchWordValidity(rawData.title);

  return {
    productTypeId: CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.movie,
    tmdbMovieId: rawData.id,
    title: rawData.title,
    originalTitle: rawData.original_title,
    posterUrl: IMAGE_BASE_URL + rawData.poster_path,
    backdropUrl: rawData.backdrop_path ? IMAGE_BASE_URL + rawData.backdrop_path : null,
    originalLang: rawData.original_language,
    genreIds: rawData.genre_ids.join(','),
    validityStatus: isValidSearchWord ? CONST.VALIDITY_STATUS_NAME_TO_ID.normal : CONST.VALIDITY_STATUS_NAME_TO_ID.suspicious,
    releaseDate: rawData.release_date,
  };
}

function fetchRecentMovieList(page, dateStrGTE, dateStrLTE) {
  return request({
    url: 'https://api.themoviedb.org/3/discover/movie',
    method: 'GET',
    data: {
      api_key: TMDB_API_KEY,
      language: 'ja',
      region: 'JP',
      sort_by: 'release_date.desc',
      include_adult: 'true',
      page: page,
      'primary_release_date.lte': dateStrLTE,
      'primary_release_date.gte': dateStrGTE,
    },
  });
}

function request(param) {
  return new Promise((resolve, reject) => {
    $.ajax(param).done(function (data) {
      return resolve(data);
    }).fail(function (e) {
      reject(e);
    });
  });
}
