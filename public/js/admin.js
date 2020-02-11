const $ = jQuery = require('jquery');
const _ = require('underscore');
const MyUtil = require('./util.js')
const Autocomplete = require('autocompleter');

console.log("loaded admin.js");

global.initAdminFunctions = function() {
  $('.initialize-product-bundle').on('click', function () {
    var button = $(this);
    var productBundleId = Number(button.parents('.product-block').data('product-bundle-id'));

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/initialize_product_bundle',
      method: 'POST',
      data: {
        productBundleId: productBundleId,
      },
    }).done(function (data) {
      button.html(data.result ? '成功' : '失敗しました');
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('.update-product-bundle-validity-status').on('click', function () {
    var button = $(this);
    var productBundleId = Number(button.parents('.product-block').data('product-bundle-id'));
    var status = Number(button.val());

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/update_product_bundle_validity_status',
      method: 'POST',
      data: {
        productBundleId: productBundleId,
        status: status,
      },
    }).done(function (data) {
      button.html(data.result ? 'validityStatusを' + status + 'に更新しました' : '失敗しました');
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('.update-product-validity-status').on('click', function () {
    var button = $(this);
    var productId = +button.data('product-id');
    var status = Number(button.val());

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/update_product_validity_status',
      method: 'POST',
      data: {
        productId: productId,
        status: status,
      },
    }).done(function (data) {
      button.html(data.result ? 'validityStatusを' + status + 'に更新しました' : '失敗しました');
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('.add-alt-search-word').on('click', function () {
    var button = $(this);
    var productBundleId = +button.data('product-bundle-id');
    var productBundleName = button.data('product-bundle-name');

    // disable button
    button.attr('disabled', true);

    var altSearchWord = window.prompt(productBundleName + ' (' + productBundleId + ') のAltSearchWordを入力せよ', '');
    if (_.isEmpty(altSearchWord)) {
      button.attr('disabled', false);
      return;
    }

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/api/add_twitter_alt_search_word',
      method: 'POST',
      data: {
        productBundleId: productBundleId,
        altSearchWord: altSearchWord,
      },
    }).done(function (data) {
      button.html(altSearchWord + ' を追加しました');
      button.attr('disabled', false);
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
      button.attr('disabled', false);
    });
  });


  $('.update-alt-search-word-validity-status').on('click', function () {
    var button = $(this);
    var productId = Number(button.parents('.product-block').data('productId'));
    var searchWord = button.data('search-word');
    var status = Number(button.val());

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/update_alt_search_word_validity_status',
      method: 'POST',
      data: {
        productId: productId,
        searchWord: searchWord,
        status: status,
      },
    }).done(function (data) {
      button.html(data.result ? 'validityStatusを' + status + 'に更新しました' : '失敗しました');
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('.remove-tweet-button').on('click', function () {
    var button = $(this);
    var tweetId = button.data('tweetId');

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/enable_is_invalid_tweet_flag',
      method: 'POST',
      data: {
        tweetId: tweetId,
      },
    }).done(function (data) {
      button.html(data.result ? 'invalid_tweetフラグが有効になりました' : '失敗しました');
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('.make-product-become-independent').on('click', function () {
    var button = $(this);
    var productId = button.val();

    var productBundleName = window.prompt('新しいBundleの名前を入力してください。', button.data('product-name'));
    if (_.isEmpty(productBundleName)) return;

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/make_product_become_independent',
      method: 'POST',
      data: {
        productId: productId,
        productBundleName: productBundleName,
      },
    }).done(function (data) {
      button.html(data.result ? '成功' : '失敗しました');
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('#input-admin-bundle-search').on('keyup', function (event) {
    event.preventDefault();
    if (event.keyCode != 13) return;

    window.location.href = '/admin/bundle_search?search_word=' + $('#input-admin-bundle-search').val();
  });

  $('.update-product-bundle-name').on('click', function () {
    var button = $(this);
    var productBundleId = button.parents('.product-block').data('product-bundle-id');
    var productBundleName = button.parents('.update-product-bundle-row').find('.input-update-product-bundle-name').val();

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/update_product_bundle_name',
      method: 'POST',
      data: {
        productBundleId: productBundleId,
        productBundleName: productBundleName,
      },
    }).done(function (data) {
      button.html('成功 ' + Math.floor(new Date().getTime()/1000));
      button.attr('disabled', true);
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

  $('.merge-products').on('click', function () {
    var button = $(this);
    var productBundleId = button.parents('.product-block').data('product-bundle-id');
    var productIds = button.data('product-ids');

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    $.ajax({
      url: MyUtil.getLocationOrigin() + '/admin/merge_products',
      method: 'POST',
      data: {
        productBundleId: productBundleId,
        productIds: JSON.stringify(productIds),
      },
    }).done(function (data) {
      button.html('成功 ' + Math.floor(new Date().getTime()/1000));
      button.attr('disabled', true);
    }).fail(function (e) {
      button.html('失敗しました: ' + e);
    });
  });

}

global.initUpdateBelongedProductBundleAutoComplete = function() {
  _.each($('.input-update-belonged-product-bundle'), input => {
    var autocomplete = Autocomplete({
      input: input,
      minLength: 2,
      preventSubmit: true,
      debounceWaitMs: 100,
      showOnFocus: true,

      fetch: async (text, update) => {
        var json = await $.ajax({
          url: MyUtil.getLocationOrigin() + '/api/all_search',
          type: 'GET',
          dataType: 'json',
          data: {
            searchString: text,
          },
        });

        var searchResults = _.filter(json.result, data => {
          return data.group == 'シリーズ';
        });

        _.each(searchResults, data => {
          data.label += '(' + data.productBundleId + ')';
        });

        update(searchResults);
      },

      onSelect: (item) => {
        input.value = item.label;

        var productId = +$(input).data('product-id');
        var productBundleId = item.productBundleId;

        $.ajax({
          url: MyUtil.getLocationOrigin() + '/admin/update_belonged_product_bundle',
          method: 'POST',
          data: {
            productId: productId,
            productBundleId: productBundleId,
          },
        }).done(function (data) {
          alert('成功');
        }).fail(function (e) {
          alert(e);
        });
      },

      customize: (input, inputRect, container, maxHeight) => {
        container.style.maxHeight = (+window.innerHeight / 3) + 'px';
      },
    });
  });
}

