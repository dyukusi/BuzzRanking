const appRoot = require('app-root-path');
const __ = require('underscore');
const sequelize = require(appRoot + '/db/sequelize_config');
const FastLevenShtein = require('fast-levenshtein');
const mecabUtil = require(appRoot + '/lib/mecab_util.js');
const LCS = require('node-lcs');
const Config = require('config');
const CONST = require(appRoot + '/lib/const.js');

function isDebugMode() {
  return process.env.NODE_ENV != 'production';
}

function getBaseURL() {
  if (isDebugMode()) {
    return 'http://localhost:3000';
  }

  return 'https://www.buzzranking.net';
}

function checkIsEnglishOnlyString(text) {
  for (var i = 0; i < text.length; i++) {
    if (256 <= text.charCodeAt(i)) {
      return false;
    }
  }
  return true;
}

function isValidByStatus(s) {
  return __.contains(CONST.VALID_STATUS_IDS, s);
}

function convertJapaneseDateStrIntoMysqlDate(japaneseDateStr) {
  var after = japaneseDateStr.replace('年', '-').replace('月', '-').replace('日', '');
  var pattern = /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/g;

  return after.match(pattern) ? after : null;
};

function sleep(msec) {
  return new Promise(resolve => setTimeout(resolve, msec));
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

// async function selectProductModels(where = {}) {
//   let productModels = __.flatten(
//     await Promise.all(
//       __.map(ProductUtil.getAllProductModelClass(), Model => {
//         return Model.findAll({
//           where: where,
//         });
//       })
//     )
//   );
//
//   return productModels;
// }
//
// async function selectValidProductModels(where = {}) {
//   var productModels = await selectProductModels(where);
//   var validProductModels = __.filter(productModels, m => {
//     return m.isValid();
//   });
//   return validProductModels;
// }

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

function formatProductName(text) {
  var invalidStaticStringsRegex = new RegExp(CONST.IGNORE_STRINGS_FOR_FORMATTING_PRODUCT_NAME.join('|'), 'g');
  text = text.replace(invalidStaticStringsRegex, '');

  return text.replace(/[ 　]\d+|第\d+巻|\(.*\)|[!"#$%&'・:：()（）【】「」『』［］\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~\u200B]/g, '').trim();
}

function calcNormalizedLevenshteinDistance(strA, strB) {
  if (!strA || !strB) return 1.0;

  var maxStrLength = Math.max(strA.length, strB.length);
  var distance = FastLevenShtein.get(strA, strB);

  return distance / maxStrLength;
}

async function isSuspiciousTitle(text) {
  var formattedText = text;

  if (__.isEmpty(formattedText)) return true;
  if (formattedText.length <= 2) return true;

  var neoUniqueness = await mecabUtil.calcUniqueness(formattedText);
  var ipadicUniqueness = await mecabUtil.calcUniqueness(formattedText, {
    mecab: 'ipadic',
  });
  // var mecabParseResult = await mecab.myParse(formattedText);
  // var mecabNeoParseResult = await mecabNeo.myParse(formattedText);

  if (Math.max(neoUniqueness, ipadicUniqueness) < 30) return true;

  return false;
}

function multiLCS(strings) {
  var commonStr = strings[0];
  for (var i = 1; i < strings.length; i++) {
    commonStr = LCS(commonStr, strings[i]).sequence;
  }
  return commonStr;
}

module.exports = {
  isDebugMode: isDebugMode,
  getBaseURL: getBaseURL,
  convertJapaneseDateStrIntoMysqlDate: convertJapaneseDateStrIntoMysqlDate,
  convertDateObjectIntoMySqlReadableString: convertDateObjectIntoMySqlReadableString,
  isAdminByReq: isAdminByReq,
  calcNormalizedLevenshteinDistance: calcNormalizedLevenshteinDistance,
  formatProductName: formatProductName,
  isValidByStatus: isValidByStatus,
  isSuspiciousTitle: isSuspiciousTitle,
  multiLCS: multiLCS,
  sleep: sleep,

  htmlCache: htmlCache,
  getProductIdToIsNewProductHash: getProductIdToIsNewProductHash,
};
