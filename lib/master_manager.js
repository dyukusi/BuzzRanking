const appRoot = require('app-root-path');
const cluster = require('cluster');
const memoryCache = require('memory-cache');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');;
const Poller = require(appRoot + '/lib/poller.js');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const Ranking = require(appRoot + '/models/ranking.js');
const Util = require(appRoot + '/lib/util.js');

var commandFunctionHash = {};
commandFunctionHash.productDataListRequestByStatId = async function(worker, params) {
  var statId = params.statId;
  var targetCacheKey = CacheKeyGenerator.generateRankedProductsCacheKeyByStatId(statId);

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
  var latestReleaseControlModel = await ReleaseControl.selectLatest();
  var targetMoment = latestReleaseControlModel.getMoment();
  var statModel = await Ranking.selectByRankingDate(targetMoment);
  var cacheKey = CacheKeyGenerator.generateRankedProductsCacheKeyByStatId(statModel.id);
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

  var productDataList = await Util.buildProductBundleIdIntoRelatedDataHashByProductBundleIds(sortedProductIds, {
    cacheKey: CacheKeyGenerator.generateRankedProductsCacheKeyByStatId(statModel.id),
  });

  console.log("Ranking object was successfully built!!! :) statId: " + statModel.id +  " date: " + statModel.rankingDate);

  buildLatestRankingPoller.poll();
});


// buildLatestRankingPoller.poll();


