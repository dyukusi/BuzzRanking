const appRoot = require('app-root-path');
const CONST = require(appRoot + '/lib/const.js');
const sprintf = require('sprintf-js').sprintf;
const Util = require(appRoot + '/lib/util.js');

function generateRankingPageURL(options) {
  options = options || {};
  var isFirstQS = true;
  var qs = '';

  if (CONST.RANKING_TYPE_ID_TO_NAME_HASH[options.rankingTypeId]) {
    var prefix = isFirstQS ? '?' : '&';
    isFirstQS = false;

    var rankingTypeName = CONST.RANKING_TYPE_ID_TO_NAME_HASH[options.rankingTypeId].toLowerCase();
    qs += prefix + 'rtype=' + rankingTypeName;
  }

  if (CONST.PRODUCT_TYPE_BUNDLE_ID_TO_NAME_HASH[options.productTypeBundleId]) {
    var prefix = isFirstQS ? '?' : '&';
    isFirstQS = false;

    var productTypeBundleName = CONST.PRODUCT_TYPE_BUNDLE_ID_TO_NAME_HASH[options.productTypeBundleId].toLowerCase();
    qs += prefix + 'category=' + productTypeBundleName;
  }

  if (options.page) {
    var prefix = isFirstQS ? '?' : '&';
    isFirstQS = false;

    qs += prefix + 'page=' + options.page;
  }

  var url = Util.getBaseURL() + qs;

  return url
}

function generateProductBundleDetailPageURL(productBundleId) {
  return sprintf(
    '%(baseURL)s/product/%(productBundleId)s',
    {
      baseURL: Util.getBaseURL(),
      productBundleId: productBundleId,
    }
  );
}

function generateTwitterAccountPageURL(screenName) {
  screenName = screenName || '';

  return sprintf(
    '%(baseURL)s/twitter/account/%(screenName)s',
    {
      baseURL: Util.getBaseURL(),
      screenName: screenName,
    }
  );
}

module.exports = {
  generateRankingPageURL,
  generateProductBundleDetailPageURL,
  generateTwitterAccountPageURL,
}
