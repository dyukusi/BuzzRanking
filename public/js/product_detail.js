const $ = jQuery = require('jquery');
const _ = require('underscore');
const Chart = require('chart.js');
const Moment = require('moment');
const MyUtil = require('./util.js');
const sprintf = require('sprintf-js').sprintf;
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

var TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX = $(window).height();
var TWEET_NUM_PER_CHUNK = 10;
var productId = Number(location.pathname.replace('/product/detail/', '').replace(/\?.*/, ''));
var pahToAdHTML = location.origin + '/ad/adsense/in_feed.html';
var tempYear = 0;
var isFirstChartRender = true;
var isLoaded = false;
var tweetDataList = [];

$(async () => {
  initBuzzChart();
  await initTwitterWidget();
  await fetchTweetDataListWithAjax();

  loadChunkTweets(true);
  initTweetReadMoreButton();
});

function initTweetReadMoreButton() {
  $('.readmore-button').on('click', function () {
    var button = $(this);

    $('.related-tweet-area').css('height', sprintf('%dpx', $('.related-tweet').height()));
    button.addClass('disabled');
    button.html('<span class="spinner-border" role="status" aria-hidden="true"></span>');

    isLoaded = false;
    loadChunkTweets();
  });
}

function loadChunkTweets(isFirstLoad) {
  var targetTweetDataList = tweetDataList.splice(0, TWEET_NUM_PER_CHUNK);
  var relatedTweetDivElement = $('.related-tweet');
  var adsenseIndex = TWEET_NUM_PER_CHUNK / 2;
  var tweetBlockquotesHTML = '';

  if (isFirstLoad && _.isEmpty(tweetDataList)) {
    $('#tweet-not-found').removeClass('invisible');
    $('.related-tweet-area').remove();
    $('#tweet-list-load-spin').remove();
    return;
  }

  // add margin for readmore button
  $('.related-tweet-area').css('margin-bottom', sprintf('%dpx', ($('.readmore-button').height() / 2)));

  _.times(targetTweetDataList.length, n => {
    var tweetData = targetTweetDataList[n];
    tweetBlockquotesHTML += sprintf(
      '<div class="embedded-tweet">' +
      '<blockquote class="twitter-tweet" data-lang="ja" data-cards="">' +
      '<a href="https://twitter.com/9191919%s/status/%s">%s</a>' +
      '</blockquote>' +
      '<hr>' +
      '</div>'
      ,
      tweetData[0], tweetData[1], tweetData[2]
    );

    if (n == adsenseIndex) {
      tweetBlockquotesHTML += '<div class="ad"><div class="adsense-infeed"></div><hr></div>';
    }
  });

  var tweetBlockquotesChunkHTML = '<div class=tweet-chunk>' + tweetBlockquotesHTML + '</div>';
  relatedTweetDivElement.append(tweetBlockquotesChunkHTML);

  var tweetChunks = $('.tweet-chunk');
  _.each(tweetChunks, tweetChunk => {
    twttr.widgets.load(tweetChunk);
  });
}

async function fetchTweetDataListWithAjax() {
  tweetDataList = await $.ajax({
    url: MyUtil.getLocationOrigin() + '/api/product/tweet_list',
    type: 'GET',
    dataType: 'json',
    data: {
      productId: productId,
    },
  });
}

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
        var isEmptyLoad = !$('.related-tweet').find('.embedded-tweet').length;
        if (isLoaded || isEmptyLoad) return;
        isLoaded = true;
      });

      twttr.events.bind('rendered', function (event) {
        var tgt = event.target;
        var isError = $(tgt).hasClass('twitter-tweet-error');
        var $chunk = $(tgt).parents('.tweet-chunk');
        var $embeddedTweet = $(tgt).parents('.embedded-tweet');

        if (!isError) {
          var embeddedTweetStyle = $('<link>').attr({
            'rel': 'stylesheet',
            'href': location.origin + '/css/embedded_tweet.css',
          });

          // triggered after render
          embeddedTweetStyle.bind('load', () => {
            $embeddedTweet.addClass('rendered');

            if (isAllRendered($chunk)) {
              afterAllRendered($chunk);
            }
          });

          $(tgt.shadowRoot).append(embeddedTweetStyle);
          return;
        }

        // tweet-error
        $embeddedTweet.addClass('rendered');
        if (isAllRendered($chunk)) {
          afterAllRendered($chunk);
        }
        return;

      });

      resolve();
    });
  });
}

function afterAllRendered($chunk) {
  $('.readmore-button').removeClass('display-none');
  $chunk.removeClass('tweet-chunk');
  $('#tweet-list-load-spin').remove();

  $('.related-tweet-area').animate({height: sprintf('%dpx', $('.related-tweet').height())}, 1000, 'swing', function () {
    $('.related-tweet-area').css('height', '100%');
    var $readMoreButton = $('.readmore-button');
    $readMoreButton.removeClass('disabled');
    $readMoreButton.html('<div class="relative"><p class="readmore-text">続きを読み込む</p><i class="fas fa-angle-down fa-lg readmore-icon"></i></div>');

    var adDivs = $('.related-tweet').find('.adsense-infeed');
    _.each(adDivs, adDiv => {
      var $adDiv = $(adDiv);
      $adDiv.load(pahToAdHTML);
      $adDiv.removeClass('adsense-infeed');
    });
  });

  // delete readmore button if no more tweets
  if (_.isEmpty(tweetDataList)) {
    $('.readmore-button').remove();
  }
}

function isAllRendered($chunk) {
  return _.every($chunk.find('.embedded-tweet'), embeddedTweet => {
    return $(embeddedTweet).hasClass('rendered');
  });
}

async function initBuzzChart() {
  var buzzChartData = await $.ajax({
    url: MyUtil.getLocationOrigin() + '/api/product/buzz_chart_data',
    type: 'GET',
    dataType: 'json',
    data: {
      productId: productId,
    },
  });

  if (!buzzChartData.xLabels.length || buzzChartData.xLabels.length == 1 && buzzChartData.buzzChartData[0] == 0) {
    $('#buzz-data-not-found').removeClass('invisible');
    $('#buzz-chart-load-div').remove();
    return;
  }

  // x date label for display
  var previousYear = null;
  var dispDateLabels = _.map(buzzChartData.xLabels, date => {
    var moment = new Moment(date);
    var formatStr = "MM/DD";
    if (previousYear != moment.year()) {
      formatStr = "YYYY/MM/DD";
    }
    previousYear = moment.year();

    return moment.format(formatStr);
  });
  dispDateLabels[dispDateLabels.length - 1] += '(暫定)';

  var ctx = document.getElementById('buzz-chart').getContext('2d');
  ctx.canvas.height = 300;
  // Chart.defaults.global.defaultFontFamily = 'cursive';
  // Chart.defaults.global.defaultFontStyle = 'bold';
  var buzzChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dispDateLabels,
      datasets: [{
        type: 'line',
        label: 'Buzz',
        data: buzzChartData.buzzChartData,
        borderColor: "#eb6f00",
        borderWidth: "2",
        pointBackgroundColor: "red",
        fill: false,
        yAxisID: "y-axis-buzz",
        spanGaps: true,
        backgroundColor: "rgba(255,0,0,0.4)",
        legend: {
          position: 'bottom',
        },
      }, {
        type: 'bar',
        label: 'ツイート数',
        data: buzzChartData.tweetCountChartData,
        borderWidth: "2",
        borderColor: "#abdfff",
        backgroundColor: "#c3eeff",
        yAxisID: "y-axis-tweet-count",
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      "animation": {
        "duration": 1,
        "onComplete": function () {
          if (isFirstChartRender) {
            $('#buzz-chart-load-div').remove();
            $('#buzz-chart').show();
            isFirstChartRender = false;
          }

          var chartInstance = this.chart,
            ctx = chartInstance.ctx;

          ctx.font = Chart.helpers.fontString(
            Chart.defaults.global.defaultFontSize,
            Chart.defaults.global.defaultFontStyle,
            // 'bold',
            Chart.defaults.global.defaultFontFamily
          );

          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = 'blue';

          var tweetDataset = this.data.datasets.find((data) => {
            return data.label == 'ツイート数';
          });
          var meta = tweetDataset._meta[0];
          var tweetValues = tweetDataset.data;
          meta.data.forEach((bar, index) => {
            var data = tweetValues[index];
            ctx.fillText(data, bar._model.x, bar._model.y - 5);
          });
        }
      },
      hover: {
        animationDuration: 0,
      },
      responsive: true,
      legend: {
        display: true,
        labels: {
          fontColor: "black",
        },
      },
      scales: {
        xAxes: [
          {
            ticks: {
              fontColor: "black",
              fontSize: 14,
              maxRotation: 90,
              // minRotation: 90,
            },
            gridLines: {
              drawOnChartArea: false,
            },
          }
        ],
        yAxes: [{
          id: "y-axis-buzz",
          type: "linear",
          position: "left",
          ticks: {
            fontColor: "black",
            beginAtZero: true
            // max: 0.2,
            // stepSize: 0.1
            // min: 0,
            // fontStyle: "bold",
          },
          gridLines: {
            drawOnChartArea: false,
          },
        }, {
          id: "y-axis-tweet-count",
          type: "linear",
          position: "right",
          ticks: {
            display: false,
            max: _.max(buzzChartData.tweetCountChartData) + (_.max(buzzChartData.tweetCountChartData) / 10),
            beginAtZero: true,
            fontColor: "black",
          },
          gridLines: {
            drawOnChartArea: false,
          },
        }],
      },
    },
  });
}

// infinite scroll tweets load (deprecated function)
// function initLazyChunkLoad() {
//   var $tweetChunks = $('.tweet-chunk');
//   var initLoadTweetChunks = [$tweetChunks[0], $tweetChunks[1]];
//   _.each(initLoadTweetChunks, tweetChunk => {
//     chunkLoad(tweetChunk);
//   });
//
//   $(window).on('scroll', function () {
//     var $tweetChunks = $('.tweet-chunk');
//
//     $tweetChunks.each(function () {
//       if (isScrolledIntoView(this)) {
//         chunkLoad(this);
//       }
//     });
//
//   });
// }
//
// function chunkLoad(chunkEle) {
//   var $chunk = $(chunkEle);
//   twttr.widgets.load(chunkEle);
//   $chunk.removeClass('tweet-chunk');
//
//   var pahToAdHTML = location.origin + '/ad/adsense/in_feed.html';
//   var $adDiv = $chunk.find('.adsense-infeed')
//   $adDiv.load(pahToAdHTML);
//   $adDiv.removeClass('adsense-infeed');
//
// }
//
// function initTweetAndAdsenseLoad() {
//   var tweetChunks = $('.tweet-chunk');
//
//   var initLoadTweetChunks = [tweetChunks[0], tweetChunks[1]];
//   _.each(initLoadTweetChunks, tweetChunk => {
//     twttr.widgets.load(tweetChunk);
//     $(tweetChunk).removeClass('tweet-chunk');
//   });
// }
//
// function isScrolledIntoView(elem) {
//   var docViewTop = $(window).scrollTop();
//   var docViewBottom = docViewTop + $(window).height();
//   var eleTop = $(elem).offset().top;
//   var eleBottom = eleTop + $(elem).height();
//
//   return docViewBottom < eleTop && (eleTop - TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX) <= docViewBottom
//     || docViewTop > eleBottom && eleBottom + TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX >= docViewTop;
// }
// function loadChunkBACKUP() {
//   var tweetDataListChunk = tweetDataList.splice(0, 10);
//   var relatedTweetDivElement = $('.related-tweet');
//
//   _.each(tweetDataListChunk, tweetDataList => {
//     var tweetBlockquotesHTML = '';
//
//     _.each(tweetDataList, tweetData => {
//       tweetBlockquotesHTML += sprintf(
//         '<div class="embedded-tweet">' +
//         '<blockquote class="twitter-tweet" data-lang="ja" data-cards="">' +
//         '<a href="https://twitter.com/%s/status/%s">%s</a>' +
//         '</blockquote>' +
//         '<hr>' +
//         '</div>'
//         ,
//         tweetData[0], tweetData[1], tweetData[2]
//       );
//     });
//
//     var tweetBlockquotesChunkHTML = '<div class=tweet-chunk>' + tweetBlockquotesHTML + '<div class="adsense-infeed"></div><hr></div>';
//
//     relatedTweetDivElement.append(tweetBlockquotesChunkHTML);
//   });
//
//   $('#tweet-list-load-spin').remove();
// }
// function getMinAndMaxMoment(tweetCountLogData) {
//   var minMoment = new Moment(tweetCountLogData[0][0]);
//   floorMoment(minMoment);
//
//   var maxMoment = new Moment(_.last(tweetCountLogData)[0]);
//   maxMoment.set('date', maxMoment.date() + 1);
//   maxMoment.set('millisecond', 0);
//   maxMoment.set('second', 0);
//   maxMoment.set('minute', 0);
//   maxMoment.set('hour', 0);
//
//   return [minMoment, maxMoment];
// }
//
// function floorMoment(moment) {
//   moment.set('millisecond', 0);
//   moment.set('second', 0);
//   moment.set('minute', 0);
//   moment.set('hour', 0);
// }
// // --------------------------------------------------
