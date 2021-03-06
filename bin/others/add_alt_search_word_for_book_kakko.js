const appRoot = require('app-root-path');
const Util = require(appRoot + '/lib/util.js');
const Tweet = require(appRoot + '/models/tweet');
const _ = require('underscore');
const Moment = require('moment');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const TwitterAlternativeSearchWord = require(appRoot + '/models/twitter_alternative_search_word');

main()
  .then(() => {
    console.log("finish");
  });

async function main() {
  var bookRows = (await sequelize.query('SELECT * FROM book WHERE title LIKE "%（%）%" OR title LIKE "%(%)%"'))[0];

  for (var i = 0; i < bookRows.length; i++) {
    var bookRow = bookRows[i];
    console.log(bookRow);
    var productId = bookRow.product_id;
    var title = bookRow.title;

    await insertAltWordIfNeed(productId, title);
  }
}

async function insertAltWordIfNeed(productId, title) {
  if(!title.match(/[\(\（]\d+[\)\）]/)) return;
  var trimmedTitle = title.replace(/[\(\（]\d+[\)\）]/g, '').trim();

  await TwitterAlternativeSearchWord.insertIfValid(productId, trimmedTitle);

  return;
}
