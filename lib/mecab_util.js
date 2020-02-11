const Mecab = require('mecab-async');
const fs = require('fs');
const _ = require('underscore');

const PATH_OF_WORD_COUNT_JSON = './wordCountForWiki.json';
Mecab.prototype.myParse = function (text) {
  var that = this;
  return new Promise((resolve, reject) => {
    that.parse(text, function (err, result) {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}
Mecab.prototype.myWakachi = function (text) {
  var that = this;
  return new Promise((resolve, reject) => {
    that.wakachi(text, function (err, result) {
      if (err) {
        return reject(err);
      }
      return resolve(result);
    });
  });
}
var mecabNeo = (() => {
  var instance = new Mecab();
  return instance;
})();
var mecab = (() => {
  var instance = new Mecab();
  instance.command = 'mecab -d /usr/local/lib/mecab/dic/ipadic';
  return instance;
})();
var wordCountJson = JSON.parse(fs.readFileSync(PATH_OF_WORD_COUNT_JSON, 'utf-8'));
var globalWordCountHash = wordCountJson.globalWordCountHash || {};
var documentNum = 6065730;

async function calcUniqueness(totalText, options = {}) {
  var targetMecabInstance = options.mecab == 'ipadic' ? mecab : mecabNeo;
  var parseResult = await targetMecabInstance.myParse(totalText);

  // var [mecabNeoParseResult, mecabParseResult] = await Promise.all([
  //   mecabNeo.myParse(totalText),
  //   mecab.myParse(totalText),
  // ]);

  var targetWords = _.chain(parseResult)
    // .filter(result => {
    //   var word = result[0];
    //   var wordClass = result[1];
    //   return _.contains(['名詞', '動詞'], wordClass);
    // })
    .map(result => {
      var word = result[0];
      return word;
    })
    .value();

  // total IDF
  return _.reduce(targetWords, (memo, word) => {
    return memo + calcIDF(word);
  }, 0);

  // var uniqueness = 0;
  // for (var i = 0; i < targetWords.length; i++) {
  //   var word = targetWords[i];
  //   var wordIncludingDocumentNum = globalWordCountHash[word] || 1;
  //   // var deepMecabParseResult = await mecab.myParse(word);
  //
  //   var uniq = (10000 / wordIncludingDocumentNum);
  //
  //   uniqueness += uniq;
  // }
  // return uniqueness;
}

async function calcUniqueness2(totalText, options = {}) {
  var targetMecabInstance = options.mecab == 'ipadic' ? mecab : mecabNeo;
  var parseResult = await targetMecabInstance.myParse(totalText);

  // var [mecabNeoParseResult, mecabParseResult] = await Promise.all([
  //   mecabNeo.myParse(totalText),
  //   mecab.myParse(totalText),
  // ]);

  var targetWords = _.chain(parseResult)
    // .filter(result => {
    //   var word = result[0];
    //   var wordClass = result[1];
    //   return _.contains(['名詞', '動詞'], wordClass);
    // })
    .map(result => {
      var word = result[0];
      return word;
    })
    .value();

  var uniqueness = 0;
  for (var i = 0; i < targetWords.length; i++) {
    var word = targetWords[i];
    var wordIncludingDocumentNum = globalWordCountHash[word] || 1;
    // var deepMecabParseResult = await mecab.myParse(word);

    var uniq = (10000 / wordIncludingDocumentNum);

    uniqueness += uniq;
  }
  return uniqueness;
}


function calcIDF(text) {
  var wordIncludingDocumentNum = globalWordCountHash[text] || 1;
  var idf = Math.LOG2E * Math.log(documentNum / wordIncludingDocumentNum);
  return idf;
}

function calcTemp(word) {
  var wordIncludingDocumentNum = globalWordCountHash[word] || 1;
  var uniqueness = documentNum / wordIncludingDocumentNum;
  return uniqueness;
}

async function calcMaxIDF(text, options) {
  var [mecabNeoWakachiedWords, mecabWakachiedWords] = await Promise.all([
    mecabNeo.myWakachi(text),
    mecab.myWakachi(text),
  ]);

  var targetWords = mecabNeoWakachiedWords;

  var calcIDFs = (words) => {
    return _.map(words, word => {
      var wordIncludingDocumentNum = globalWordCountHash[word] || 1;
      var idf = Math.LOG2E * Math.log(documentNum / wordIncludingDocumentNum);
      return idf;
    });
  }

  if (options.coverageRate) {
    targetWords = _.filter(targetWords, word => {
      var coverageRate = (word.length / text.length) * 100;
      return options.coverageRate <= coverageRate;
    });
  }

  if (options.minLength) {
    targetWords = _.filter(targetWords, word => {
      return options.minLength <= word.length;
    });
  }

  if (options.minDeepMaxIDF) {
    var tempWords = [];
    for (var i = 0; i < targetWords.length; i++) {
      var word = targetWords[i];
      var deepWakachiedWords = await mecab.myWakachi(word);

      // if (options.coverageRate) {
      //   deepWakachiedWords = _.filter(deepWakachiedWords, word => {
      //     var coverageRate = (word.length / textLength) * 100;
      //     return options.coverageRate <= coverageRate;
      //   });
      // }

      var idfs = calcIDFs(deepWakachiedWords);
      var deepWordsMaxIdf = _.max(idfs);
      if (deepWordsMaxIdf <= options.minDeepMaxIDF) continue;
      tempWords.push(word);
    }
    targetWords = tempWords;
  }

  // console.log(targetWords);

  var targetIdfs = calcIDFs(targetWords);

  var maximumIDF = targetIdfs.length ? _.max(targetIdfs) : 0;
  return maximumIDF;
};

// var maxIDF = await calcMaxIDF(mecabNeoWakachiedWords, {
//   coverageRate: 40,
//   minLength: 3,
//   minDeepMaxIDF: 8,
// });

function getMecabInstance() {
  return mecab;
}

function getMecabNeoInstance() {
  return mecabNeo;
}

module.exports = {
  calcUniqueness: calcUniqueness,
  calcUniqueness2: calcUniqueness2,

  getMecabInstance: getMecabInstance,
  getMecabNeoInstance: getMecabNeoInstance,

  calcMaxIDF: calcMaxIDF,
};
