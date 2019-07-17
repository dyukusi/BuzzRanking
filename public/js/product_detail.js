const $ = jQuery = require('jquery');
const _ = require('underscore');
const Chart = require('chart.js');
const Moment = require('moment');

var tempYear = 0;

$(function() {
  initChart();
  initEmbeddedTweets();
});

function initChart() {
  var tweetCountLogData = $('#buzz-chart').data('chart-plots');

  if (_.isEmpty(tweetCountLogData)) return;

  var plots = _.map(tweetCountLogData, (data) => {
    var [createdAt, userCount] = data;
    var createdAtMoment = new Moment(createdAt);
    return {
      x: createdAtMoment.unix(),
      y: userCount,
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
        backgroundColor: 'orange',
        fill: false,
        lineTension: 0,
        borderWidth: 2,
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
            callback: unixTimeSec => {
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
          title: (tooltipItem, data) => { return ''; },
          label: (tooltipItem, data) => {
            var msec = tooltipItem.xLabel * 1000;
            var userCount = tooltipItem.yLabel;
            return '(' + new Moment(msec).format('YYYY年MM月DD日 HH:mm:ss') + ', ' + userCount + 'Buzz)';
          },
        },
      },

    },
  });
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
    twttr.events.bind('loaded', function (event) {});

    twttr.events.bind('rendered', function (event) {
      var tgt = event.target;
      $(tgt.shadowRoot).find(".EmbeddedTweet").css({
        "width": "100%",
        "max-width": "100%",
      });

      $(tgt.shadowRoot).find(".CallToAction").css({
        "display": "none",
      });

      $(tgt.shadowRoot).find(".EmbeddedTweet-tweet").css({
        "border-bottom-style": "solid",
        "border-bottom-width": "1px",
        "border-bottom-color": "rgb(225, 232, 237)",
        "border-bottom-right-radius": "4px",
        "border-bottom-left-radius": "4px",
      });
    });
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
