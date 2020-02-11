const $ = jQuery = require('jquery');
const _ = require('underscore');

$(function () {
  initTwitterWidget();
});

function initTwitterWidget() {
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
      twttr.events.bind('click', function (event) {
      });
      twttr.events.bind('tweet', function (event) {
      });

      twttr.events.bind('loaded', function (event) {
      });

      twttr.events.bind('rendered', function (event) {
        var tgt = event.target;
        var isError = $(tgt).hasClass('twitter-tweet-error');
        var $embeddedTweet = $(tgt).parents('.embedded-tweet');
        var productBundleId = $(tgt).parents('.contributed-tweet-div').data('product-bundle-id');

        if (isError) {
          // tweet-error
          $embeddedTweet.addClass('rendered');
        }

        if (productBundleId) {
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
        }

        var embeddedTweetStyle = $('<link>').attr({
          'rel': 'stylesheet',
          'href': location.origin + '/css/embedded_tweet.css',
        });

        // triggered after render
        embeddedTweetStyle.bind('load', () => {
          $embeddedTweet.addClass('rendered');
        });

        $(tgt.shadowRoot).append(embeddedTweetStyle);

        return;
      });

      resolve();
    });
  });
}
