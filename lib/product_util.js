const appRoot = require('app-root-path');
const __ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const Moment = require('moment');

const Util = require(appRoot + '/lib/util.js');
const CacheUtil = require(appRoot + '/lib/cache_util.js');
const CacheKeyGenerator = require(appRoot + '/lib/cache_key_generator.js');
const MemoryCache = require('memory-cache');
const Tweet = require(appRoot + '/models/tweet.js');
const TweetUtil = require(appRoot + '/lib/tweet_util.js');

const sequelize = require(appRoot + '/db/sequelize_config');
const Book = require(appRoot + '/models/book');
const Game = require(appRoot + '/models/game');
const WebService = require(appRoot + '/models/web_service');
const Anime = require(appRoot + '/models/anime');
const Movie = require(appRoot + '/models/movie');
const ProductBundle = require(appRoot + '/models/product_bundle');
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');
const StatData = require(appRoot + '/models/stat_data.js');
const Ranking = require(appRoot + '/models/ranking.js');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');


function getAllProductModelClass() {
  return [
    Book,
    Game,
    Anime,
    Movie,
    WebService,
  ];
}

async function selectProductModels(where = {}, options = {}) {
  var queryOption = __.extend({
    where: where,
  }, options);

  var productModels = __.flatten(
    await Promise.all(
      __.map(getAllProductModelClass(), Model => {
        return Model.findAll(queryOption);
      })
    )
  );

  return productModels;
}

async function selectValidProductModels(where = {}) {
  var productModels = await selectProductModels(where);
  var validProductModels = __.filter(productModels, m => {
    return m.isValid();
  });
  return validProductModels;
}

async function buildProductBundleIdIntoRelatedDataHashByStatId(statId, options = {}) {
  var statDataModels = await StatData.selectByStatId(statId);
  var productBundleIds = __.map(statDataModels, m => {
    return m.productBundleId;
  });
  var productBundleIdIntoStatDataHash = __.indexBy(statDataModels, m => {
    return m.productBundleId;
  });

  return await buildProductBundleIdIntoRelatedDataHashByProductBundleIds(productBundleIds, __.extend(options, {
    _productBundleIdIntoStatDataHash: productBundleIdIntoStatDataHash,
  }));
}

async function loadProductDataByProductId(productId) {
  var productModel = (await selectProductModels({
    productId: productId,
  }))[0];

  var productBundleId = productModel.productBundleId;
  return await loadProductDataByProductBundleId(productBundleId);
}

async function loadProductDataHashByProductBundleIds(productBundleIds, options = {}) {
  var productDataHash = {};
  for (var i = 0; i < productBundleIds.length; i++) {
    var productBundleId = productBundleIds[i];
    var productData = await loadProductDataByProductBundleId(productBundleId, options);
    productDataHash[productBundleId] = productData;
  }
  return productDataHash;
}

async function loadProductDataByProductBundleId(productBundleId, options) {
  options = options || {};

  var cacheKey = CacheKeyGenerator.generateProductDataCacheKey(productBundleId);
  var redis = CacheUtil.getRedisInstance();
  var rawCache = await redis.get(cacheKey);

  if (rawCache && !options.ignoreCache) {
    var cachedProductData = JSON.parse(rawCache);
    cachedProductData.productBundleModel = new ProductBundle(cachedProductData.productBundleModel);

    cachedProductData.productModels = __.map(cachedProductData.productModels, rawProductModel => {
      var ProductClass = sequelize.models[rawProductModel._productClassName];
      return new ProductClass(rawProductModel);
    });

    return cachedProductData;
  }

  console.log('product data cache miss. productBundleId: ' + productBundleId);

  var productBundleModel = await ProductBundle.selectById(productBundleId);

  var productModels;
  if (options.includeAllProduct) {
    productModels = await selectProductModels({
      productBundleId: productBundleId,
    });
  } else {
    productModels = await selectValidProductModels({
      productBundleId: productBundleId,
    });
  }

  var productModelsSortedByReleaseDateDesc = __.sortBy(productModels, m => {
    return -1 * m.getReleaseDateMoment().unix(); // desc
  });

  var productData = {
    productBundleModel: productBundleModel,
    productModels: __.map(productModelsSortedByReleaseDateDesc, productModel => {
      productModel.setDataValue('_productClassName', productModel._modelOptions.name.singular);
      return productModel;
    }),
  };

  redis.set(cacheKey, JSON.stringify(productData));

  return productData;
}

async function loadSortedTweetModelsHashByProductBundleIds(productBundleIds, options = {}) {
  var sortedTweetModelsHash = {};
  for (var i = 0; i < productBundleIds.length; i++) {
    var productBundleId = productBundleIds[i];
    var sortedTweetModels = await loadSortedTweetModelsByProductBundleId(productBundleId, options);
    sortedTweetModelsHash[productBundleId] = sortedTweetModels;
  }
  return sortedTweetModelsHash;
}

async function loadSortedTweetModelsByProductBundleId(productBundleId, options = {}) {
  var cacheKey = CacheKeyGenerator.generateSortedTweetModelsCacheKey(productBundleId);
  var redis = CacheUtil.getRedisInstance();
  var rawCache = await redis.get(cacheKey);

  if (rawCache && !options.ignoreCache) {
    var cachedTweetModels = JSON.parse(rawCache);
    var tweetModels = __.map(cachedTweetModels, rawTweetModel => {
      return new Tweet(rawTweetModel);
    });

    return tweetModels;
  }

  console.log('sorted tweet models cache miss. productBundleId: ' + productBundleId);

  var [productData, tweetModels, isBlockedTwitterUserByScreenNameHash] = await Promise.all([
    loadProductDataByProductBundleId(productBundleId),
    Tweet.selectLatestTweetsOfEachProductBundleId([productBundleId], CONST.CACHE_TWEET_NUM),
    BlockTwitterUser.selectAllAndCreateScreenNameIntoBlockTwitterUserModelHash(),
  ]);

  var sortedTweetModels = await TweetUtil.sortAndFilterTweetModels(tweetModels, {
    productBundleModel: productData.productBundleModel,
    limitNumAfterModify: 100,
    prioritizeFirstAppearUserTweet: true,
    deprioritizeBlockedUser: true,
    isBlockedTwitterUserByScreenNameHash: isBlockedTwitterUserByScreenNameHash,
    deprioritizeContainsSpecificWordsInText: true,
    prioritizeContainProductNameInText: true,
    deprioritizeByNewLineCharCount: 9,
  });

  redis.set(cacheKey, JSON.stringify(sortedTweetModels));

  return sortedTweetModels;
}

async function buildProductBundleIdIntoRelatedDataHashByProductBundleIds(productBundleIds, options = {}) {
  var productBundleIdIntoStatDataHash = options._productBundleIdIntoStatDataHash || {};
  var productBundleModels = await ProductBundle.selectByProductBundleIds(productBundleIds);
  var productBundleIdIntoModelHash = __.indexBy(productBundleModels, m => {
    return m.id;
  });

  console.log("fetching tweet models and misc");
  var selectNumPerGroup = options.selectTweetNumPerGroup || 300;
  var [tweetModels, isBlockedTwitterUserByScreenNameHash] = await Promise.all([
    Tweet.selectLatestTweetsOfEachProductBundleId(productBundleIds, selectNumPerGroup),
    BlockTwitterUser.selectAllAndCreateScreenNameIntoBlockTwitterUserModelHash(),
  ]);

  console.log("tweet num: " + tweetModels.length);
  var productBundleIdIntoTweetModelsHash = __.groupBy(tweetModels, m => {
    return m.productBundleId;
  });

  console.log("sorting and filtering tweet models");
  var productBundleIdIntoModifiedTweetModelsHash = {};
  for (var i = 0; i < productBundleIds.length; i++) {
    var productBundleId = productBundleIds[i];
    var tweetModels = productBundleIdIntoTweetModelsHash[productBundleId];
    var modifiedTweetModels = await TweetUtil.sortAndFilterTweetModels(tweetModels, {
      productBundleModel: productBundleIdIntoModelHash[productBundleId],
      limitNumAfterModify: 100,
      prioritizeFirstAppearUserTweet: true,
      deprioritizeBlockedUser: true,
      isBlockedTwitterUserByScreenNameHash: isBlockedTwitterUserByScreenNameHash,
      deprioritizeContainsSpecificWordsInText: true,
      prioritizeContainProductNameInText: true,
      deprioritizeByNewLineCharCount: 9,
    });

    productBundleIdIntoModifiedTweetModelsHash[productBundleId] = modifiedTweetModels;
  }

  console.log("building product data list");
  var productBundleIdIntoProductDataListHash = await (async () => {
    var productModels = await selectValidProductModels({
      productBundleId: productBundleIds,
    });

    var productBundleIdIntoProductModelsHash = __.groupBy(productModels, m => {
      return m.productBundleId;
    });

    var result = {};
    __.each(productBundleIds, productBundleId => {
      var productModels = productBundleIdIntoProductModelsHash[productBundleId];
      var productModelsSortedByReleaseDateDesc = __.sortBy(productModels, m => {
        return -1 * m.getReleaseDateMoment().unix(); // desc
      });

      var productDataList = __.map(productModelsSortedByReleaseDateDesc, productModel => {
        return {
          productModel: productModel,
          // NOTE: used for reconstruction instance since class data isn't preserved in JSON.stringify
          productClassName: productModel._modelOptions.name.singular,
        };
      });

      result[productBundleId] = productDataList;
    });

    return result;
  })();

  console.log("building result");
  var productBundleIdIntoRelatedDataHash = {};
  __.each(productBundleModels, productBundleModel => {
    productBundleIdIntoRelatedDataHash[productBundleModel.id] = {
      productBundleModel: productBundleModel,
      productDataList: productBundleIdIntoProductDataListHash[productBundleModel.id] || [],
      tweetModels: productBundleIdIntoModifiedTweetModelsHash[productBundleModel.id] || [],

      // optional
      statDataModel: productBundleIdIntoStatDataHash[productBundleModel.id] || null,
    };
  });

  console.log("done");

  return productBundleIdIntoRelatedDataHash;
}

async function loadSimpleRankingDataList(targetDateStr) {
  var cacheKey = CacheKeyGenerator.generateSimpleRankingDataListCacheKey(targetDateStr);
  var cache = MemoryCache.get(cacheKey);
  if (cache) return cache;

  console.log('cache miss: ' + cacheKey);

  var rankingModels = await Ranking.findAll({
    where: {
      date: targetDateStr,
      // productTypeBundleId: productTypeBundleIdForAd,
      productTypeId: CONST.PRODUCT_TYPE_NAME_TO_ID_HASH.ALL,
      rank: {
        [Op.lte]: 10,
      },
    },
    order: [
      ['rank', 'ASC']
    ],
  });

  var [productDataList, productTweetStatModels] = await Promise.all([
    Promise.all(__.map(rankingModels, m => {
      return loadProductDataByProductBundleId(m.productBundleId);
    })),

    Promise.all(__.map(rankingModels, m => {
      return ProductTweetStat.findOne({
        where: {
          date: new Moment(m.date).format('YYYY-MM-DD'),
          productBundleId: m.productBundleId,
        },
      })
    })),
  ]);

  var adDataList = [];
  for (var i = 0; i < rankingModels.length; i++) {
    adDataList.push({
      rankingModel: rankingModels[i],
      productTweetStatModel: productTweetStatModels[i],
      productData: productDataList[i],
    });
  }

  await MemoryCache.put(cacheKey, adDataList);

  return adDataList;
}

async function buildTwitterSearchWordsByProductBundleId(productBundleId) {
  var [productData, altSearchWordModels] = await Promise.all([
    await loadProductDataByProductBundleId(productBundleId),
    await TwitterAlternativeSearchWord.selectByProductBundleIds([productBundleId]),
  ]);

  var twitterAltSearchWords = __.chain(altSearchWordModels)
    .filter(m => {
      return m.isValid();
    })
    .map(m => {
      return m.searchWord;
    })
    .value();

  var candidateSearchWords = __.chain([
    productData.productBundleModel.name,
    twitterAltSearchWords,
  ])
    .flatten()
    .unique()
    .sortBy(word => {
      return word.length; // ASC
    })
    .value();

  // excluding waste words (ex... [AAAB, AAA, AAAC, ZZZ] => [AAA, ZZZ] )
  var containingHash = {};
  __.each(candidateSearchWords, a => {
    __.each(candidateSearchWords, b => {
      if (a == b) return;
      if (b.indexOf(a) != -1) {
        containingHash[b] = true;
      }
    });
  });

  var searchWords = __.chain(candidateSearchWords)
    .filter(word => {
      return !containingHash[word];
    })
    .sortBy(word => {
      return -1 * word.length; // DESC
    })
    .value();

  return searchWords;
}

async function buildProductBundleIdIntoSearchWordsHashByProductBundleIds(productBundleIds) {
  var productBundleIdIntoSearchWordsHash = {};

  await Promise.all(
    __.map(productBundleIds, productBundleId => {
      return new Promise(async (resolve, reject) => {
        var searchWords = await buildTwitterSearchWordsByProductBundleId(productBundleId);
        productBundleIdIntoSearchWordsHash[productBundleId] = searchWords;
        resolve();
      });
    })
  );

  return productBundleIdIntoSearchWordsHash;
}

async function makeProductBecomeIndependent(productId, productBundleName) {
  return sequelize.transaction(async function (tx) {
    var productModel = (await selectProductModels({
      productId: productId,
    }, {
      transaction: tx,
    }))[0];

    var oldProductBundleId = productModel.productBundleId;

    var newProductBundleId = productModel.productId;

    var existenceCheck = await ProductBundle.findAll({
      where: {
        id: newProductBundleId,
      },
      transaction: tx,
    });

    if (!__.isEmpty(existenceCheck)) {
      throw new Error('product bundle ' + newProductBundleId + ' exists already.');
    }

    var updatedProductModel = await productModel.update({
      productBundleId: newProductBundleId,
    }, {
      transaction: tx,
    });

    var createdProductBundleModel = await ProductBundle.create({
      id: newProductBundleId,
      name: productBundleName,
      isRankedWithoutBuzzThreshold: 0, // false
      validityStatus: CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.NORMAL,
    }, {
      transaction: tx,
    });

    await deleteBundleIfNoChilds(oldProductBundleId, {
      transaction: tx,
    });
  });
}

async function retrieveRelatedProductBundleIds(string) {
  // search protected bundle name including the string
  var productBundleIdRowsFromProductBundle = await sequelize.query(
    'SELECT id AS productBundleId FROM product_bundle WHERE validity_status IN (:validityStatusIds) AND ":str" REGEXP name',
    {
      replacements: {
        validityStatusIds: CONST.CAN_JOIN_VALIDITY_STATUS_IDS,
        str: string,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  if (!__.isEmpty(productBundleIdRowsFromProductBundle)) {
    return __.pluck(productBundleIdRowsFromProductBundle, 'productBundleId');
  }

  // search alt word including the string
  var productBundleIdRowsFromTwitterAltSearch = await sequelize.query(
    'SELECT product_bundle_id AS productBundleId FROM twitter_alternative_search_word WHERE validity_status IN (:validityStatusIds) AND ":str" REGEXP search_word',
    {
      replacements: {
        validityStatusIds: CONST.CAN_JOIN_VALIDITY_STATUS_IDS,
        str: string,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  if (!__.isEmpty(productBundleIdRowsFromTwitterAltSearch)) {
    var productBundleModels = await ProductBundle.findAll({
      where: {
        id: __.pluck(productBundleIdRowsFromTwitterAltSearch, 'productBundleId'),
      }
    });

    var productBundleIds = __.pluck(productBundleModels, 'id');

    if (!__.isEmpty(productBundleIds)) {
      return productBundleIds;
    }
  }

  // search similar name product bundle
  var similarProductBundleRows = await sequelize.query(
    "SELECT id AS productBundleId, name, MATCH (name) AGAINST(:commonString) AS score FROM product_bundle WHERE MATCH(name) AGAINST(:commonString) ORDER BY score DESC LIMIT 100;",
    {
      replacements: {
        commonString: string,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  );

  var relatedProductBundleIds = __.chain(similarProductBundleRows)
    .filter(row => {
      var formattedTitle = Util.formatProductName(row.name);
      var NLD = Util.calcNormalizedLevenshteinDistance(string, formattedTitle);

      return NLD <= 0.4;
    })
    .map(row => {
      return row.productBundleId;
    })
    .value();

  return relatedProductBundleIds || [];
}

async function deleteBundleIfNoChilds(productBundleId, options) {
  options = options || {};

  if (!productBundleId) return;

  var productModels = await selectProductModels({
    productBundleId: productBundleId,
  }, {
    transaction: options.transaction,
  });

  if (!__.isEmpty(productModels)) return;

  await ProductBundle.destroy({
    where: {
      id: productBundleId,
    },
    transaction: options.transaction,
  });
}

function updateBelongTargetProductBundle(productId, productBundleId) {
  return sequelize.transaction(async function (tx) {
    var productModel = (await selectProductModels({
      productId: productId,
    }, {
      transaction: tx,
    }))[0];

    var oldProductBundleId = productModel.productBundleId;

    var updatedProductModel = await productModel.update({
      productBundleId: productBundleId,
    }, {
      transaction: tx,
    });

    await deleteBundleIfNoChilds(oldProductBundleId, {
      transaction: tx,
    });
  });
}

function findDispProductModel(productModels) {
  var sortedProductModels = __.sortBy(productModels, m => {
    return -1 * m.getReleaseDateMoment().unix(); // DESC(newest order)
  });

  var dispProductModel = __.find(sortedProductModels, productModel => {
    var imageURL = productModel.getImageURL();
    if (imageURL && (imageURL.indexOf('noimage') != -1 || imageURL.indexOf('gif') != -1)) {
      return false;
    }

    return productModel.isNewReleasedProductByMoment(new Moment());
  });

  if (__.isEmpty(dispProductModel)) {
    dispProductModel = __.find(sortedProductModels, productModel => {
      // if (productModel.getProductClassName() != 'book') {
      //   return false;
      // }

      var imageURL = productModel.getImageURL();
      if (imageURL.indexOf('noimage') != -1 || imageURL.indexOf('gif') != -1) {
        return false;
      }

      return true;
    });
  }

  if (__.isEmpty(dispProductModel)) {
    dispProductModel = sortedProductModels[0];
  }

  return dispProductModel;
}

module.exports = {
  selectProductModels,
  selectValidProductModels,
  getAllProductModelClass,
  buildProductBundleIdIntoRelatedDataHashByProductBundleIds,
  buildProductBundleIdIntoRelatedDataHashByStatId,
  buildTwitterSearchWordsByProductBundleId,
  buildProductBundleIdIntoSearchWordsHashByProductBundleIds,
  loadSimpleRankingDataList,

  loadProductDataByProductBundleId,
  loadProductDataHashByProductBundleIds,
  loadProductDataByProductId,

  loadSortedTweetModelsByProductBundleId,
  loadSortedTweetModelsHashByProductBundleIds,

  findDispProductModel,
  updateBelongTargetProductBundle,
  makeProductBecomeIndependent,
  retrieveRelatedProductBundleIds,
  deleteBundleIfNoChilds,
};
