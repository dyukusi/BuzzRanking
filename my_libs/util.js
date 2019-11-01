const appRoot = require('app-root-path');
const __ = require('underscore');
const sequelize = require(appRoot + '/db/sequelize_config');
const FastLevenShtein = require('fast-levenshtein');
const Moment = require('moment');
const CONST = require(appRoot + '/my_libs/const.js');
const NewTweet = require(appRoot + '/models/new_tweet'); // TEMP
const BlockTwitterUser = require(appRoot + '/models/block_twitter_user');
const BookCaption = require(appRoot + '/models/book_caption.js');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

function checkIsEnglishOnlyString(text) {
  for (var i = 0; i < text.length; i++) {
    if (256 <= text.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function checkSearchWordValidity(word) {
  var isEnglishStr = checkIsEnglishOnlyString(word);
  if (!isEnglishStr) return true;
  if (5 <= word.length) return true;

  return false;
};

function isValidByStatus(s) {
  return __.contains(Const.VALID_STATUS_IDS, s);
}

function convertJapaneseDateStrIntoMysqlDate(japaneseDateStr) {
  var after = japaneseDateStr.replace('年', '-').replace('月', '-').replace('日', '');
  var pattern = /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/g;

  return after.match(pattern) ? after : '9999-12-31';
};

function convertDateObjectIntoMySqlReadableString(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1
  const d = date.getDate();
  const hour = date.getHours();
  const min = date.getMinutes();
  const sec = date.getSeconds();

  return y + '-' + m + '-' + d + ' ' + hour + ':' + min + ':' + sec;
}

function isAdminByReq(req) {
  var email = req.user ? req.user.email : null;
  return email == Config.admin_gmail_address;
}

// middle wares
function htmlCache(cacheDurationSec) {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      res.send(cachedBody)
      return
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        mcache.put(key, body, duration * 1000);
        res.sendResponse(body)
      }
      next()
    }
  };
}

async function selectProductModels(where) {
  let productModels = __.flatten(
    await Promise.all(
      __.map(CONST.PRODUCT_MODELS, Model => {
        return Model.findAll({
          where: where,
        });
      })
    )
  );

  return productModels;
}

async function buildProductDataListObject(sortedProductIds, options = {}) {
  console.log("build product data list process started \nfetching product models");
  var allProductModels = await selectProductModels({
    productId: sortedProductIds,
  });
  var productIdIntoProductModelHash = __.indexBy(allProductModels, model => {
    return model.productId;
  });
  console.log("product num: " + allProductModels.length);

  if (options.excludeInvalidProduct) {
    sortedProductIds = __.filter(sortedProductIds, productId => {
      var productModel = productIdIntoProductModelHash[productId];

      if (!productModel.isValid()) {
        console.log(productModel.productId + " is excluded. validityStatus: " + productModel.validityStatus);
      }

      return productModel.isValid();
    });
  }

  console.log("fetching tweet models and misc");
  var selectNumPerGroup = options.selectTweetNumPerGroup || 300;
  var [tweetModels, bookCaptionModels, blockTwitterUserModels] = await Promise.all([
    await NewTweet.selectLatestTweetsOfEachProductId(sortedProductIds, selectNumPerGroup),
    // await NewTweet.selectLatestTweetsOfEachProductId([sortedProductIds[0], sortedProductIds[1]], selectNumPerGroup),
    await BookCaption.selectByProductIds(sortedProductIds),
    await BlockTwitterUser.findAll()
  ]);
  console.log("tweet num: " + tweetModels.length);

  var productIdToTweetModelsHash = __.groupBy(tweetModels, m => {
    return m.productId;
  });
  var productIdIntoBookCaptionModelHash = __.indexBy(bookCaptionModels, m => {
    return m.productId;
  });
  var screenNameToBlockTwitterUserModelHash = __.indexBy(blockTwitterUserModels, m => {
    return m.screenName;
  });

  console.log("sorting and filtering tweet models");
  var productIdIntoModifiedTweetModelsHash = {};
  for (var i = 0; i < sortedProductIds.length; i++) {
    var productId = sortedProductIds[i];
    var tweetModels = productIdToTweetModelsHash[productId];
    var modifiedTweetModels = await sortAndFilterTweetModels(tweetModels, {
      productModel: productIdIntoProductModelHash[productId],
      limitNumAfterModify: 100,
      prioritizeFirstAppearUserTweet: true,
      deprioritizeBlockedUser: true,
      screenNameToBlockTwitterUserModelHash: screenNameToBlockTwitterUserModelHash,
      deprioritizeContainsSpecificWordsInText: true,
      prioritizeContainProductNameInText: true,
      deprioritizeByNewLineCharCount: 9,
    });

    productIdIntoModifiedTweetModelsHash[productId] = modifiedTweetModels;
  }

  console.log("building product data list");
  var productDataList = __.chain(sortedProductIds)
    .map(productId => {
      var productModel = productIdIntoProductModelHash[productId];
      var tweetModels = productIdIntoModifiedTweetModelsHash[productId];
      var bookCaptionModel = productIdIntoBookCaptionModelHash[productId];

      if (!productModel) {
        console.log(productId + " is not found");
        return;
      }

      return {
        // NOTE: class data is not preserved with JSON.stringify. class name is used for reconstruction instance
        productClassName: productModel._modelOptions.name.singular,
        productModel: productModel,
        tweetModels: tweetModels,
        bookCaptionModel: bookCaptionModel,
      };
    })
    .compact().value();

  console.log("build product data list process finished");
  return productDataList;
}

async function getProductIdToIsNewProductHash(statId) {
  let statDataModels = (await sequelize.query(
    sprintf(
      "SELECT * FROM stat_data WHERE product_id IN (SELECT product_id FROM (SELECT product_id, count(*) AS count FROM stat_data WHERE is_invalid = 0 GROUP BY product_id) AS hoge WHERE hoge.count = 1) AND stat_id = %d;",
      statId
    )
  ))[0];

  var productIdToIsNewProductHash = {};
  __.each(statDataModels, statDataModel => {
    productIdToIsNewProductHash[statDataModel.product_id] = true;
  });

  return productIdToIsNewProductHash;
}

function calcNormalizedLevenshteinDistance(strA, strB) {
  if (!strA || !strB) return 1.0;

  var maxStrLength = Math.max(strA.length, strB.length);
  var distance = FastLevenShtein.get(strA, strB);

  return distance / maxStrLength;
}

async function sortAndFilterTweetModels(tweetModels, options) {
  options = options || {};

  tweetModels = __.sortBy(tweetModels, tweetModel => {
    return -1 * new Moment(tweetModel.tweetedAt).unix();
  });

  var tweetDataArray = __.map(tweetModels, m => {
    var text = m.text;

    var trimedText;
    trimedText = text.replace(/(https:\/\/t\.co\/[a-zA-Z0-9]+|https:\/\/t\.…|…)/g, '');
    trimedText = trimedText.slice(0, CONST.STR_LENGTH_FOR_CALC_LSD);

    return {
      tweetModel: m,
      trimedText: trimedText,

      similarTweetData: undefined,
      parentTweetData: undefined,
      hasProductNameInText: false,
      hasDeprioritizeWordInText: false,
      isRelatedWithBlockedUser: false,
      newLineCharNum: 0,
    };
  });

  // detect similar tweets and exclude them
  // NOTE: too high calc complexity O(n^2). need fix
  __.each(tweetDataArray, baseTweetData => {
    baseTweetData.tweetIdToNLSDHash = baseTweetData.tweetIdToNLSDHash || {};
    if (baseTweetData.similarTweetData) return;

    __.each(tweetDataArray, compareTweetData => {
      if (baseTweetData.tweetModel.tweetId == compareTweetData.tweetModel.tweetId) return;
      if (baseTweetData.tweetIdToNLSDHash[compareTweetData.tweetModel.tweetId]) return;

      var NLSD = calcNormalizedLevenshteinDistance(baseTweetData.trimedText, compareTweetData.trimedText);

      compareTweetData.tweetIdToNLSDHash = compareTweetData.tweetIdToNLSDHash || {};
      compareTweetData.tweetIdToNLSDHash[baseTweetData.tweetModel.tweetId] = NLSD;

      if (NLSD < 0.5) {
        compareTweetData.similarTweetData = baseTweetData;
      }
    });
  });
  tweetDataArray = __.filter(tweetDataArray, data => {
    return !data.parentTweetData && !data.similarTweetData;
  });

  if (options.deprioritizeContainsSpecificWordsInText) {
    __.each(tweetDataArray, tweetData => {
      var isBlocked = __.some(CONST.DEPRIORITIZE_WORDS_IN_TWEET_TEXT, word => {
        return tweetData.tweetModel.text.match(word) ? true : false;
      });
      tweetData.hasDeprioritizeWordInText = isBlocked;
    });
  }

  if (options.prioritizeContainProductNameInText) {
    var altSearchWordModels = await TwitterAlternativeSearchWord.selectByProductIds([options.productModel.productId]);
    var altSearchWords = __.map(altSearchWordModels, m => {
      return m.searchWord;
    });

    var searchWordRegExps = __.map(__.flatten([options.productModel.title, altSearchWords]), searchWord => {
      return new RegExp(searchWord);
    });

    var trimTextRegExp = new RegExp(/(https|http)(:\/\/[-_.!~*\'()a-zA-Z0-9;\/?:\@&=+\$,%#]+)|@[-_.!~*\'()a-zA-Z0-9;\/?:…\@&=+\$,%#]+|…| |　/g);

    __.each(tweetDataArray, tweetData => {
      var text = tweetData.tweetModel.text;
      tweetData.trimmedTextForSort = text.replace(trimTextRegExp, '').trim();

      __.each(searchWordRegExps, regExp => {
        if (regExp.test(text)) {
          tweetData.hasProductNameInText = true;
        }
      });
    });
  }

  if (options.deprioritizeBlockedUser) {
    if (!options.screenNameToBlockTwitterUserModelHash) {
      throw new Error('need screenNameToBlockTwitterUserModelHash to use deprioritizeBlockedUser option');
    }

    var isExcluded = function (tweetModel) {
      if (options.screenNameToBlockTwitterUserModelHash[tweetModel.screenName]) return true;

      var matchResult = tweetModel.text.match(/RT @([a-zA-Z0-9_]+): /);
      if (matchResult && options.screenNameToBlockTwitterUserModelHash[matchResult[1]]) {
        return true;
      }

      return false;
    };

    __.each(tweetDataArray, tweetData => {
      if (isExcluded(tweetData.tweetModel)) {
        tweetData.isRelatedWithBlockedUser = true;
      }
    });
  }

  if (options.deprioritizeByNewLineCharCount) {
    __.each(tweetDataArray, tweetData => {
      var result = tweetData.tweetModel.text.match(/\n/g);
      var newLineCharNum = result ? result.length : 0;
      tweetData.isOverNewLineCharLimit = options.deprioritizeByNewLineCharCount <= newLineCharNum;
    });
  }

  // sorting
  tweetDataArray = tweetDataArray.sort(function (a, b) {
    // NOTE: sort by prioritizeFirstAppearUserTweet after this sorting process

    if (options.deprioritizeBlockedUser) {
      if (!b.isRelatedWithBlockedUser && a.isRelatedWithBlockedUser) return 1;
      if (b.isRelatedWithBlockedUser && !a.isRelatedWithBlockedUser) return -1;
    }

    if (options.prioritizeContainProductNameInText) {
      if (!b.hasProductNameInText && a.hasProductNameInText) return -1;
      if (b.hasProductNameInText && !a.hasProductNameInText) return 1;
    }

    if (options.deprioritizeContainsSpecificWordsInText) {
      if (!b.hasDeprioritizeWordInText && a.hasDeprioritizeWordInText) return 1;
      if (b.hasDeprioritizeWordInText && !a.hasDeprioritizeWordInText) return -1;
    }

    if (options.deprioritizeByNewLineCharCount) {
      if (!b.isOverNewLineCharLimit && a.isOverNewLineCharLimit) return 1;
      if (b.isOverNewLineCharLimit && !a.isOverNewLineCharLimit) return -1;
    }

    if (b.trimmedTextForSort.length != a.trimmedTextForSort.length) {
      return b.trimmedTextForSort.length - a.trimmedTextForSort.length;
    }

    if (b.tweetModel.favouriteCount != a.tweetModel.favouriteCount) {
      return b.tweetModel.favouriteCount - a.tweetModel.favouriteCount;
    }

    if (b.tweetModel.retweetCount != a.tweetModel.retweetCount) {
      return b.tweetModel.retweetCount - a.tweetModel.retweetCount;
    }

    return 0;
  });

  if (options.prioritizeFirstAppearUserTweet) {
    var isAlreadyAppearedHash = {};
    var firstAppeared = [];
    var alreadyAppeared = [];

    __.each(tweetDataArray, tweetData => {
      var userId = tweetData.tweetModel.userId;

      if (!isAlreadyAppearedHash[userId]) {
        isAlreadyAppearedHash[userId] = true;
        firstAppeared.push(tweetData);
      } else {
        alreadyAppeared.push(tweetData);
      }
    });

    tweetDataArray = __.flatten([firstAppeared, alreadyAppeared]);
  }

  var modifiedTweetModels = __.map(tweetDataArray, data => {
    return data.tweetModel;
  });

  if (options.limitNumAfterModify) {
    modifiedTweetModels = __.first(modifiedTweetModels, options.limitNumAfterModify);
  }

  return modifiedTweetModels;
}

module.exports = {
  checkSearchWordValidity: checkSearchWordValidity,
  convertJapaneseDateStrIntoMysqlDate: convertJapaneseDateStrIntoMysqlDate,
  convertDateObjectIntoMySqlReadableString: convertDateObjectIntoMySqlReadableString,
  isAdminByReq: isAdminByReq,
  selectProductModels: selectProductModels,
  calcNormalizedLevenshtein: calcNormalizedLevenshteinDistance,
  buildProductDataListObject: buildProductDataListObject,
  sortAndFilterTweetModels: sortAndFilterTweetModels,
  isValidByStatus: isValidByStatus,

  htmlCache: htmlCache,
  getProductIdToIsNewProductHash: getProductIdToIsNewProductHash,
};
