const appRoot = require('app-root-path');
const __ = require('underscore');
const ChartjsNode = require('chartjs-node');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const Moment = require('moment');

async function createSimpleBuzzChartImage(productBundleId) {
  var productTweetStatModels = await ProductTweetStat.findAll({
    where: {
      productBundleId: productBundleId,
      date: {
        [Op.gt]: new Moment().subtract(8, 'day').format('YYYY-MM-DD'),
      },
    },
  })

  var chartOption = createChartOption(productTweetStatModels);
  var chartNode = new ChartjsNode(300, 150);
  await chartNode.drawChart(chartOption);

  var base64Image = await chartNode.getImageDataUrl('base64');
  return base64Image;
}

function createChartOption(productTweetStatModels) {
  return {
    type: 'bar',
    data: {
      labels: __.map(productTweetStatModels, m => {
        return m.date;
      }),
      datasets: [
        {
          type: 'line',
          label: 'Buzz',
          borderWidth: 10,
          data: __.map(productTweetStatModels, m => {
            return m.buzz;
          }),
          borderColor : "rgba(254,97,132,0.8)",
          pointBackgroundColor: "rgba(254,97,132,0.8)",
          fill: false,
          yAxisID: "y-axis-buzz",
          spanGaps: true,
          backgroundColor: "rgba(255,0,0,0.4)",
          pointRadius: 0,
          // lineTension: 0,


          legend: {
            // position: 'bottom',
          },
        },
        {
          type: 'bar',
          label: 'ツイート数',
          data: __.map(productTweetStatModels, m => {
            return m.tweetCount;
          }),
          // borderColor : "rgba(54,164,235,0.8)",
          backgroundColor : "#9fd1ff",
          yAxisID: "y-axis-tweet-count",
          pointRadius: 0,
        },
      ]
    },
    options: {
      responsive: true,
      legend: {
        display: false,
        // labels: {
        //   fontSize: 20,
        //   fontColor: "black",
        //   fontStyle: "bold",
        // },
      },
      scales: {
        xAxes: [
          {
            ticks: {
              display: false,
            },
            gridLines: {
              display: false,
              lineWidth: 0,
              drawOnChartArea: false,
            },
          },
        ],
        yAxes: [{
          id: "y-axis-buzz",
          type: "linear",
          position: "left",
          ticks: {
            beginAtZero: true,
            display: false,
          },
          gridLines: {
            display: false,
            lineWidth: 0,
            drawOnChartArea: false,
          },
        }, {
          id: "y-axis-tweet-count",
          type: "linear",
          position: "right",
          ticks: {
            beginAtZero: true,
            display: false,
          },
          gridLines: {
            display: false,
            lineWidth: 0,
            drawOnChartArea: false,
          },
        }],
      },
    },
  };
}

module.exports = {
  createSimpleBuzzChartImage: createSimpleBuzzChartImage,
};
