const appRoot = require('app-root-path');
const _ = require('underscore');
const Util = require(appRoot + '/lib/util.js');
const QueryString = require('query-string');
const sprintf = require('sprintf-js').sprintf;
const BatchUtil = require(appRoot + '/lib/batch_util.js');
const CONST = Const = require(appRoot + '/lib/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const Op = Sequelize.Op;
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const Moment = require('moment');
let timeout = msec => new Promise(resolve => { setTimeout(() => {resolve('timeout')}, msec) });
const ProductUtil = require(appRoot + '/lib/product_util.js');
const ProductTweetStat = require(appRoot + '/models/product_tweet_stat');
const GoogleAnalyticsAPI = require(appRoot + '/lib/google_analytics_api.js');

const Tweet = require(appRoot + '/models/tweet');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const TweetSource = require(appRoot + '/models/tweet_source');
const ProductBundle = require(appRoot + '/models/product_bundle');
const PRIORITY_ZERO_THRESHOLD_HOURS_SINCE_LAST_UPDATED_LTE = 12;
const WAITING_TIME_MSEC_PER_USING_TWITTER_API = 6500; // 6.5sec
const ABNORMAL_THRESHOLD_ORIGINAL_TWEET_COUNT = 50000;
const SEARCH_TARGET_NUM_PER_EXECUTION = 10;
const STRICT_WORD_SEARCH_PRODUCT_TYPES = [
  2, // dating
];

let DEFAULT_TWITTER_SEARCH_OPTION_BASE = 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App exclude:retweets';
let TWITTER_SEARCH_OPTION_BASE_BY_PRODUCT_TYPE_ID = {
  2: 'OR @kslghahfs -filter:links source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App exclude:retweets',
};

let tempOriginalTweetCountHash = {};
let tempRetweetCountHash = {};
let tempUserCountHash = {};

let retweetTargetTweetIdHash = {};
let taskQueue;
let productBundleIdToPriorityHash = {};
let productBundleIdIntoStartTweetSearchMoment = {};
let scriptStartedAtMoment = new Moment();
let productBundleIdIntoCollectErrorCountHash = {};

process.on('uncaughtException', (err) => {
  console.log('uncaughtException ' + err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: ', p);
  console.log('reason: ', reason)
  process.exit(1);
});

main()
  .then(() => {
    sequelize.close();
    console.log("Finished!");

    process.exit();
  });

// ---------------------------------------------------------------------------
async function main() {
  console.log("creating tasks...");
  taskQueue = await createTaskQueue();
  var targetProductBundleId = _.map(taskQueue, task => {
    return task.productBundleId;
  });

  console.log("New product bundle num: " + _.filter(_.values(productBundleIdToPriorityHash), priority => {
    return priority == Number.MAX_SAFE_INTEGER;
  }).length);

  while (taskQueue.length) {
    var task = taskQueue.pop();

    try {
      await collectTweets(task);
    } catch (e) {
      console.log(e);

      productBundleIdIntoCollectErrorCountHash[task.productBundleId] = productBundleIdIntoCollectErrorCountHash[task.productBundleId] || 0;
      productBundleIdIntoCollectErrorCountHash[task.productBundleId] += 1;

      if (productBundleIdIntoCollectErrorCountHash[task.productBundleId] < 3) {
        taskQueue.push(task);
      } else {
        // exclude failed product bundle
        targetProductBundleId = _.filter(targetProductBundleId, productBundleId => {
          return productBundleId != task.productBundleId;
        });

        var productBundleModel = await ProductBundle.findOne({
          where: {
            id: task.productBundleId,
          },
        });

        await productBundleModel.update({
          validityStatus: CONST.VALIDITY_STATUS_NAME_TO_ID_HASH.FAILED_TO_COLECT_TWEET,
        });

        console.log("failed multiple times. skipping search task... productBundleId: " + task.productBundleId + " name: " + task.searchWord);
      }
    }

    await sleep(WAITING_TIME_MSEC_PER_USING_TWITTER_API);

    console.log("NEXT");
  }

  console.log("find missed tweets and insert");
  await findMissedTweetsAndInsert();

  console.log("calc and insert tweet count log & product tweet stat");
  for (var i = 0; i < targetProductBundleId.length; i++) {
    var productBundleId = targetProductBundleId[i];
    await insertTweetCountLog(productBundleId);
    await calcBuzzAndInsertProductTweetStat(productBundleId);
  }

  return;
}

async function createTaskQueue() {
  let productBundleIdsSortedBySearchPriority = await calcProductBundleIdsSortedBySearchPriority();
  let targetProductBundleIdsSortedBySearchPriority = _.first(productBundleIdsSortedBySearchPriority, SEARCH_TARGET_NUM_PER_EXECUTION);
  let productBundleIdIntoSearchWords = await ProductUtil.buildProductBundleIdIntoSearchWordsHashByProductBundleIds(targetProductBundleIdsSortedBySearchPriority);

  let latestTweetedAtRows = (await sequelize.query(
    "SELECT product_bundle_id, MAX(tweeted_at) AS latest_date FROM tweet WHERE product_bundle_id IN (:productBundleIds) GROUP BY product_bundle_id",
    {
      replacements: {
        productBundleIds: targetProductBundleIdsSortedBySearchPriority,
      },
      type: Sequelize.QueryTypes.SELECT,
    }
  ));
  let productBundleIdIntoLatestTweetedAtRow = _.indexBy(latestTweetedAtRows, row => {
    return row.product_bundle_id;
  });

  var productBundleModels = await ProductBundle.findAll({
    where: {
      id: targetProductBundleIdsSortedBySearchPriority,
    },
  });

  var productBundleIdIntoProductBundleModelHash = _.indexBy(productBundleModels, m => {
    return m.id;
  });

  let taskQueue = [];
  for (var i = 0; i < targetProductBundleIdsSortedBySearchPriority.length; i++) {
    var targetProductBundleId = targetProductBundleIdsSortedBySearchPriority[i];
    var productBundleModel = productBundleIdIntoProductBundleModelHash[targetProductBundleId];

    let searchWords = productBundleIdIntoSearchWords[productBundleModel.id];
    let joinedSearchWord = searchWords.join(" OR ");

    // NOTE: since param is really important to prevent duplicate search
    let since = null;
    var tweetedAtRow = productBundleIdIntoLatestTweetedAtRow[targetProductBundleId];
    if (tweetedAtRow) {
      var sinceMoment = new Moment(tweetedAtRow.latest_date);
      since = sinceMoment.format("YYYY-MM-DD_HH:mm:ss[_JST]");
    }

    taskQueue.push(createTask(targetProductBundleId, joinedSearchWord, since, true));
  }

  return taskQueue;
}

function calcPriority(tweetCount, pvNum = 0, latestUpdatedAt) {
  let hoursSinceLastUpdated = (new Moment() - new Moment(latestUpdatedAt)) / (1000 * 60 * 60);

  // いくら評価値が高くても最低n時間は次の更新までのインターバルをおくための閾値
  if (hoursSinceLastUpdated <= PRIORITY_ZERO_THRESHOLD_HOURS_SINCE_LAST_UPDATED_LTE) {
    return -1;
  }

  let priority = tweetCount + (pvNum * 30) + hoursSinceLastUpdated + 1;

  return priority;

  // 底1.05, 真数userCount の対数を傾きとしている
  // https://www.desmos.com/calculator/auubsajefh
  // let rawSlope = Math.log(userCount) / Math.log(1.05);
  // let slope = rawSlope <= 45 ? 45 : rawSlope;
  // let hoursSinceLastUpdated = (new Date() - new Date(row.created_at)) / (1000 * 60 * 60);
  // ↓
  // 単純にbuzzを傾きとして計算して十分に見えるので複雑な計算はこれで何か問題が起きない限り却下. 案自体は残しておく
}

async function calcProductBundleIdsSortedBySearchPriority() {
  // 全プロダクトの最新のTweetCountLogをセレクトするクエリ
  let latestTweetCountLogRows = (await sequelize.query('SELECT TweetCountLogA.product_bundle_id, TweetCountLogA.tweet_count, TweetCountLogA.created_at FROM tweet_count_log AS TweetCountLogA INNER JOIN (SELECT product_bundle_id, MAX(created_at) AS latest_date FROM tweet_count_log GROUP BY product_bundle_id) AS TweetCountLogB ON TweetCountLogA.product_bundle_id = TweetCountLogB.product_bundle_id AND TweetCountLogA.created_at = TweetCountLogB.latest_date'))[0];

  let newProductBundleIdsPromises = _.map(ProductUtil.getAllProductModelClass(), modelClass => {
    return sequelize.query('SELECT product_bundle_id FROM ' + modelClass.name + ' WHERE product_bundle_id IS NOT NULL AND validity_status IN (' + CONST.VALID_STATUS_IDS.join(',') + ') AND product_bundle_id NOT IN (SELECT product_bundle_id FROM tweet_count_log)');
  });
  let results = await Promise.all(newProductBundleIdsPromises);

  let newProductBundleIds = _.chain(results)
    .map(result => {
      return result[0];
    })
    .flatten()
    .map(row => {
      return row.product_bundle_id;
    })
    .compact()
    .value();

  var productBundleIdIntoPvInWeekHash = await GoogleAnalyticsAPI.getProductBundleIdIntoPvInWeekHash();

  // calc priority for already existing products
  _.each(latestTweetCountLogRows, row => {
    var productBundleId = row.product_bundle_id;
    var pvNum = productBundleIdIntoPvInWeekHash[productBundleId];

    var priority = calcPriority(row.tweet_count, pvNum, row.created_at);
    productBundleIdToPriorityHash[productBundleId] = priority;
  });

  // set highest priority for new products
  _.each(newProductBundleIds, productBundleId => {
    productBundleIdToPriorityHash[productBundleId] = Number.MAX_SAFE_INTEGER;
  });

  var productBundleIds = _.keys(productBundleIdToPriorityHash);

  // exclude INVALID product bundles
  var validProductBundleIds = await (async () => {
    var productBundleModels = await ProductBundle.selectValidProductBundleModels({
      id: productBundleIds,
    });

    return _.map(productBundleModels, m => {
      return m.id;
    });
  })();

  var productBundleIdsSortedBySearchPriority = (() => {
    var bIdAndPriorityArray = _.map(validProductBundleIds, productBundleId => {
      var priority = productBundleIdToPriorityHash[productBundleId];
      return {
        productBundleId: productBundleId,
        priority: priority,
      };
    });

    return _.chain(bIdAndPriorityArray)
      .sortBy(data => {
        return -1 * data.priority;
      })
      .map(data => {
        return data.productBundleId;
      })
      .compact()
      .value();
  })();

  return productBundleIdsSortedBySearchPriority;
}

function createTask(productBundleId, joinedSearchWord, since, isFirstSearch) {
  // TODO: STRICT SEARCH MODE LIKE BELOW
  // let searchQueryBase = _.contains(STRICT_WORD_SEARCH_PRODUCT_TYPES, productTypeId) ? '"%s" %s' : '%s %s';

  return {
    twitterApiParam: {
      q: sprintf(
        '%s %s',
        joinedSearchWord,
        DEFAULT_TWITTER_SEARCH_OPTION_BASE,
      ),
      lang: 'ja',
      locale: 'ja',
      count: 100,
      result_type: 'recent',
      max_id: '',
      since: since,
      tweet_mode: 'extended',
    },
    productBundleId: productBundleId,
    searchWord: joinedSearchWord,
    isFirstSearch: !!isFirstSearch,
  };
}

async function collectTweets(task) {
  console.log('■ Processing... ' + task.twitterApiParam.q + " ProductBundleId: " + task.productBundleId + " Since: " + task.twitterApiParam.since);
  var productBundleModel = await ProductBundle.selectById(task.productBundleId);

  if (task.isFirstSearch) {
    productBundleIdIntoStartTweetSearchMoment[task.productBundleId] = new Moment();
  }

  let result = await Promise.race([
    timeout(WAITING_TIME_MSEC_PER_USING_TWITTER_API),
    BatchUtil.searchTweets(task.twitterApiParam),
  ]);

  // timeout
  if (result == 'timeout') {
    console.log("TIMEOUT. added to task queue to retry");
    taskQueue.push(task);
    return;
  }

  let metaData = result['search_metadata'];
  let excludedTweetCount = 0;
  let tweets = _.filter(result['statuses'], tweet => {
    // TODO: STRICT MODE
    // if (_.contains(STRICT_WORD_SEARCH_PRODUCT_TYPES, task.product_type)) {
    //   let searchWord = task.search_word;
    //   let text = tweet['text'];
    //   let regExp = new RegExp('@\\w*\\s');
    //   let modifiedText = text.replace(regExp, '');
    //   let hasTargetWord = modifiedText.indexOf(searchWord) == -1 ? false : true;
    //   if (!hasTargetWord) {
    //     excludedTweetCount++;
    //   }
    //
    //   return hasTargetWord;
    // } else {
    //   return true;
    // }

    return true;
  });

  var originalTweets = [];
  _.each(tweets, tweet => {
    var isRetweet = !!tweet['retweeted_status'];

    if (isRetweet) {
      var tweetIdStr = tweet['retweeted_status']['id_str'];
      retweetTargetTweetIdHash[tweetIdStr] = retweetTargetTweetIdHash[tweetIdStr] || {};
      retweetTargetTweetIdHash[tweetIdStr][task.productBundleId] = true;
    } else {
      originalTweets.push(tweet);
    }
  });

  var insertObjectsForTweet = [];
  for (var i = 0; i < originalTweets.length; i++) {
    var tweet = originalTweets[i];
    var source = tweet['source'];
    var tweetSourceModel = await TweetSource.getModelBySourceTextAndInsertIfNeed(source);
    insertObjectsForTweet.push(tweetJSONIntoInsertObjectForTweet(tweet, task.productBundleId, tweetSourceModel.id));
  }

  let tweetModels = await Tweet.bulkCreate(insertObjectsForTweet, {
    ignoreDuplicates: true,
  });

  // ------------- for display -----------
  (() => {
    let originalTweetCountThisTime = originalTweets.length;
    let retweetCountThisTime = tweets.length - originalTweetCountThisTime;
    let userCountThisTime = _.chain(originalTweets).groupBy(tweet => {
      return tweet['user']['id'];
    }).keys().value().length;

    // counting process mainly for display
    tempOriginalTweetCountHash[task.productBundleId] = (tempOriginalTweetCountHash[task.productBundleId] || 0) + originalTweetCountThisTime;
    tempRetweetCountHash[task.productBundleId] = (tempRetweetCountHash[task.productBundleId] || 0) + retweetCountThisTime;
    tempUserCountHash[task.productBundleId] = (tempUserCountHash[task.productBundleId] || 0) + userCountThisTime;

    var priority = productBundleIdToPriorityHash[task.productBundleId];
    console.log('Total OriginalTweet Count: ' + tempOriginalTweetCountHash[task.productBundleId] + ' Total Retweet Count: ' + tempRetweetCountHash[task.productBundleId] + ' Total User Count: ' + tempUserCountHash[task.productBundleId]);
    console.log('Excluded tweet count: ' + excludedTweetCount);
    console.log('Priority: ' + priority + (priority == Number.MAX_SAFE_INTEGER ? ' (new product)' : ''));
    console.log('Remaining: ' + taskQueue.length);
  })();
  // -------------------------------------

  let totalOriginalTweetCount = tempOriginalTweetCountHash[task.productBundleId];
  if (!productBundleModel.isProtected() && ABNORMAL_THRESHOLD_ORIGINAL_TWEET_COUNT <= totalOriginalTweetCount) {
    console.log("too much user count. maybe this is invalid product. set validityStatus to OVER_TWEET_COUNT_LIMIT");
    await productBundleModel.update({
      validityStatus: Const.VALIDITY_STATUS_NAME_TO_ID_HASH.OVER_TWEET_COUNT_LIMIT,
    });

    await productBundleModel.save();
    return;
  }

  let hasNextPage = !!metaData['next_results'];
  if (hasNextPage) {
    console.log("should search for next page. added to taskQueue.");
    console.log(metaData['next_results']);

    let newTask = createTask(task.productBundleId, task.searchWord, task.twitterApiParam.since, false);
    newTask.twitterApiParam = QueryString.parse(metaData['next_results']);
    taskQueue.push(newTask);
    return;
  }
}

async function insertTweetCountLog(productBundleId) {
  // let nowMoment = new Moment();
  // let oneWeekAgo = new Moment().subtract(7, 'day');
  //
  // let inRangeTweetModels = await Tweet.selectByProductBundleIds(
  //   productBundleId,
  //   {
  //     since: oneWeekAgo.format(),
  //     // until: nowMoment.format(),
  //   }
  // );
  //
  // var tweetCount = inRangeTweetModels.length;
  // let userCount = _.chain(inRangeTweetModels).groupBy(tweetModel => {
  //   return tweetModel.userId;
  // }).keys().value().length;
  //
  // let buzz = BatchUtil.calcBuzzByTweetModels(inRangeTweetModels, nowMoment);
  //
  // console.log("Insert new TweetCountLog. ProductBundleId: " + productBundleId + " TweetCount: " + tweetCount + " UserCount: " + userCount + " Buzz: " + buzz);

  var tweetCountForOneWeek = await Tweet.count({
    where: {
      productBundleId: productBundleId,
      tweetedAt: {
        [Op.gte]: new Moment().subtract(7,'day').format(),
      },
    },
  });

  let tweetCountLogModel = await TweetCountLog.create({
    productBundleId: productBundleId,
    tweetCount: tweetCountForOneWeek,
  });
}

async function findMissedTweetsAndInsert() {
  var targetTweetIds = _.keys(retweetTargetTweetIdHash);
  var tweetsChunks = _.chunk(targetTweetIds, 100);
  var tweetInfoArray = [];
  var insertObjectsForTweet = [];

  for (var i = 0; i < tweetsChunks.length; i++) {
    var tweetIds = tweetsChunks[i];

    var result = await Promise.race([
      timeout(WAITING_TIME_MSEC_PER_USING_TWITTER_API),
      BatchUtil.getTweetDetailInfoByTweetIds(tweetIds),
    ]);
    if (result == 'timeout') {
      console.log("TIMEOUT. failed to fetch missed tweets");
      continue;
    }

    tweetInfoArray = _.union(tweetInfoArray, result);

    await sleep(3000);
  }

  var tweetInfoHash = _.indexBy(tweetInfoArray, tweetInfo => {
    return tweetInfo['id_str'];
  });

  for (var i = 0; i < targetTweetIds.length; i++) {
    var tweetId = targetTweetIds[i];
    var productBundleIds = _.keys(retweetTargetTweetIdHash[tweetId]);
    var tweetInfo = tweetInfoHash[tweetId];

    if (!tweetInfo) continue;

    for (var j = 0; j < productBundleIds.length; j++) {
      var productBundleId = productBundleIds[j];
      var source = tweetInfo['source'];
      var tweetSourceModel = await TweetSource.getModelBySourceTextAndInsertIfNeed(source);
      insertObjectsForTweet.push(tweetJSONIntoInsertObjectForTweet(tweetInfo, productBundleId, tweetSourceModel.id));
    }
  }

  let tweetModels = await Tweet.bulkCreate(insertObjectsForTweet, {
    ignoreDuplicates: true,
  });
}

function tweetJSONIntoInsertObjectForTweet(tweet, productBundleId, tweetSourceId) {
  return {
    id: tweet['id_str'],
    quoteTweetId: tweet['quoted_status_id_str'],
    productBundleId: productBundleId,
    userId: tweet['user']['id'],
    name: tweet['user']['name'],
    screenName: tweet['user']['screen_name'],
    favouriteCount: tweet['favorite_count'] || 0,
    retweetCount: tweet['retweet_count'] || 0,
    sourceId: tweetSourceId,
    text: tweet['full_text'],
    isInvalid: 0,
    tweetedAt: new Moment(tweet['created_at']).format("YYYY-MM-DD HH:mm:ss"),
  };
}

async function calcBuzzAndInsertProductTweetStat(productBundleId) {
  var productBundleModel = (await ProductBundle.selectByProductBundleIds([
    productBundleId
  ]))[0];

  var lastTweetSearchedAt = productBundleModel.lastTweetSearchedAt;
  var isFirstSearch = !lastTweetSearchedAt;
  var sinceStr = isFirstSearch ? null : new Moment(lastTweetSearchedAt).subtract(10, 'day').format('YYYY-MM-DD');

  var tweetCountRows = await (async () => {
    var rows = await Tweet.countTweetNumPerDay(productBundleModel.id, sinceStr);

    // should remove today's count because it is temporary result yet
    var scriptStartedAtStr = scriptStartedAtMoment.format('YYYY-MM-DD');
    rows = _.filter(rows, row => {
      return row.date != scriptStartedAtStr;
    });

    // should remove search start day count because of inaccuracy
    if (isFirstSearch) {
      rows.shift();
    }

    return rows;
  })();

  if (_.isEmpty(tweetCountRows)) return;

  var dateStrIntoUserCountHash = await (async () => {
    var result = {};
    var userCountRows = await Tweet.countUserNumPerDay(productBundleModel.id, sinceStr);
    _.each(userCountRows, row => {
      var dateStr = new Moment(row.date).format('YYYY-MM-DD');
      result[dateStr] = +row.count;
    });
    return result;
  })();

  var dateStrIntoTweetCountHash = (() => {
    var result = {};
    _.each(tweetCountRows, row => {
      result[row.date] = row.count;
    });
    return result;
  })();

  var calcTargetSinceStr = isFirstSearch ?
    new Moment(tweetCountRows[0].date).format('YYYY-MM-DD') :
    new Moment(lastTweetSearchedAt).subtract(2, 'day').format('YYYY-MM-DD');

  var dateStrListFromTargetSinceToLatest = (() => {
    var untilMoment = new Moment(scriptStartedAtMoment).subtract(1, 'day');
    var dayFromSince = 0;
    var result = [];

    while (new Moment(calcTargetSinceStr).add(dayFromSince, 'day').unix() < untilMoment.unix()) {
      result.push(new Moment(calcTargetSinceStr).add(dayFromSince, 'day').format('YYYY-MM-DD'));
      dayFromSince++;
    }

    return result;
  })();

  var firstDataDateMoment = new Moment(tweetCountRows[0].date);
  var insertObjectsForProductTweetStat = [];
  _.each(dateStrListFromTargetSinceToLatest, dateStr => {
    var buzz = 0;
    var previousValidUserCount = 0;

    _.times(7, passedDay => {
      var targetDateMoment = new Moment(dateStr).subtract(passedDay, 'day');
      var targetDateStr = targetDateMoment.format('YYYY-MM-DD');
      var targetUserCount;

      if (isFirstSearch && targetDateMoment.unix() < firstDataDateMoment.unix()) {
        targetUserCount = previousValidUserCount;
      } else {
        targetUserCount = dateStrIntoUserCountHash[targetDateStr] || 0;
      }

      buzz += ((7 - passedDay) / 7) * targetUserCount;

      previousValidUserCount = targetUserCount;
    });

    var tweetCount = dateStrIntoTweetCountHash[dateStr] || 0;
    var userCount = dateStrIntoUserCountHash[dateStr] || 0;

    if (tweetCount == 0 && buzz == 0) return;

    insertObjectsForProductTweetStat.push({
      productBundleId: productBundleModel.id,
      date: dateStr,
      tweetCount: tweetCount,
      userCount: userCount,
      buzz: buzz,
    });
  });

  await ProductTweetStat.bulkCreate(insertObjectsForProductTweetStat, {
    ignoreDuplicates: true,
  });

  await productBundleModel.update({
    lastTweetSearchedAt: scriptStartedAtMoment.format("YYYY-MM-DD HH:mm:ss"),
  });

  await productBundleModel.save();
}
