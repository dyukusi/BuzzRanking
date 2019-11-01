const $ = jQuery = require('jquery');
const _ = require('underscore');
const Chart = require('chart.js');
const Moment = require('moment');
const MyUtil = require('./util.js');
const sprintf = require('sprintf-js').sprintf;
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

var TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX = $(window).height();
var tempYear = 0;
var productId = Number(location.pathname.replace('/product/detail/', '').replace(/\?.*/, ''));

$(async () => {
  initChart();
  await initTwitterWidget();

  // NOTE: widget.js do load every embedded tweets in html after random msec. wait 1 sec to avoid load all tweets at same time,
  await sleep(1000);

  await initTweetList();
  initLazyChunkLoad();
});

function initLazyChunkLoad() {
  var $tweetChunks = $('.tweet-chunk');
  var initLoadTweetChunks = [$tweetChunks[0], $tweetChunks[1]];
  _.each(initLoadTweetChunks, tweetChunk => {
    chunkLoad(tweetChunk);
  });

  $(window).on('scroll', function () {
    var $tweetChunks = $('.tweet-chunk');

    $tweetChunks.each(function () {
      if (isScrolledIntoView(this)) {
        chunkLoad(this);
      }
    });

  });
}

function chunkLoad(chunkEle) {
  var $chunk = $(chunkEle);
  twttr.widgets.load(chunkEle);
  $chunk.removeClass('tweet-chunk');

  var pahToAdHTML = location.origin + '/ad/adsense/in_feed.html';
  var $adDiv = $chunk.find('.adsense-infeed')
  $adDiv.load(pahToAdHTML);
  $adDiv.removeClass('adsense-infeed');

}

function initTweetAndAdsenseLoad() {
  var tweetChunks = $('.tweet-chunk');

  var initLoadTweetChunks = [tweetChunks[0], tweetChunks[1]];
  _.each(initLoadTweetChunks, tweetChunk => {
    twttr.widgets.load(tweetChunk);
    $(tweetChunk).removeClass('tweet-chunk');
  });
}

function isScrolledIntoView(elem) {
  var docViewTop = $(window).scrollTop();
  var docViewBottom = docViewTop + $(window).height();
  var eleTop = $(elem).offset().top;
  var eleBottom = eleTop + $(elem).height();

  return docViewBottom < eleTop && (eleTop - TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX) <= docViewBottom
    || docViewTop > eleBottom && eleBottom + TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX >= docViewTop;
}

async function initTweetList() {
  var allTweetDataList = await $.ajax({
    url: MyUtil.getLocationOrigin() + '/api/product/tweet_list',
    type: 'GET',
    dataType: 'json',
    data: {
      productId: productId,
    },
  });

  allTweetDataList = _.first(allTweetDataList, 20);
  var tweetDataListChunks = _.chunk(allTweetDataList, 5);
  var relatedTweetDivElement = $('.related-tweet');

  _.each(tweetDataListChunks, tweetDataList => {
    var tweetBlockquotesHTML = '';

    _.each(tweetDataList, tweetData => {
      tweetBlockquotesHTML += sprintf(
        '<blockquote class="twitter-tweet" data-lang="ja" data-cards="">' +
        '<a href="https://twitter.com/%s/status/%s">%s</a>' +
        '</blockquote>',
        tweetData[0], tweetData[1], tweetData[2]
      );
    });

    var tweetBlockquotesChunkHTML = '<div class=tweet-chunk>' + tweetBlockquotesHTML + '<div class="adsense-infeed"></div> </div>';

    relatedTweetDivElement.append(tweetBlockquotesChunkHTML);
  });

  $('#tweet-list-load-spin').remove();
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
      twttr.events.bind('loaded', function (event) {
      });

      twttr.events.bind('rendered', function (event) {
        var tgt = event.target;
        var embeddedTweetStyle = $('<link>').attr({
          'rel': 'stylesheet',
          'href': location.origin + '/css/embedded_tweet.css',
        });
        $(tgt.shadowRoot).append(embeddedTweetStyle);
      });

      resolve();
    });
  });
}

function initChart() {
  var tweetCountLogData = $('#buzz-chart').data('chart-plots');

  if (_.isEmpty(tweetCountLogData)) return;

  var plots = _.map(tweetCountLogData, function (data) {
    var [createdAt, buzz] = data;
    var createdAtMoment = new Moment(createdAt);
    return {
      x: createdAtMoment.unix(),
      y: buzz,
    };
  });

  var firstMoment = new Moment(tweetCountLogData[0][0]);
  floorMoment(firstMoment);

  var [minMoment, maxMoment] = getMinAndMaxMoment(tweetCountLogData);

  var ctx = document.getElementById('buzz-chart').getContext('2d');
  var buzzChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        label: 'Buzz度推移',
        data: plots,
        pointRadius: 2,
        backgroundColor: 'orange',
        fill: false,
        lineTension: 0,
        borderWidth: 1,
        borderColor: 'red',
        // backgroundColor: [
        //   'rgba(255, 99, 132, 0.2)',
        //   'rgba(54, 162, 235, 0.2)',
        //   'rgba(255, 206, 86, 0.2)',
        //   'rgba(75, 192, 192, 0.2)',
        //   'rgba(153, 102, 255, 0.2)',
        //   'rgba(255, 159, 64, 0.2)'
        // ],
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      fill: false,
      scales: {
        xAxes: [{
          type: 'linear',
          position: 'bottom',
          ticks: {
            callback: function (unixTimeSec) {
              var moment = new Moment(unixTimeSec * 1000);
              var shouldAppendYearStr = false;
              var isFirst = moment.unix() == firstMoment.unix();

              if (isFirst || moment.year() != tempYear) {
                shouldAppendYearStr = true;
                tempYear = moment.year();
              }

              var msec = unixTimeSec * 1000;
              return new Moment(msec).format(shouldAppendYearStr ? 'YYYY年M月D日' : 'M月D日');
            },
            stepSize: 60 * 60 * 24, // 1 day
            min: minMoment.unix(),
            max: maxMoment.unix(),

            autoSkip: true,
            maxTicksLimit: 20 //値の最大表示数
          },

        }],
        yAxes: [{
          scaleLabel: {
            display: true,
            labelString: 'Buzz',
            fontSize: 18,
          },
          ticks: {
            beginAtZero: true
          }
        }],
      },

      tooltips: {
        callbacks: {
          title: function (tooltipItem, data) {
            return '';
          },
          label: function (tooltipItem, data) {
            var msec = tooltipItem.xLabel * 1000;
            var buzz = tooltipItem.yLabel;
            return '(' + new Moment(msec).format('YYYY年MM月DD日 HH:mm:ss') + ', ' + buzz + 'Buzz)';
          },
        },
      },

    },
  });
}

function getMinAndMaxMoment(tweetCountLogData) {
  var minMoment = new Moment(tweetCountLogData[0][0]);
  floorMoment(minMoment);

  var maxMoment = new Moment(_.last(tweetCountLogData)[0]);
  maxMoment.set('date', maxMoment.date() + 1);
  maxMoment.set('millisecond', 0);
  maxMoment.set('second', 0);
  maxMoment.set('minute', 0);
  maxMoment.set('hour', 0);

  return [minMoment, maxMoment];
}

function floorMoment(moment) {
  moment.set('millisecond', 0);
  moment.set('second', 0);
  moment.set('minute', 0);
  moment.set('hour', 0);
}
