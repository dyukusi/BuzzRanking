const $ = jQuery = require('jquery');
const _ = require('underscore');
const sprintf = require('sprintf-js').sprintf;
const Swiper = require('swiper');
const MyUtil = require('./util.js');

var TWEETS_LAZY_LOAD_OFFSET_HEIGHT_PX = $(window).height();
var TWEET_NUM_PER_CHUNK = 10;
// var productId = Number(location.pathname.replace('/product/detail/', '').replace(/\?.*/, ''));
var pahToAdHTML = location.origin + '/ad/adsense/in_feed.html';
var isLoaded = false;
var swiperProductInfoTable;
var swiperProductImages;

$(async () => {
  initSwiper();
  // initProductInfoListSlick();

  await initTwitterWidget();

  loadChunkTweets(true);
  initTweetReadMoreButton();
  initProductFilterButton();
  initAddAltSearchWordButton();

  // NOTE: amchart lib is loaded by CDN in html
  if (!_.isEmpty(chartDataList)) {
    am4core.ready(function () {
      initAmChart();
    });
  }
});

function initAddAltSearchWordButton() {
  var disbleButton = $button => {
    $button.addClass('disabled');
    $button.addClass('active');
    $button.html('<span class="spinner-border spinner-add-alt-search-word" role="status" aria-hidden="true"></span>');
  };

  var activateButton = $button => {
    $button.removeClass('disabled');
    $button.removeClass('active');
    $button.html('追加申請');
  };

  var changeRequestAcceptedButton = $button => {
    $button.addClass('disabled');
    $button.addClass('active');
    $button.html('申請完了');
  };

  var appendNewRegistrationRow = () => {
    var html = '<li><div class="d-inline-flex w-100"><input class="form-control input-add-alt-search-word" type="text" autocomplete="off" placeholder="略称, 別名を入力"><button class="btn common-button add-alt-search-word-button">追加申請</button></div></li>';

    $('#twitter-search-words-ul').append(html);
  };

  var addClickEvent = () => {
    $('.add-alt-search-word-button').on('click', async function () {
      var $button = $(this);
      var $input = $button.siblings('.input-add-alt-search-word');

      if ($button.hasClass('disabled')) return;
      disbleButton($button);

      var inputText = $input.val().trim();

      if (inputText.length <= 2) {
        window.alert('少なくとも2文字以上である必要があります。');
        activateButton($button);
        return;
      }

      var res = await $.ajax({
        url: MyUtil.getLocationOrigin() + '/api/add_twitter_alt_search_word',
        method: 'POST',
        data: {
          productBundleId: productBundleId,
          altSearchWord: inputText,
        },
      });

      // fail
      if (!res || !res.result) {
        window.alert('既に審査中の略称か、不適切な入力のため申請が却下されました。');
        activateButton($button);
      }
      // success
      else {
        window.alert('ご協力ありがとうございます！審査は通常3日以内に完了致します。\n申請が却下された場合でも通知は致しませんのでご了承下さい。');
        $input.prop('disabled', true);
        changeRequestAcceptedButton($button);
        appendNewRegistrationRow();
        addClickEvent();
      }
    });
  };

  addClickEvent();
}

function initProductFilterButton() {
  $('.product-filter-button').on('click', function () {
    var button = $(this);
    var previousActiveProductTypeBundleId = null;

    _.each($('.product-filter-button'), filterButton => {
      var $filterButton = $(filterButton);
      if ($filterButton.hasClass('active')) {
        previousActiveProductTypeBundleId = $filterButton.data('product-type-bundle-id')
      }
      $filterButton.removeClass('active');
    });

    button.addClass('active');
    var targetProductTypeBundleId = button.data('product-type-bundle-id');
    var isAll = !+targetProductTypeBundleId;

    if (previousActiveProductTypeBundleId == targetProductTypeBundleId) return;

    // update swiper process
    var filterSlide = (swiper, selector) => {
      _.each($(selector).find('.swiper-wrapper').children(), slideEle => {
        var $slide = $(slideEle);
        var productTypeBundleId = $slide.data('product-type-bundle-id');

        $slide.removeClass('swiper-slide');
        $slide.removeClass('swiper-slide-hide');

        if (isAll || targetProductTypeBundleId == productTypeBundleId) {
          $slide.addClass('swiper-slide');
          $slide.show();
        } else {
          $slide.addClass('swiper-slide-hide');
          $slide.hide();
        }
      });

      swiper.update();
      swiper.slideTo(0, 300, () => {
      });
    };

    filterSlide(swiperProductImages, '.swiper-product-images');
    filterSlide(swiperProductInfoTable, '.swiper-product-info-table');

    // update pagination
    // swiperProductImages.pagination.type = productNum >= 10 ? 'fraction' : 'bullets';
    // swiperProductImages.pagination.update();
    // debugger;
  });
}

function initSwiper() {
  swiperProductInfoTable = new Swiper('.swiper-product-info-table', {
    // initialSlide: 0, NOTE: see swiperProductImages's init function
    effect: 'fade',
    fadeEffect: {
      crossFade: true
    },
    speed: 300,
    // effect: 'fade',
    preventClicks: false,
    autoHeight: true,
    allowTouchMove: false,
  });

  swiperProductImages = new Swiper('.swiper-product-images', {
    initialSlide: initialSlideIndex || 0,
    speed: 300,
    watchOverflow: true,
    preventClicks: false,
    freeMode: true,
    freeModeSticky: true,
    slidesPerView: 'auto',
    centeredSlides: true,
    spaceBetween: 30,
    grabCursor: true,

    thumbs: {
      swiper: swiperProductInfoTable,
    },

    pagination: {
      el: '.swiper-pagination',
      // type: 'bullets',
      type: productNum >= 20 ? 'fraction' : 'bullets',
      clickable: true,
    },
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },
    on: {
      init: function () {
        swiperProductInfoTable.slideTo(initialSlideIndex || 0, 10, () => {
        });
      },
      slideChange: function () {
      },
    },
  });
}

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
  var hasTweets = !_.isEmpty(compactTweetInfoList);
  var targetTweetDataList = hasTweets ? compactTweetInfoList.splice(0, TWEET_NUM_PER_CHUNK) : [];
  var hasNextChunk = !_.isEmpty(compactTweetInfoList);
  var relatedTweetDivElement = $('.related-tweet');
  var adsenseIndex = TWEET_NUM_PER_CHUNK / 2;
  var tweetBlockquotesHTML = '';

  if (isFirstLoad && !hasTweets) {
    // $('#tweet-not-found').removeClass('invisible');
    // $('.related-tweet-area').remove();
    $('#tweet-list-load-spin').remove();
    return;
  }

  if (hasNextChunk) {
    // add margin for readmore button
    $('.related-tweet-area').css('margin-bottom', sprintf('%dpx', ($('.readmore-button').height() / 2)));
  }

  _.times(targetTweetDataList.length, n => {
    var tweetData = targetTweetDataList[n];
    tweetBlockquotesHTML += sprintf(
      '<div class="embedded-tweet">' +
      '<blockquote class="twitter-tweet" data-lang="ja" data-cards="">' +
      '<a href="https://twitter.com/%s/status/%s">%s</a>' +
      '</blockquote>' +
      (hasNextChunk ? '<hr>' : '') +
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

        if (isError) {
          // tweet-error
          $embeddedTweet.addClass('rendered');
          if (isAllRendered($chunk)) {
            afterAllRendered($chunk);
          }
          return;
        }

        var $tweetTextDivs = $(tgt.shadowRoot).find('.Tweet-text');

        if ($tweetTextDivs[0]) {
          _.each($tweetTextDivs, tweetTextDivEle => {
            var $tweetTextDiv = $(tweetTextDivEle);

            _.each(twitterSearchWords, word => {
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

        // triggered after render
        embeddedTweetStyle.bind('load', () => {
          $embeddedTweet.addClass('rendered');

          if (isAllRendered($chunk)) {
            afterAllRendered($chunk);
          }
        });

        $(tgt.shadowRoot).append(embeddedTweetStyle);

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
  if (_.isEmpty(compactTweetInfoList)) {
    $('.readmore-button').remove();
  }
}

function isAllRendered($chunk) {
  return _.every($chunk.find('.embedded-tweet'), embeddedTweet => {
    return $(embeddedTweet).hasClass('rendered');
  });
}

function initAmChart() {
  var chart = am4core.create("chartdiv", am4charts.XYChart);

  // lazyload
  am4core.options.onlyShowOnViewport = true;

  // temp data
  // chart.data = generateChartData();
  chart.data = chartDataList;
  chart.legend = new am4charts.Legend();
  chart.legend.position = 'top';
  chart.legend.markers.template.width = 15;
  chart.legend.markers.template.height = 15;


  var dateAxis = chart.xAxes.push(new am4charts.DateAxis());
  dateAxis.renderer.minGridDistance = 50;
  dateAxis.dateFormats.setKey("year", "yyyy年");

  dateAxis.dateFormats.setKey("month", "M月");
  dateAxis.periodChangeDateFormats.setKey("month", "M月");

  dateAxis.dateFormats.setKey("week", "d日");
  dateAxis.periodChangeDateFormats.setKey("week", "d日");

  dateAxis.dateFormats.setKey("day", "d日");
  dateAxis.periodChangeDateFormats.setKey("day", "yyyy年M月");

  dateAxis.dateFormats.setKey("weekday", "E曜日");

  // NOTE: SHOULD USE THIS OPTION WHEN CAUSING PERFORMANCE ISSUE
  // https://www.amcharts.com/docs/v4/concepts/performance/#Dynamic_data_item_grouping
  dateAxis.groupData = true;
  dateAxis.groupCount = 365;

  var tweetCountAxis = chart.yAxes.push(new am4charts.ValueAxis());
  tweetCountAxis.min = 0;
  tweetCountAxis.fontSize = "0.8rem";
  tweetCountAxis.title.text = "発信者数 / ツイート";
  tweetCountAxis.title.fontSize = "1rem";
  // tweetCountAxis.title.fontWeight = 'bold';
  // tweetCountAxis.renderer.labels.template.fill = am4core.color("#4098ff");
  tweetCountAxis.cursorTooltipEnabled = false;

  tweetCountAxis.renderer.labels.template.padding(0, 0, 0, 0);

  var buzzAxis = chart.yAxes.push(new am4charts.ValueAxis());
  buzzAxis.fontSize = "0.8rem";
  buzzAxis.min = 0;
  buzzAxis.cursorTooltipEnabled = false;
  buzzAxis.title.text = "Buzz";
  buzzAxis.title.fontSize = "1rem";
  // buzzAxis.title.fontWeight = "bold";
  buzzAxis.renderer.opposite = true;
  buzzAxis.renderer.grid.template.disabled = true;
  buzzAxis.renderer.labels.template.padding(0, 0, 0, 0);
  // buzzAxis.renderer.labels.template.disabled = true;
  // buzzAxis.renderer.labels.template.fill = am4core.color("#ce0829");
  // tweetCountAxis.renderer.baseGrid.disabled = true;

  var tweetCountPerDayChart = chart.series.push(new am4charts.ColumnSeries());
  tweetCountPerDayChart.name = "ツイート数";
  tweetCountPerDayChart.yAxis = tweetCountAxis;
  tweetCountPerDayChart.clustered = false;
  tweetCountPerDayChart.dataFields.valueY = "tweetCount";
  tweetCountPerDayChart.dataFields.dateX = "date";
  tweetCountPerDayChart.tooltipText = "{valueY} ツイート";
  tweetCountPerDayChart.tooltip.pointerOrientation = "vertical";
  // tweetCountPerDayChart.stroke = am4core.color('#65acff');
  // tweetCountPerDayChart.columns.template.width = am4core.percent(65);
  tweetCountPerDayChart.fill = am4core.color('#75c6ff');

  var userCountPerDayChart = chart.series.push(new am4charts.ColumnSeries());
  userCountPerDayChart.name = "発信者数";
  userCountPerDayChart.dataFields.valueY = "userCount";
  userCountPerDayChart.dataFields.dateX = "date";
  userCountPerDayChart.tooltipText = "{valueY} 人";
  userCountPerDayChart.tooltip.pointerOrientation = "vertical";
  userCountPerDayChart.yAxis = tweetCountAxis;
  userCountPerDayChart.clustered = false;
  // userCountPerDayChart.stroke = am4core.color('#65acff');
  userCountPerDayChart.fill = am4core.color('#4098ff');

  var buzzChart = chart.series.push(new am4charts.LineSeries());
  buzzChart.name = "Buzz";
  buzzChart.dataFields.valueY = "buzz";
  buzzChart.dataFields.dateX = "date";
  buzzChart.yAxis = buzzAxis;
  buzzChart.strokeWidth = 2;
  buzzChart.minBulletDistance = 10;
  buzzChart.tooltipText = "{valueY} Buzz";
  buzzChart.tooltip.getFillFromObject = false;
  buzzChart.tooltip.background.fill = am4core.color("#ce0829");
  // buzzChart.tooltip.pointerOrientation = "vertical";
  // buzzChart.tooltip.background.cornerRadius = 20;
  // buzzChart.tooltip.background.fillOpacity = 1; // NOTE: other values can cause performance issue
  // buzzChart.tooltip.label.padding(12, 12, 12, 12)
  buzzChart.stroke = am4core.color('red');

  chart.scrollbarX = new am4charts.XYChartScrollbar();
  chart.scrollbarX.parent = chart.bottomAxesContainer;
  chart.scrollbarX.series.push(buzzChart);

  chart.cursor = new am4charts.XYCursor();
  chart.cursor.xAxis = dateAxis;
  chart.cursor.snapToSeries = buzzChart;
}

// function generateChartData() {
//   var chartData = [];
//   var firstDate = new Date();
//   firstDate.setDate(firstDate.getDate() - 1000);
//   var visits = 1200;
//   for (var i = 0; i < 1000; i++) {
//     // we create date objects here. In your data, you can have date strings
//     // and then set format of your dates using chart.dataDateFormat property,
//     // however when possible, use date objects, as this will speed up chart rendering.
//     var newDate = new Date(firstDate);
//     newDate.setDate(newDate.getDate() + i);
//
//     visits += Math.round((Math.random() < 0.5 ? 1 : -1) * Math.random() * 10);
//
//     chartData.push({
//       date: newDate,
//       buzz: visits,
//       tweetCount: visits - getRandomInt(50),
//     });
//   }
//   return chartData;
// }
//
// function getRandomInt(max) {
//   return Math.floor(Math.random() * Math.floor(max));
// }

// async function fetchTweetDataListWithAjax() {
//   compactTweetInfoList = await $.ajax({
//     url: MyUtil.getLocationOrigin() + '/api/product/tweet_list',
//     type: 'GET',
//     dataType: 'json',
//     data: {
//       productId: productId,
//     },
//   });
// }

// async function initBuzzChart() {
//   var buzzStat = await $.ajax({
//     url: MyUtil.getLocationOrigin() + '/api/product/buzz_stat',
//     type: 'GET',
//     dataType: 'json',
//     data: {
//       productId: productId,
//     },
//   });
//
//   $('#buzz-stat-div').removeClass('hide');
//
//   if (!buzzStat.xLabels.length || buzzStat.xLabels.length == 1 && buzzStat.buzzChartData[0] == 0) {
//     $('#buzz-data-not-found').removeClass('display-none');
//     $('#buzz-chart-load-div').remove();
//     return;
//   }
//
//   // append rank history data
//   if (buzzStat.rankHistoryData) {
//     // latest history
//     var latestHistData = buzzStat.rankHistoryData.latest;
//     $('#rank-hist-table-body').append(
//       sprintf(
//         '<tr class="rank-hist-row">' +
//         '<td rowspan="2">直近</td>' +
//         '<td rowspan="2">%s</td>' +
//         '<td>%s</td>' +
//         '<td>%s位</td>' +
//         '</tr>',
//         new Moment(latestHistData.date).format("YYYY年MM月MM日"),
//         sprintf('<a href="/ranking/%s">%s</a>', productTypeBundleName, productTypeBundleNameJA),
//         latestHistData.categoryRank
//         // latestHistData.categoryProductCount || '??',
//       )
//     );
//
//     $('#rank-hist-table-body').append(
//       sprintf(
//         '<tr class="rank-hist-row">' +
//         '<td>%s</td>' +
//         '<td>%s位</td>' +
//         '</tr>',
//         sprintf('<a href="/ranking/%s">%s</a>', 'all', '総合'),
//         latestHistData.allRank
//       )
//     );
//
//     // peak history
//     var peakAllHistData = buzzStat.rankHistoryData.peak.category;
//     var peakCategoryHistData = buzzStat.rankHistoryData.peak.all;
//     $('#rank-hist-table-body').append(
//       sprintf(
//         '<tr class="rank-hist-row">' +
//         '<td rowspan="2">ピーク</td>' +
//         '<td>%s</td>' +
//         '<td>%s</td>' +
//         '<td>%s位</td>' +
//         '</tr>',
//         new Moment(peakAllHistData.date).format("YYYY年MM月MM日"),
//         sprintf('<a href="/ranking/%s">%s</a>', productTypeBundleName, productTypeBundleNameJA),
//         peakAllHistData.categoryRank
//       )
//     );
//
//     $('#rank-hist-table-body').append(
//       sprintf(
//         '<tr class="rank-hist-row">' +
//         '<td>%s</td>' +
//         '<td>%s</td>' +
//         '<td>%s位</td>' +
//         '</tr>',
//         new Moment(peakCategoryHistData.date).format("YYYY年MM月MM日"),
//         sprintf('<a href="/ranking/%s">%s</a>', 'all', '総合'),
//         peakCategoryHistData.allRank
//       )
//     );
//   }
//
//   // append check point texts
//   _.each(buzzStat.checkPointTexts, text => {
//     $('.buzz-chart-info-ul').append(sprintf(
//       '<li>%s</li>',
//       text
//     ));
//   });
//
//   // x date label for display
//   var previousYear = null;
//   var dispDateLabels = _.map(buzzStat.xLabels, date => {
//     var moment = new Moment(date);
//     var formatStr = "MM/DD";
//     if (previousYear != moment.year()) {
//       formatStr = "YYYY/MM/DD";
//     }
//     previousYear = moment.year();
//
//     return moment.format(formatStr);
//   });
//   dispDateLabels[dispDateLabels.length - 1] += '(暫定)';
//
//   var ctx = document.getElementById('buzz-chart').getContext('2d');
//   ctx.canvas.height = 300;
//   // Chart.defaults.global.defaultFontFamily = 'cursive';
//   // Chart.defaults.global.defaultFontStyle = 'bold';
//   var buzzChart = new Chart(ctx, {
//     type: 'bar',
//     data: {
//       labels: dispDateLabels,
//       datasets: [{
//         type: 'line',
//         label: 'Buzz',
//         data: buzzStat.buzzChartData,
//         borderColor: "#eb6f00",
//         borderWidth: "2",
//         pointBackgroundColor: "red",
//         fill: false,
//         yAxisID: "y-axis-buzz",
//         spanGaps: true,
//         backgroundColor: "rgba(255,0,0,0.4)",
//         legend: {
//           position: 'bottom',
//         },
//       }, {
//         type: 'bar',
//         label: 'ツイート数',
//         data: buzzStat.tweetCountChartData,
//         borderWidth: "2",
//         borderColor: "#abdfff",
//         backgroundColor: "#c3eeff",
//         yAxisID: "y-axis-tweet-count",
//       }]
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       "animation": {
//         "duration": 1,
//         "onComplete": function () {
//           if (isFirstChartRender) {
//             $('#buzz-chart-load-div').remove();
//             $('#buzz-chart').show();
//             isFirstChartRender = false;
//           }
//
//           var chartInstance = this.chart,
//             ctx = chartInstance.ctx;
//
//           ctx.font = Chart.helpers.fontString(
//             Chart.defaults.global.defaultFontSize,
//             Chart.defaults.global.defaultFontStyle,
//             // 'bold',
//             Chart.defaults.global.defaultFontFamily
//           );
//
//           ctx.textAlign = 'center';
//           ctx.textBaseline = 'bottom';
//           ctx.fillStyle = 'blue';
//
//           var tweetDataset = this.data.datasets.find((data) => {
//             return data.label == 'ツイート数';
//           });
//           var meta = tweetDataset._meta[0];
//           var tweetValues = tweetDataset.data;
//           meta.data.forEach((bar, index) => {
//             var data = tweetValues[index];
//             ctx.fillText(data, bar._model.x, bar._model.y - 5);
//           });
//         }
//       },
//       hover: {
//         animationDuration: 0,
//       },
//       responsive: true,
//       legend: {
//         display: true,
//         labels: {
//           fontColor: "black",
//         },
//       },
//       scales: {
//         xAxes: [
//           {
//             ticks: {
//               fontColor: "black",
//               fontSize: 14,
//               maxRotation: 90,
//               // minRotation: 90,
//             },
//             gridLines: {
//               drawOnChartArea: false,
//             },
//           }
//         ],
//         yAxes: [{
//           id: "y-axis-buzz",
//           type: "linear",
//           position: "left",
//           ticks: {
//             fontColor: "black",
//             beginAtZero: true
//             // max: 0.2,
//             // stepSize: 0.1
//             // min: 0,
//             // fontStyle: "bold",
//           },
//           gridLines: {
//             drawOnChartArea: false,
//           },
//         }, {
//           id: "y-axis-tweet-count",
//           type: "linear",
//           position: "right",
//           ticks: {
//             display: false,
//             max: _.max(buzzStat.tweetCountChartData) + (_.max(buzzStat.tweetCountChartData) / 10),
//             beginAtZero: true,
//             fontColor: "black",
//           },
//           gridLines: {
//             drawOnChartArea: false,
//           },
//         }],
//       },
//     },
//   });
// }
//

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


function initProductInfoListSlick() {
  $('.product-image-slider').slick({
    // initialSlide: 2,

    slidesToShow: 1,
    slidesToScroll: 1,
    // lazyLoad: 'ondemand',
    variableWidth: true,
    asNavFor: '.product-basic-info-slider',
    dots: false,
    arrows: false,
    focusOnSelect: true,
    centerMode: true,
    // centerPadding: '50px',
    // adaptiveHeight: true,
  });

  $('.product-basic-info-slider').slick({
    // initialSlide: 2,

    arrows: false,
    dots: true,
    adaptiveHeight: true,

    centerMode: true,
    slidesToShow: 1,
    slidesToScroll: 1,
    fade: true,
    asNavFor: '.product-image-slider'
  });
}
