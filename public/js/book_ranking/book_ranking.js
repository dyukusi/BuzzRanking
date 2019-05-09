const $ = jQuery = require('jquery');
const _ = require('underscore');
const sprintf = require('sprintf-js').sprintf;
const Liminous = require('luminous-lightbox').Luminous;
const Truncator = require('truncator').truncate;
var isFirstTwitterWigetsLoad = true;

require('bootstrap');
require('readmore-js');

var ADD_TWEETS_NUM_PER_READ_MORE = 5;
var gradEleTempHeightHash = {};
var updatedGradElements = [];

$(window).on('load', function() {
  // initGradElementsHeight();
});

$(() => {
  initEmbeddedTweets();
  initReadMoreButtons();
  initImageZoom();
  initCaptionTruncate();
  // initGradElementsHeight();
  //
  // TODO : fix scroll bar diff glitch
  // initAutoTweetsDivCloser();
});

function initGradElementsHeight() {
  var gradElements = _.map(document.querySelectorAll('.grad-item'), e => {
    return $(e);
  });

  _.each(gradElements, gradEle => {
    adjustGradEleHeightForInit(gradEle);
  });
}

function initCaptionTruncate() {
  _.each(document.querySelectorAll('.book-caption'), e => {
    e.truncator = Truncator(e, e.innerText, {line: 5, ellipsis: '...'});
  });
}

function initImageZoom() {
  _.each(document.querySelectorAll('.zoomable-image'), function (e) {
    var caption = $(e).parents('.product-block').data('book-caption');
    var options = caption ? {
      caption: '<p class="book-caption">' + caption + '</p>',
    } : {};

    new Liminous(e, {});
  });
}

function initAutoTweetsDivCloser() {
  $(window).scroll(function () {
    var openedProductBlockElements = _.filter($.find('.grad-item'), function (e) {
      var style = $(e).attr('style');
      if (!style) return;
      return style.match('height: 100%');
    });

    var outOfViewGradElements = _.filter(openedProductBlockElements, isOutOfView);

    _.each(outOfViewGradElements, function (e) {
      adjustGradEleHeightForInit($(e));
    });
  });
}

function initReadMoreButtons() {
  $(".grad-trigger").click(function () {
    var readMoreButtonEle = $(this);

    if (readMoreButtonEle.hasClass('disable')) return;

    var tweetsListDiv = $(this).siblings('.grad-item');
    var bookCaption = tweetsListDiv.siblings('.book-caption')[0];
    var truncator = bookCaption ? bookCaption.truncator : null;
    var fromIdx = tweetsListDiv.children('.twitter-tweet').length;
    var additionalTweets = $(this).data('read-more-tweet-ids').slice(fromIdx, fromIdx + ADD_TWEETS_NUM_PER_READ_MORE);
    var gradIdx = $(this).siblings('.grad-item').data('grad-idx');
    var productInfoEle = $(this).parents('.product-block').find('.product-info');

    // clear the book caption truncation
    if (truncator) {
      truncator.restoreText();
    }

    // set button text to 'loading'
    setButtonLoading(readMoreButtonEle);

    // set productinfo sticy
    productInfoEle.css('position', 'sticky');

    _.each(additionalTweets, function (tweet) {
      var html = sprintf(
        '<blockquote class="twitter-tweet" data-lang="ja"> <a href="https://twitter.com/%s/status/%s"></a></blockquote>',
        tweet[0], // screen name
        tweet[1], // tweet id
      );

      tweetsListDiv.append(html);
    });

    twttr.widgets.load();

    tweetsListDiv.css('height', tweetsListDiv.height());
    gradEleTempHeightHash[gradIdx] = tweetsListDiv.height();
  });
}

function adjustGradEleHeightForInit(gradEle) {
  var productInfos = gradEle.parents('.product-row-block').find('.product-info');
  var productInfoHeight = $(_.max(productInfos, e => {
    return $(e).height();
  })).height();

  var bookCaptionHeight = gradEle.siblings('.book-caption').height() || 0;

  gradEle.css('height', productInfoHeight - bookCaptionHeight);
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
        _.each(event.widgets, w => {
          var shadowRoot = w.shadowRoot;
          controlEmbeddedTweetMedia(shadowRoot, 'hide');
        });

        // display read-more button
        $('.grad-trigger').css({
          visibility: 'visible',
        });
        $('.twitter-reaction-loading').remove();

        initGradElementsHeight();

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

      _.each(updatedGradElements, gradEle => {
        var readMoreButtonEle = $(gradEle.siblings('.grad-trigger'));
        var addHeight = gradEle.prop('scrollHeight');

        var tweetsListDiv = readMoreButtonEle.siblings('.grad-item');;
        var remainingTweetsNum = readMoreButtonEle.data('read-more-tweet-ids').length - tweetsListDiv.children('.twitter-tweet').length;

        if (remainingTweetsNum > 0) {
          setButtonReset(readMoreButtonEle);
        } else {
          readMoreButtonEle.remove();
          tweetsListDiv.addClass('remove-gradient');
        }

        gradEle.children('.mosaic-tweet-list-img').remove();

        gradEle.css('height', gradEleTempHeightHash[gradEle.data('grad-idx')]);
        gradEle.animate({height: addHeight}, 1000, 'swing', function () {
          gradEle.css('height', '100%');
        });

        // show hidden media cards
        _.each(tweetsListDiv.children(), c => {
          var shadowRoot = c.shadowRoot;
          controlEmbeddedTweetMedia(shadowRoot, 'show');
        });

        updatedGradElements = [];
      });

      console.log("load process finished")
    });

    twttr.events.bind('rendered', function (event) {
      var tgt = event.target;
      $(tgt.shadowRoot).find(".EmbeddedTweet").css({
        // "border":"30px solid black",
        // "border-radius":"7px",
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
    });
  });
}

function setButtonLoading(button) {
  button.addClass('disabled');
  button.html('<span class="spinner-border" role="status" aria-hidden="true"></span> 読み込み中...');
}

function setButtonReset(button) {
  button.removeClass('disabled');
  button.html('続きを読む');
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
