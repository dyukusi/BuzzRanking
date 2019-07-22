$ = jQuery = require('jquery');
const MyUtil = require('./util.js')
const request = require('request');

$(function () {
  initBuildRankingFunction();
  initDeleteCacheFunction();
});

function initBuildRankingFunction() {
  $('#build-ranking-button').on('click', function () {
    console.log("build rankingボタンが押下されました");

    var button = $(this);
    var dateStr = $('#build-ranking-date-input').val();

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    // API for building ranking
    request({
      url: MyUtil.getLocationOrigin() + '/admin/build_ranking',
      method: 'POST',
      headers: {'Content-Type': 'application/json',},
      qs: {
        date: dateStr,
      },
    }, function (error, response, body) {
      var responseJSON = JSON.parse(response.body);
      button.html(responseJSON.result ? dateStr + " のランキング生成リクエストを正常に受け取りました" : '失敗しました');
    });
  });
}

function initDeleteCacheFunction() {
  $('.delete-cache-button').on('click', function () {
    console.log("delete cacheボタンが押下されました");

    var button = $(this);
    var key = button.val();

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    // API for delete cache
    request({
      url: MyUtil.getLocationOrigin() + '/admin/delete_cache',
      method: 'POST',
      headers: {'Content-Type': 'application/json',},
      qs: {
        key: key,
      },
    }, function (error, response, body) {
      var responseJSON = JSON.parse(response.body);
      button.html(responseJSON.result ? key + " のキャッシュ削除リクエストを正常に受け取りました" : '失敗しました');
    });


  });
}
