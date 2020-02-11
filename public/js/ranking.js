const $ = jQuery = require('jquery');
const _ = require('underscore');
const sprintf = require('sprintf-js').sprintf;
const MyUtil = require('./util.js')
const isMobileDevice = 'ontouchstart' in window;
const Accordion = require('accordion').Accordion;
require('bootstrap');
require('readmore-js');

var INIT_TWEETS_NUM = isMobileDevice ? 2 : 3;
var ADD_TWEETS_NUM_PER_READ_MORE = 5;


$(async function () {
  initSimpleBuzzChartImage();

  await initTwitterWidget();
  initReadMoreButtons();
  initReadCaptionButton();

  _.each($('.tweet-reference-block'), tweetReferenceBlock => {
    loadChunkTweets($(tweetReferenceBlock));
  });

  if (isAdmin) {
    initAdminFunctions();
    initUpdateBelongedProductBundleAutoComplete();
  }

  // NOTE: this function doesn't work with touch scroll
  // if (!isMobileDevice && !isAdmin) {
  //   initAutoTweetsDivCloser();
  // }
});

async function initSimpleBuzzChartImage() {
  var productBundleIds = _.map($('.product-block'), productBlockEle => {
    return $(productBlockEle).data('product-bundle-id');
  });

  try {
    var productBundleIdIntoSimpleBuzzChartBase64ImageHash = await $.ajax({
      url: MyUtil.getLocationOrigin() + '/api/simple_buzz_chart',
      type: 'GET',
      dataType: 'json',
      data: {
        productBundleIds: productBundleIds,
      },
      timeout: 5000,
    });

    // set simple buzz chart base64 images
    _.each($('.product-block'), productBlockEle => {
      var $productBlock = $(productBlockEle);
      var $image = $productBlock.find('.simple-buzz-chart-img');
      var productBundleId = $productBlock.data('product-bundle-id');

      var base64 = productBundleIdIntoSimpleBuzzChartBase64ImageHash[productBundleId];
      if (!base64) {
        console.error('failed to fetch simple buzz chart img. product bundle id: ' + productBundleId);
        return;
      }

      $image.prop('src', base64);
    });
  } catch (e) {
    console.error(e);
    console.error('ERROR: failed to fetch simple buzz chart image');
  }
}

function adjustProductImageTopMargin() {
  var height = $('#header').height() - $('.navbar-brand').height() + 20;
  $('.product-info-block').css('top', height);
}

function initReadCaptionButton() {
  var acOptions = {
    onToggle: function (fold, isOpen) {
      if (isOpen) {
        $(fold.content).data('is-open', true)
        $(fold.accordion.el).css('max-height', $(fold.content).height() + 10);
        $(fold.accordion.el).find('.read-book-caption-button').hide();
      }
    },
  };

  _.each(document.querySelectorAll('.book-caption-accordion'), function (ac) {
    new Accordion(ac, acOptions);
  });
}

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
  $(".read-more-button").click(function () {
    var $readMoreButton = $(this);
    var $productBlock = $readMoreButton.parents('.product-block');
    var $productInfoBlock = $productBlock.find('.product-info-block');
    var $tweetReferenceBlock = $readMoreButton.parents('.tweet-reference-block');

    if ($readMoreButton.hasClass('disable')) return;

    // fix height while loading
    $tweetReferenceBlock.css('height', $tweetReferenceBlock.height() + 'px');

    // set button text to 'loading'
    setButtonLoading($readMoreButton);

    // set product image sticky
    $productInfoBlock.css({
      position: '-webkit-sticky',
      position: 'sticky',
    });

    loadChunkTweets($tweetReferenceBlock, true);
  });
}

function loadChunkTweets($tweetReferenceBlock, isOnClickReadMore) {
  var $productInfo = $tweetReferenceBlock.parents('.product-block').find('.product-info');
  var $readMoreButton = $tweetReferenceBlock.find('.read-more-button');
  var $twitterReactionArea = $tweetReferenceBlock.find('.twitter-reaction-area');
  var tweets = $readMoreButton.data('read-more-tweet-ids');
  var $loadedTweets = $tweetReferenceBlock.find('.twitter-tweet');
  var tweetFromIdx = $loadedTweets ? $loadedTweets.length : null;
  var addTweetNum = isOnClickReadMore ? ADD_TWEETS_NUM_PER_READ_MORE : INIT_TWEETS_NUM;
  var loadTargetTweets = tweets ? tweets.slice(tweetFromIdx, tweetFromIdx + addTweetNum) : [];

  if (_.isEmpty(loadTargetTweets)) return;

  // set productinfo sticy
  $productInfo.css('position', 'sticky');

  var embeddedTweetsHTML = '';
  _.each(loadTargetTweets, function (tweet) {
    embeddedTweetsHTML += sprintf(
      '<div class="embedded-tweet">' +
      '<blockquote class="twitter-tweet" data-lang="ja">' +
      '<a href="https://twitter.com/%s/status/%s"></a>' +
      '</blockquote>' +
      '<hr>' +
      '</div>',
      tweet[0], // screen name
      tweet[1], // tweet id
    );
  });

  $twitterReactionArea.append('<div class="tweet-chunk">' + embeddedTweetsHTML + '</div>');

  twttr.widgets.load($twitterReactionArea[0]);
}

function afterRederedAllTweetsInChunk($tweetReferenceBlock, $chunk) {
  var $productBlock = $tweetReferenceBlock.parents('.product-block');
  var $productInfoBlock = $productBlock.find('.product-info-block');
  var $twitterReactionArea = $tweetReferenceBlock.find('.twitter-reaction-area');
  var $readMoreButton = $tweetReferenceBlock.find('.read-more-button');
  var addHeight = $tweetReferenceBlock.prop('scrollHeight');
  var $tweetReferenceDiv = $tweetReferenceBlock.find('.grad-item');

  $chunk.addClass('rendered');

  // remove error tweets
  _.each($chunk.find('.embedded-tweet'), embeddedTweetEle => {
    var $embeddedTweet = $(embeddedTweetEle);
    if ($embeddedTweet.find('.twitter-tweet-error')[0]) {
      $embeddedTweet.remove();
    }
  });

  var tweets = $readMoreButton.data('read-more-tweet-ids');
  var loadedTweets = $twitterReactionArea.find('.twitter-tweet');
  var remainingTweetsNum = !!tweets ? tweets.length - loadedTweets.length : 0;
  var isFirstLoad = $twitterReactionArea.data('is-first-load');

  $readMoreButton.data('is-open', true);
  $readMoreButton.data('is-ever-opened', true);

  if (remainingTweetsNum <= 0) {
    $readMoreButton.hide();
    $tweetReferenceDiv.addClass('remove-gradient');
  }

  setButtonReset($readMoreButton);

  if (isFirstLoad) {
    $twitterReactionArea.data('is-first-load', false);

    var $firstTweet = $(loadedTweets[0]);
    // var initialHeight = Math.max($productInfoBlock.height(), $firstTweet.height()) + $readMoreButton.height() + 5;
    var initialHeight = Math.max($productInfoBlock.height(), $firstTweet.height() + $readMoreButton.height() + 5);
    $twitterReactionArea.css('height', initialHeight + 'px');
  } else {
    var tweetListAfterHeight = _.reduce($twitterReactionArea.find('.tweet-chunk'), (memo, chunkEle) => {
      var $chunk = $(chunkEle);
      return memo + $chunk.height();
    }, 0);

    $twitterReactionArea.animate({height: tweetListAfterHeight}, 1000, 'swing', function () {
      $twitterReactionArea.css('height', '100%');
    });
  }

  // show hidden media cards
  _.each($twitterReactionArea.children(), function (c) {
    var shadowRoot = c.shadowRoot;
    controlEmbeddedTweetMedia(shadowRoot, 'show');
  });

  // --- for first load ---
  $('.read-more-button').css({
    visibility: 'visible',
  });

  $('.twitter-reaction-loading').remove();
  $('.grad-wrap').css('visibility', 'visible');
  $('.tweet-reference-block').css('height', '100%');
  // ---------------------
}

function adjustTwitterReactionAreaHeightForInit(area, isAutoClose) {
  var productInfoAreaHeight = $(area.children('twitter-widget')[0]).height() + 25;
  var bookCaption = area.parents('.grad-item').find('.book-caption');
  var bookCaptionHeight = bookCaption[0] && bookCaption.data('is-open') ? bookCaption.height() : 0;

  if (isAutoClose) {
    var adjustPositionY = window.scrollY - (area.height() - productInfoAreaHeight) + 27;
    disableStickyHeaderTemporarily = true;

    // NOTE: chrome's scrollTo needs delay to work properly
    setTimeout(function () {
      scrollTo(window.scrollX, adjustPositionY + bookCaptionHeight);
      area.css('height', productInfoAreaHeight);
    }, 1);
    return;
  }

  area.css('height', productInfoAreaHeight);
}

async function initTwitterWidget() {
  return new Promise((resolve, reject) => {
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

        // if (isFirstTwitterWigetsLoad) {
        //   // hide medias
        //   _.each(event.widgets, function (w) {
        //     var shadowRoot = w.shadowRoot;
        //     controlEmbeddedTweetMedia(shadowRoot, 'hide');
        //   });
        //
        //   isFirstTwitterWigetsLoad = false;
        //   return;
        // }
      });

      twttr.events.bind('rendered', function (event) {
        var tgt = event.target;
        var $chunk = $(tgt).parents('.tweet-chunk');
        var $tweetReferenceBlock = $(tgt).parents('.tweet-reference-block');
        var $embeddedTweet = $(tgt).parents('.embedded-tweet');
        var $productTitle = $(tgt).parents('.product-block').find('.product-title');
        var productBundleId = $(tgt).parents('.product-block').data('product-bundle-id');
        var isError = $(tgt).hasClass('twitter-tweet-error');
        var afterCSSRenderProcessIfAllFinished = function () {
          // already called afterRederedAllTweetsInChunk function
          if ($chunk.hasClass('rendered')) return;

          if (isAllRendered($chunk)) {
            afterRederedAllTweetsInChunk($tweetReferenceBlock, $chunk);
          }
        };

        $embeddedTweet.addClass('rendered');

        if (isError) {
          afterCSSRenderProcessIfAllFinished();
          return;
        }

        var searchWords = productBundleIdIntoSearchWordsHash[productBundleId];

        var $tweetTextDivs = $(tgt.shadowRoot).find('.Tweet-text');
        if ($tweetTextDivs[0]) {
          _.each($tweetTextDivs, tweetTextDivEle => {
            var $tweetTextDiv = $(tweetTextDivEle);

            _.each(searchWords, word => {
              var modifiedHTML = $tweetTextDiv.html().replace(
                new RegExp("(" + word.trim() + ")(?!([^<]+)?>)", "gi"),
                targetStr => {
                  return '<span class="tweet-text-highlighted">' + targetStr + '</span>';
                }
              );
              $tweetTextDiv.html(modifiedHTML);
            });
          });
        }

        var embeddedTweetStyle = $('<link>').attr({
          'rel': 'stylesheet',
          'href': location.origin + '/css/embedded_tweet.css',
        });

        // triggered after custom css render
        embeddedTweetStyle.bind('load', () => {
          afterCSSRenderProcessIfAllFinished();
        });

        $(tgt.shadowRoot).append(embeddedTweetStyle);
      });

      resolve('done!');
    });
  });
}

function isAllRendered($chunk) {
  return _.every($chunk.find('.embedded-tweet'), embeddedTweet => {
    return $(embeddedTweet).hasClass('rendered');
  });
}

function setButtonLoading(button) {
  button.addClass('disabled');
  button.html('<span class="spinner-border read-more-loading-spin" role="status" aria-hidden="true"></span> 読み込み中...');
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
