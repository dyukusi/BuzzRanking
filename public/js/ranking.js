$ = jQuery = require('jquery');
const _ = require('underscore');
const sprintf = require('sprintf-js').sprintf;
// const Liminous = require('luminous-lightbox').Luminous;
const request = require('request');
const MyUtil = require('./util.js')
const Accordion = require('accordion').Accordion;
const Lazysizes = require('lazysizes');
const isMobileDevice = 'ontouchstart' in window;
const isAdmin = !!$('#is-admin-dummy-div')[0];

var isFirstTwitterWigetsLoad = true;

require('bootstrap');
require('readmore-js');

var ADD_TWEETS_NUM_PER_READ_MORE = 5;
var gradEleTempHeightHash = {};
var updatedGradElements = [];

$(function() {
  initEmbeddedTweets();
  initReadMoreButtons();
  // initImageZoom();
  initAdminFunctions();
  initReadCaptionButton();

  // NOTE: this function doesn't work with touch scroll
  if (!isMobileDevice && !isAdmin) {
    initAutoTweetsDivCloser();
  }
});

function initReadCaptionButton() {
  var acOptions = {
    onToggle: function(fold, isOpen) {
      if (isOpen) {
        $(fold.content).data('is-open', true)
        $(fold.accordion.el).css('max-height', $(fold.content).height() + 10);
        $(fold.accordion.el).find('.read-book-caption-button').hide();
      }
    },
  };

  _.each(document.querySelectorAll('.book-caption-accordion'), function(ac) {
    new Accordion(ac, acOptions);
  });
}

function initAdminFunctions() {
  $('.add-to-invalid-table').on('click', function () {
    var button = $(this);
    var productId = Number(button.parents('.product-block').data('productId'));

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    // API for adding to disable_product table
    request({
      url: MyUtil.getLocationOrigin() + '/admin/add_product_into_invalid_product_table',
      method: 'POST',
      headers: {'Content-Type': 'application/json',},
      qs: {
        productId: productId,
      },
    }, function (error, response, body) {
      var responseJSON = JSON.parse(response.body);
      button.html(responseJSON.result ? 'invalid_productテーブルに追加されました' : '失敗しました');
    });
  });

  $('.remove-tweet-button').on('click', function () {
    var button = $(this);
    var tweetId = button.data('tweetId');

    // disable button
    button.attr('disabled', true);
    button.html('処理中...');

    // API for adding to disable_product table
    request({
      url: MyUtil.getLocationOrigin() + '/admin/enable_is_invalid_tweet_flag',
      method: 'POST',
      headers: {'Content-Type': 'application/json',},
      qs: {
        tweetId: tweetId,
      },
    }, function (error, response, body) {
      var responseJSON = JSON.parse(response.body);
      button.html(responseJSON.result ? 'invalid_tweetフラグが有効になりました' : '失敗しました');
    });
  });
}

function initGradElementsHeight() {
  var twitterReactionAreas = _.map(document.querySelectorAll('.twitter-reaction-area'), function(e) {
    return $(e);
  });

  _.each(twitterReactionAreas, function(area) {
    adjustTwitterReactionAreaHeightForInit(area, false);
  });
}

// function initImageZoom() {
//   _.each(document.querySelectorAll('.zoomable-image'), function (e) {
//     new Liminous(e, {});
//   });
// }

function initAutoTweetsDivCloser() {
  $(window).scroll(function () {
    var openedProductBlockElements = _.filter($.find('.product-block'), function (e) {
      var productBlock = $(e);
      var readMoreButton = productBlock.find('.grad-trigger');
      return readMoreButton.data('is-open');
    });

    var outOfViewGradElements = _.filter(openedProductBlockElements, isOutOfView);

    _.each(outOfViewGradElements, function (e) {
      var productBlock = $(e);
      var readMoreButton = productBlock.find('.grad-trigger');
      var gradItem = productBlock.find('.grad-item');

      readMoreButton.data('is-open', false);
      readMoreButton.show();
      gradItem.removeClass('remove-gradient');

      var area = productBlock.find('.twitter-reaction-area');
      adjustTwitterReactionAreaHeightForInit(area, true);
    });
  });
}

function initReadMoreButtons() {
  $(".grad-trigger").click(function () {
    var readMoreButtonEle = $(this);

    if (readMoreButtonEle.hasClass('disable')) return;

    var tweetReferenceAreaDiv = $(this).siblings('.grad-item').find('.twitter-reaction-area');
    var fromIdx = tweetReferenceAreaDiv.children('.twitter-tweet').length;
    var additionalTweets = $(this).data('read-more-tweet-ids').slice(fromIdx, fromIdx + ADD_TWEETS_NUM_PER_READ_MORE);
    var gradIdx = $(this).siblings('.grad-item').data('grad-idx');
    var productInfoEle = $(this).parents('.product-block').find('.product-info');

    // set button text to 'loading'
    setButtonLoading(readMoreButtonEle);

    // set productinfo sticy
    productInfoEle.css('position', 'sticky');

    if (_.isEmpty(additionalTweets) || (!readMoreButtonEle.data('is-open') && readMoreButtonEle.data('is-ever-opened'))) {
      afterLoadTweets(tweetReferenceAreaDiv);
      return;
    }

    _.each(additionalTweets, function (tweet) {
      var html = sprintf(
        '<blockquote class="twitter-tweet" data-lang="ja"> <a href="https://twitter.com/%s/status/%s"></a></blockquote>',
        tweet[0], // screen name
        tweet[1], // tweet id
      );

      tweetReferenceAreaDiv.append(html);
    });

    twttr.widgets.load();

    tweetReferenceAreaDiv.css('height', tweetReferenceAreaDiv.height());
    gradEleTempHeightHash[gradIdx] = tweetReferenceAreaDiv.height();
  });
}

function adjustTwitterReactionAreaHeightForInit(area, isAutoClose) {
  var productInfoAreaHeight = Math.min(area.parents('.product-block').find('.product-info-block').height(), 250);
  var bookCaption = area.parents('.grad-item').find('.book-caption');
  var bookCaptionHeight = bookCaption[0] && bookCaption.data('is-open') ? bookCaption.height() : 0;

  if (isAutoClose) {
    var adjustPositionY = window.scrollY - (area.height() - productInfoAreaHeight) + 27;
    disableStickyHeaderTemporarily = true;

    // NOTE: chrome's scrollTo needs delay to work properly
    setTimeout(function() {
      scrollTo(window.scrollX, adjustPositionY + bookCaptionHeight);
      area.css('height', productInfoAreaHeight);
    }, 1);
    return;
  }

  area.css('height', productInfoAreaHeight);
}

function initEmbeddedTweets() {
  window.twttr = (function (d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0],
      t = window.twttr || {};
    if (d.getElementById(id)) return t;
    js = d.createElement(s);
    js.id = id;
    js.src = "https://platform.twitter.com/widgets.js";
    fjs.parentNode.insertBefore(js, fjs);

    t._e = [];
    t.ready = function (f) {
      t._e.push(f);
    };

    return t;
  }(document, "script", "twitter-wjs"));

  twttr.ready(function (twttr) {
    twttr.events.bind('loaded', function (event) {
      if (isFirstTwitterWigetsLoad) {
        // hide medias
        _.each(event.widgets, function(w) {
          var shadowRoot = w.shadowRoot;
          controlEmbeddedTweetMedia(shadowRoot, 'hide');
        });

        // display read-more button
        $('.grad-trigger').css({
          visibility: 'visible',
        });

        if (!isAdmin) {
          initGradElementsHeight();
        }

        $('.twitter-reaction-loading').remove();
        $('.grad-wrap').css('visibility', 'visible');
        $('.tweet-references').css('height', '100%');

        isFirstTwitterWigetsLoad = false;
        return;
      }

      updatedGradElements = _.chain(event.widgets)
        .map(function (e) {
          return e.parentElement;
        })
        .uniq()
        .map(function (e) {
          return $(e);
        })
        .value();

      _.each(updatedGradElements, function(gradEle) {
        afterLoadTweets(gradEle);
      });

      console.log("load process finished")
    });

    twttr.events.bind('rendered', function (event) {
      var tgt = event.target;
      $(tgt.shadowRoot).find(".EmbeddedTweet").css({
        // "border":"30px solid black",
        // "border-radius":"7px",
        "width": "100%",
        "max-width": "100%",
      });

      $(tgt.shadowRoot).find(".EmbeddedTweet-tweet").css({
        "padding": "5px",
        "border-top-width": "1px",
        "border-bottom-width": "1px",
        // "border-bottom": "solid",
        "border-radius": "1px",
      });

      $(tgt.shadowRoot).find(".CallToAction").css({
        "padding": "5px",
      });

      $(tgt.shadowRoot).find(".Tweet-body").css({
        "margin-top": "0px",
      });

      $(tgt.shadowRoot).find(".CallToAction").css({
        "display": "none",
      });

      $(tgt.shadowRoot).find(".Icon--twitter").css({
        "display": "none",
      });

    });
  });
}

function setButtonLoading(button) {
  button.addClass('disabled');
  button.html('<span class="spinner-border" role="status" aria-hidden="true"></span> 読み込み中...');
}

function setButtonReset(button) {
  button.removeClass('disabled');
  button.html('<div class="relative"><p class="caption-btn-text">続きを読む</p><i class="fas fa-angle-down fa-lg accordion-icon"></i></div>');
}

function isOutOfView(e) {
  var target = $(e);
  var scrollTop = $(window).scrollTop();
  var scrollBottom = scrollTop + $(window).height();
  var targetTop = target.offset().top;
  var targetBottom = targetTop + target.height();

  return !(scrollBottom > targetTop && scrollTop < targetBottom);
}

function controlEmbeddedTweetMedia(shadowRoot, command) {
  var e = $(shadowRoot);
  var mediaCard = e.find('.MediaCard');
  var infoCircle = e.find('.tweet-InformationCircle--top');

  switch (command) {
    case 'hide':
      mediaCard.hide();
      infoCircle.hide();
      break;
    case 'show':
      mediaCard.show();
      infoCircle.show();
      break;
    default:
      throw new Error('unknown control command');
  }
}

function afterLoadTweets(tweetReferenceAreaDiv) {
  var readMoreButtonEle = tweetReferenceAreaDiv.parents('.grad-wrap').find('.grad-trigger');
  var addHeight = tweetReferenceAreaDiv.prop('scrollHeight');

  var tweetsListDiv = readMoreButtonEle.siblings('.grad-item');
  var remainingTweetsNum = readMoreButtonEle.data('read-more-tweet-ids').length - tweetsListDiv.find('.twitter-reaction-area').children('.twitter-tweet').length;

  readMoreButtonEle.data('is-open', true);
  readMoreButtonEle.data('is-ever-opened', true);

  if (remainingTweetsNum <= 0) {
    readMoreButtonEle.hide();
    tweetsListDiv.addClass('remove-gradient');
  }

  setButtonReset(readMoreButtonEle);

  tweetReferenceAreaDiv.children('.mosaic-tweet-list-img').remove();

  tweetReferenceAreaDiv.css('height', gradEleTempHeightHash[tweetReferenceAreaDiv.data('grad-idx')]);
  tweetReferenceAreaDiv.animate({height: addHeight}, 1000, 'swing', function () {
    tweetReferenceAreaDiv.css('height', '100%');
  });

  // show hidden media cards
  _.each(tweetsListDiv.children(), function(c) {
    var shadowRoot = c.shadowRoot;
    controlEmbeddedTweetMedia(shadowRoot, 'show');
  });

  updatedGradElements = [];
}
