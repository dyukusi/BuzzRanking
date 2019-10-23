const appRoot = require('app-root-path');
const _ = require('underscore');
const Util = require(appRoot + '/my_libs/util.js');
const QueryString = require('query-string');
const sprintf = require('sprintf-js').sprintf;
const BatchUtil = require(appRoot + '/my_libs/batch_util.js');
const CONST = require(appRoot + '/my_libs/const.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const sleep = msec => new Promise(resolve => setTimeout(resolve, msec));
const Moment = require('moment');

const NewTweet = require(appRoot + '/models/new_tweet'); // TEMP
const Tweet = require(appRoot + '/models/tweet');
const TweetCountLog = require(appRoot + '/models/tweet_count_log');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');
const InvalidProduct = require(appRoot + '/models/invalid_product.js');
const TweetSource = require(appRoot + '/models/tweet_source');

const PRIORITY_ZERO_THRESHOLD_HOURS_SINCE_LAST_UPDATED_LTE = 12;
const WAITING_TIME_MSEC_PER_USING_TWITTER_API = 6500; // 6.5sec
const ABNORMAL_THRESHOLD_USER_COUNT = 5000;
const SEARCH_TARGET_NUM_PER_EXECUTION = 1;
const STRICT_WORD_SEARCH_PRODUCT_TYPES = [
  2, // dating
];

let TWITTER_SEARCH_OPTION_BY_PRODUCT_TYPE_ID = {
  1: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  2: 'OR @kslghahfs -filter:links source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  3: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  4: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  5: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  6: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  7: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
  8: 'OR @kslghahfs source:Twitter_for_iPhone OR source:Twitter_for_Android OR source:Twitter_Web_Client OR source:Twitter_Web_App',
};

let tempOriginalTweetCountHash = {};
let tempRetweetCountHash = {};
let tempUserCountHash = {};

let findOriginalTweetHash = {};
var retweetTweets = [];
var taskQueue;
let productIdToPriorityHash = {};

process.on('uncaughtException', (err) => {
  console.log('uncaughtException ' + err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at:', p, 'reason:', reason);
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
  taskQueue = await createTaskQueue();
  var productIds = _.map(taskQueue, task => {
    return task.product_id;
  });

  console.log("New product num: " + _.filter(_.values(productIdToPriorityHash), priority => {
    return priority == -1;
  }).length);

  while (taskQueue.length) {
    await collectTweets(taskQueue.pop());
    await sleep(WAITING_TIME_MSEC_PER_USING_TWITTER_API);
    console.log("NEXT");
  }

  console.log("find missed tweets and insert");
  await findMissedTweetsAndInsert();

  console.log("calc and insert tweet count log");
  for (var i = 0; i < productIds.length; i++) {
    await calcAndInsertTweetCountLog(productIds[i]);
  }

  return;
}

async function createTaskQueue() {
  let results = await Promise.all([
    getProductIdArraySortedByTweetSearchPriority(),
    TwitterAlternativeSearchWord.findAll(),
    InvalidProduct.findAll(),
  ]);

  let targetSortedProductIds = _.last(results[0], SEARCH_TARGET_NUM_PER_EXECUTION);

  let altSearchWordsHash = _.groupBy(results[1], altSearchWordModel => {
    return altSearchWordModel.productId;
  });
  let invalidProductModelHash = _.indexBy(results[2], invalidProductModel => {
    return invalidProductModel.productId;
  });
  let productModels = await Util.selectProductModelsByProductIds(targetSortedProductIds);
  let productIdToModel = _.indexBy(productModels, m => {
    return m.productId;
  });
  let sortedProductModels = _.chain(targetSortedProductIds)
    .map(productId => {
      return productIdToModel[productId];
    })
    .compact()
    .value();

  let taskQueue = [];
  for (var i = 0; i < sortedProductModels.length; i++) {
    var productModel = sortedProductModels[i];

    if (invalidProductModelHash[productModel.productId]) {
      continue;
    }

    let altSearchWords = _.map(altSearchWordsHash[productModel.productId], model => {
      return model.searchWord;
    });
    let searchWords = !_.isEmpty(altSearchWords) ? altSearchWords : [productModel.getProductName()];

    var hasInvalidSearchWord = _.some(searchWords, word => {
      return isMaybeInvalidProduct(word) || !Util.checkSearchWordValidity(word);
    });
    if (hasInvalidSearchWord) {
      await InvalidProduct.create({
        productId: productModel.productId,
        status: 1,
      });

      continue;
    }

    let joinedSearchWord = searchWords.join(" OR ");

    taskQueue.push(createTask(productModel.productTypeId, productModel.productId, joinedSearchWord));
  }

  return taskQueue;
}

function calcPriority(row) {
  let buzz = row.buzz;
  let hoursSinceLastUpdated = (new Moment() - new Moment(row.created_at)) / (1000 * 60 * 60);

  // いくら評価値が高くても最低n時間は次の更新までのインターバルをおくための閾値
  if (hoursSinceLastUpdated <= PRIORITY_ZERO_THRESHOLD_HOURS_SINCE_LAST_UPDATED_LTE) {
    return 0;
  }

  let priority = (buzz * hoursSinceLastUpdated) + 1;
  row.priority = priority;

  return priority;

  // 底1.05, 真数userCount の対数を傾きとしている
  // https://www.desmos.com/calculator/auubsajefh
  // let rawSlope = Math.log(userCount) / Math.log(1.05);
  // let slope = rawSlope <= 45 ? 45 : rawSlope;
  // let hoursSinceLastUpdated = (new Date() - new Date(row.created_at)) / (1000 * 60 * 60);
  // ↓
  // 単純にbuzzを傾きとして計算して十分に見えるので複雑な計算はこれで何か問題が起きない限り却下. 案自体は残しておく
}

async function getProductIdArraySortedByTweetSearchPriority() {
  // 全プロダクトの最新のログをセレクトするクエリ
  let latestTweetCountLogRowsPromise = sequelize.query('SELECT TweetCountLogA.product_id, TweetCountLogA.user_count, TweetCountLogA.buzz, TweetCountLogA.created_at FROM tweet_count_log AS TweetCountLogA INNER JOIN (SELECT product_id, MAX(created_at) AS latest_date FROM tweet_count_log GROUP BY product_id) AS TweetCountLogB ON TweetCountLogA.product_id = TweetCountLogB.product_id AND TweetCountLogA.created_at = TweetCountLogB.latest_date WHERE TweetCountLogA.product_id NOT IN (SELECT product_id FROM invalid_product);');

  let newProductIdsPromises = _.map(CONST.PRODUCT_TABLE_NAMES, tableName => {
    return sequelize.query('SELECT product_id FROM ' + tableName + ' WHERE product_id NOT IN (SELECT product_id FROM tweet_count_log) AND product_id NOT IN (SELECT product_id FROM invalid_product)');
  });

  let results = await Promise.all(_.flatten([
    latestTweetCountLogRowsPromise,
    newProductIdsPromises,
  ]));

  var latestTweetCountLogRows = results.shift()[0];
  var newProductIdsResults = results;

  let productIdsSortedByPriority = _.chain(latestTweetCountLogRows)
    .sortBy(row => {
      var priority = calcPriority(row);
      productIdToPriorityHash[row.product_id] = priority;

      return priority;
    })
    .map(row => {
      return row.product_id;
    })
    // .reverse()
    .value();

  let newProductIds = _.flatten(_.map(newProductIdsResults, result => {
    return _.map(result[0], row => {
      productIdToPriorityHash[row.product_id] = -1;
      return row.product_id;
    });
  }));

  return _.flatten([productIdsSortedByPriority, newProductIds]);
}

function createTask(productTypeId, productId, searchWord) {
  let searchQueryBase = _.contains(STRICT_WORD_SEARCH_PRODUCT_TYPES, productTypeId) ? '"%s" %s' : '%s %s';
  return {
    api_param: {
      q: sprintf(
        searchQueryBase,
        searchWord,
        TWITTER_SEARCH_OPTION_BY_PRODUCT_TYPE_ID[productTypeId],
      ),
      lang: 'ja',
      locale: 'ja',
      count: 100,
      result_type: 'recent',
      max_id: '',
    },
    product_id: productId,
    product_type: productTypeId,
    search_word: searchWord,
  };
}

async function collectTweets(task) {
  console.log('■ Processing... ' + task.api_param.q);

  let param = task.api_param;
  let tweetJson = await BatchUtil.searchTweets(param);
  let metaData = tweetJson['search_metadata'];

  let excludedTweetCount = 0;
  let tweets = _.filter(tweetJson['statuses'], tweet => {
    if (_.contains(STRICT_WORD_SEARCH_PRODUCT_TYPES, task.product_type)) {
      let searchWord = task.search_word;
      let text = tweet['text'];
      let regExp = new RegExp('@\\w*\\s');
      let modifiedText = text.replace(regExp, '');
      let hasTargetWord = modifiedText.indexOf(searchWord) == -1 ? false : true;
      if (!hasTargetWord) {
        excludedTweetCount++;
      }

      return hasTargetWord;
    } else {
      return true;
    }
  });

  var originalTweets = [];
  _.each(tweets, tweet => {
    var isRetweet = !!tweet['retweeted_status'];

    if (isRetweet) {
      var tweetIdStr = tweet['retweeted_status']['id_str'];
      findOriginalTweetHash[tweetIdStr] = findOriginalTweetHash[tweetIdStr] || {};
      findOriginalTweetHash[tweetIdStr][task.product_id] = true;
    } else {
      originalTweets.push(tweet);
    }
  });

  var insertObjects = [];
  for (var i = 0; i < originalTweets.length; i++) {
    var tweet = originalTweets[i];
    var tweetSourceModel = await TweetSource.getModelBySourceTextAndInsertIfNeed(tweet['source']);

    insertObjects.push(tweetJSONIntoInsertObject(tweet, task.product_id, tweetSourceModel.id));
  }

  let tweetModels = await NewTweet.bulkCreate(insertObjects, {
    ignoreDuplicates: true,
  });

  let originalTweetCountThisTime = originalTweets.length;
  let retweetCountThisTime = tweets.length - originalTweetCountThisTime;
  let userCountThisTime = _.chain(originalTweets).groupBy(tweet => {
    return tweet['user']['id'];
  }).keys().value().length;

  // counting process mainly for display
  tempOriginalTweetCountHash[task.product_id] = (tempOriginalTweetCountHash[task.product_id] || 0) + originalTweetCountThisTime;
  tempRetweetCountHash[task.product_id] = (tempRetweetCountHash[task.product_id] || 0) + retweetCountThisTime;
  tempUserCountHash[task.product_id] = (tempUserCountHash[task.product_id] || 0) + userCountThisTime;

  console.log('Total OriginalTweet Count: ' + tempOriginalTweetCountHash[task.product_id] + ' Total Retweet Count: ' + tempRetweetCountHash[task.product_id] + ' Total User Count: ' + tempUserCountHash[task.product_id]);
  console.log('Excluded tweet count: ' + excludedTweetCount);
  console.log('Priority: ' + productIdToPriorityHash[task.product_id]);
  console.log('Remaining: ' + taskQueue.length);

  let totalUserCount = tempUserCountHash[task.product_id];
  if (ABNORMAL_THRESHOLD_USER_COUNT <= totalUserCount) {
    console.log("too much user count. maybe this is invalid product. added to invalid product");
    await InvalidProduct.create({
      productId: task.product_id,
      status: 1,
    });
    return;
  }

  let hasNextPage = !!metaData['next_results'];
  if (hasNextPage) {
    console.log("should search for next page. added to taskQueue.");
    let newTask = createTask(task.product_type_id, task.product_id, task.search_word);
    newTask.api_param = QueryString.parse(metaData['next_results']);
    taskQueue.push(newTask);
    return;
  }
}

function isMaybeInvalidProduct(productName) {
  if (productName.length <= 3) return true;
  return false;
}

async function calcAndInsertTweetCountLog(productId) {
  let nowMoment = new Moment();
  let oneWeekAgo = new Moment().subtract(7, 'day');

  let inRangeTweetModels = await NewTweet.selectByProductIds(
    productId,
    {
      since: oneWeekAgo.format(),
      // until: nowMoment.format(),
    }
  );

  let tweetCount = inRangeTweetModels.length;
  let userCount = _.chain(inRangeTweetModels).groupBy(tweetModel => {
    return tweetModel.userId
  }).keys().value().length;

  let buzz = BatchUtil.calcBuzzByTweetModels(inRangeTweetModels, nowMoment);

  console.log("Insert new TweetCountLog. ProductId: " + productId + " TweetCount: " + tweetCount + " UserCount: " + userCount + " Buzz: " + buzz);

  let tweetCountLogModel = await TweetCountLog.create({
    productId: productId,
    tweetCount: tweetCount,
    userCount: userCount,
    buzz: buzz,
  });
}

async function findMissedTweetsAndInsert() {
  var targetTweetIds = _.keys(findOriginalTweetHash);
  var tweetsChunks = _.chunk(targetTweetIds, 100);
  var tweetInfoArray = [];
  var insertObjects = [];

  for (var i = 0; i < tweetsChunks.length; i++) {
    var tweetIds = tweetsChunks[i];
    var infoArray = await BatchUtil.getTweetDetailInfoByTweetIds(tweetIds);
    tweetInfoArray = _.union(tweetInfoArray, infoArray);

    await sleep(3000);
  }

  var tweetInfoHash =_.indexBy(tweetInfoArray, tweetInfo => {
    return tweetInfo['id_str'];
  });

  for (var i = 0; i < targetTweetIds.length; i++) {
    var tweetId = targetTweetIds[i];
    var productIds = _.keys(findOriginalTweetHash[tweetId]);
    var tweetInfo = tweetInfoHash[tweetId];

    if (!tweetInfo) continue;

    for (var j = 0; j < productIds.length; j++) {
      var productId = productIds[j];
      var tweetSourceModel = await TweetSource.getModelBySourceTextAndInsertIfNeed(tweetInfo['source']);
      insertObjects.push(tweetJSONIntoInsertObject(tweetInfo, productId, tweetSourceModel.id));
    }
  }

  let tweetModels = await NewTweet.bulkCreate(insertObjects, {
    ignoreDuplicates: true,
  });
}

function tweetJSONIntoInsertObject (tweet, productId, tweetSourceId) {
  return {
    id: tweet['id_str'],
    quoteTweetId: tweet['quoted_status_id_str'],
    productId: productId,
    userId: tweet['user']['id'],
    name: tweet['user']['name'],
    screenName: tweet['user']['screen_name'],
    favouriteCount: tweet['favorite_count'] || 0,
    retweetCount: tweet['retweet_count'] || 0,
    sourceId: tweetSourceId,
    text: tweet['text'],
    isInvalid: 0,
    tweetedAt: Util.convertDateObjectIntoMySqlReadableString(new Date(tweet['created_at'])),
  };
}