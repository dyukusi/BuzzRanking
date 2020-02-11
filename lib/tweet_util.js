const appRoot = require('app-root-path');
const __ = require('underscore');
const Moment = require('moment');
const CONST = Const = require(appRoot + '/lib/const.js');
const Util = require(appRoot + '/lib/util.js');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

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
      if (baseTweetData.tweetModel.id == compareTweetData.tweetModel.id) return;
      if (baseTweetData.tweetIdToNLSDHash[compareTweetData.tweetModel.id]) return;

      var NLSD = Util.calcNormalizedLevenshteinDistance(baseTweetData.trimedText, compareTweetData.trimedText);

      compareTweetData.tweetIdToNLSDHash = compareTweetData.tweetIdToNLSDHash || {};
      compareTweetData.tweetIdToNLSDHash[baseTweetData.tweetModel.id] = NLSD;

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
    var altSearchWordModels = await TwitterAlternativeSearchWord.selectByProductBundleIds([options.productBundleModel.id]);
    var altSearchWords = __.map(altSearchWordModels, m => {
      return m.searchWord;
    });

    var regExpEscape = function (str) {
      return str.replace(/[-\/\\^$*+?.()|\[\]{}]/g, '\\$&');
    };

    var searchWordRegExps = __.map(__.flatten([options.productBundleModel.name, altSearchWords]), searchWord => {
      return new RegExp(regExpEscape(searchWord));
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
    if (!options.isBlockedTwitterUserByScreenNameHash) {
      throw new Error('need isBlockedTwitterUserByScreenNameHash to use deprioritizeBlockedUser option');
    }

    var isExcluded = function (tweetModel) {
      if (options.isBlockedTwitterUserByScreenNameHash[tweetModel.screenName]) return true;

      var matchResult = tweetModel.text.match(/RT @([a-zA-Z0-9_]+): /);
      if (matchResult && options.isBlockedTwitterUserByScreenNameHash[matchResult[1]]) {
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
  sortAndFilterTweetModels: sortAndFilterTweetModels,
};
