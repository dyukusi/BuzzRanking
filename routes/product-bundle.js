const appRoot = require('app-root-path');
const __ = require('underscore');
const express = require('express');
const router = express.Router();
const Moment = require('moment');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const Ranking = require(appRoot + '/models/ranking.js');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');
const ReleaseControl = require(appRoot + '/models/release_control.js');
const CONST = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;

// router.get('/detail/:productBundleId', async function (req, res, next) {
//   var productBundleId = req.params.productBundleId;
//   var htmlCacheKey = CacheKeyGenerator.generateProductBundleDetailHTMLCacheKey(productBundleId);
//   var redis = CacheUtil.getRedisInstance();
//   var htmlCache = await redis.get(htmlCacheKey);
//
//   if (htmlCache && false) {
//     res.send(htmlCache);
//     return;
//   }
//
//   console.log("cache miss: " + htmlCacheKey);
//   var productData = await ProductUtil.loadProductDataByProductBundleId(productBundleId);
//   var productBundleModel = productData.productBundleModel;
//   var productModels = productData.productModels;
//   var productTypeBundleIdForAd = +__.chain(productModels)
//     .countBy(m => {
//       return m.getBelongedProductTypeBundleId();
//     })
//     .map((count, productTypeId) => {
//       return {count: count, productTypeBundleId: productTypeId,};
//     })
//     .max(data => {
//       return data.count;
//     })
//     .value().productTypeBundleId;
//
//   var latestReleaseControlModel = await ReleaseControl.selectLatest();
//
//   var [
//     twitterAltSearchWordModels,
//     sortedTweetModels,
//     rankingModels,
//     productTweetStatModels,
//     tweetCountLogModel,
//     adDataList,
//   ] = await Promise.all([
//     TwitterAlternativeSearchWord.selectByProductBundleIds([productBundleModel.id]),
//
//     ProductUtil.loadSortedTweetModelsByProductBundleId(productBundleModel.id),
//
//     Ranking.findAll({
//       where: {
//         productBundleId: productBundleModel.id,
//         date: {
//           [Op.lte]: latestReleaseControlModel.getMoment().format('YYYY-MM-DD'),
//         },
//       },
//     }),
//
//     ProductTweetStat.selectByProductBundleId(productBundleModel.id),
//
//     TweetCountLog.findOne({
//       where: {
//         productBundleId: productBundleModel.id,
//       },
//       order: [
//         ['created_at', 'DESC'],
//       ],
//     }),
//
//     (async () => {
//       var rankingModels = await Ranking.findAll({
//         where: {
//           date: latestReleaseControlModel.getMoment().format('YYYY-MM-DD'),
//           productTypeBundleId: productTypeBundleIdForAd,
//           productTypeId: CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL,
//         },
//         order: [
//           ['rank', 'ASC']
//         ],
//         limit: 3,
//       });
//
//       var [productDataList, productTweetStatModels] = await Promise.all([
//         Promise.all(__.map(rankingModels, m => {
//           return ProductUtil.loadProductDataByProductBundleId(m.productBundleId);
//         })),
//
//         Promise.all(__.map(rankingModels, m => {
//           return ProductTweetStat.findOne({
//             where: {
//               date: new Moment(m.date).format('YYYY-MM-DD'),
//               productBundleId: m.productBundleId,
//             },
//           })
//         })),
//       ]);
//
//       var result = [];
//       for (var i = 0; i < rankingModels.length; i++) {
//         result.push({
//           rankingModel: rankingModels[i],
//           productTweetStatModel: productTweetStatModels[i],
//           productData: productDataList[i],
//         });
//       }
//
//       return result;
//     })(),
//   ]);
//
//   // html cache
//   res.sendResponse = res.send;
//   res.send = (body) => {
//     redis.set(htmlCacheKey, body);
//     res.sendResponse(body);
//   };
//
//   res.render('product_bundle_detail', {
//     productData: productData,
//     rankingModels: rankingModels,
//     productTweetStatModels: productTweetStatModels,
//     tweetModels: sortedTweetModels,
//     twitterAltSearchModels: twitterAltSearchWordModels,
//     adDataList: adDataList,
//     tweetCountLogModel: tweetCountLogModel,
//     productTypeBundleIdForAd: productTypeBundleIdForAd,
//   });
// });
//

module.exports = router;
