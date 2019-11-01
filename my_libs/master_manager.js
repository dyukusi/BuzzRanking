const appRoot = require('app-root-path');
const cluster = require('cluster');
const memoryCache = require('memory-cache');
const cacheUtil = require(appRoot + '/my_libs/cache_util.js');
const Poller = require(appRoot + '/my_libs/poller.js');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Stat = require(appRoot + '/models/stat.js');
const StatData = require(appRoot + '/models/stat_data.js');
const Util = require(appRoot + '/my_libs/util.js');

var commandFunctionHash = {};
commandFunctionHash.productDataListRequestByStatId = async function(worker, params) {
  var statId = params.statId;
  var targetCacheKey = cacheUtil.generateProductDataListCacheKeyByStatId(statId);

  if (memoryCache.get(targetCacheKey)) {
    worker.send(memoryCache.get(targetCacheKey));
  } else {
    console.log("cache miss: " + targetCacheKey);
  }
}

async function requestFromWorker(message) {
  var worker =　cluster.workers[message.workerId];
  var targetFunction = commandFunctionHash[message.cmd];

  if (!targetFunction) {
    console.log("undefined request from worker: " + message.cmd);
    return;
  }

  await targetFunction(worker, message.params);
}

module.exports = {
  requestFromWorker: requestFromWorker,
}

// ----------- build latest product list polling ----------
var buildLatestRankingPoller = new Poller(3000);
buildLatestRankingPoller.onPoll(async () => {
  var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
  var targetMoment = latestReleaseControlModel.getDateMoment();
  var statModel = await Stat.selectByRankingDate(targetMoment);
  var cacheKey = cacheUtil.generateProductDataListCacheKeyByStatId(statModel.id);
  var productDataListCache = memoryCache.get(cacheKey);

  if (productDataListCache) return;

  console.log("building latest ranking object... statId: " + statModel.id +  " date: " + statModel.rankingDate);
  var statDataModels = await StatData.selectByStatId(statModel.id);
  var productIdIntoStatDataModelHash = __.indexBy(statDataModels, m => {
    return m.productId;
  });
  var sortedProductIds = __.chain(statDataModels)
    .sortBy(m => {
      return -1 * m.buzz;
    })
    .map(m => {
      return m.productId;
    })
    .value();

  var productDataList = await Util.buildProductDataListObject(sortedProductIds, {
    cacheKey: cacheUtil.generateProductDataListCacheKeyByStatId(statModel.id),
    tweetSelectOptions: {
      excludeInvalidTweets: true,
      since: targetMoment.subtract(3, 'day').format("YYYY-MM-DD"),
      until: targetMoment.add(1, 'day').format("YYYY-MM-DD"),
    },
  });

  console.log("Ranking object was successfully built!!! :) statId: " + statModel.id +  " date: " + statModel.rankingDate);

  buildLatestRankingPoller.poll();
});


// buildLatestRankingPoller.poll();


