const $ = jQuery = require('jquery');
const MyUtil = require('./util.js')
const request = require('request');

$(function () {
  initDeleteCacheFunction();
  initButtons();
});

function initButtons() {
  $('#button-raw-select-sql').on('click', function () {
    var button = $(this);
    var sql = $('#input-raw-select-sql').val();

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/raw_select_sql',
      method: 'POST',
      data: {
        sql: sql,
      },
    }).done(function (data) {
      button.html('成功');
      return window.location.href = data.url;
    }).fail(function (e) {
      button.html('失敗: ' + e);
    });
  });

  $('#button-raw-select-sql-for-product').on('click', function () {
    var button = $(this);
    var sql = $('#input-raw-select-sql-for-product').val();

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/raw_select_sql_for_product',
      method: 'POST',
      data: {
        sql: sql,
      },
    }).done(function (data) {
      button.html('成功');
      return window.location.href = data.url;
    }).fail(function (e) {
      button.html('失敗: ' + e);
    });
  });

}

// function initBuildRankingFunction() {
//   $('#build-ranking-button').on('click', function () {
//     console.log("build rankingボタンが押下されました");
//
//     var button = $(this);
//     var dateStr = $('#build-ranking-date-input').val();
//
//     // disable button
//     button.attr('disabled', true);
//     button.html('処理中...');
//
//     // API for building ranking
//     request({
//       url: MyUtil.getLocationOrigin() + '/admin/build_ranking',
//       method: 'POST',
//       headers: {'Content-Type': 'application/json',},
//       qs: {
//         date: dateStr,
//       },
//     }, function (error, response, body) {
//       var responseJSON = JSON.parse(response.body);
//       button.html(responseJSON.result ? dateStr + " のランキング生成リクエストを正常に受け取りました" : '失敗しました');
//     });
//   });
// }

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
      button.html(responseJSON.result ? key + " 削除済" : '失敗');
    });
  });
}
