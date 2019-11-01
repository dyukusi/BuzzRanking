const appRoot = require('app-root-path');
const _ = require('underscore');
const Book = require(appRoot + '/models/book');
const Game = require(appRoot + '/models/game');
const WebService = require(appRoot + '/models/web_service');
const Anime = require(appRoot + '/models/anime');

const CONST = {
  PRODUCT_MODELS: [
    Book,
    Game,
    WebService,
    Anime
  ],

  // PRODUCT_TABLE_NAMES: [
  //   'book',
  //   'game',
  //   'web_service',
  //   'anime',
  // ],

  PRODUCT_TYPE_NAME_TO_ID_HASH: {
    'comic': 1,
    'dating_service' : 2,
    'console_game': 3,
    'novel': 4,
    'it': 5,
    'inn_reservation': 6,
    'portable_game': 7,
    'anime': 8,
  },

  PRODUCT_TYPE_BUNDLE_NAME_TO_ID: {
    'all': 999,
    'book': 1,
    'game': 2,
    'dating': 3,
    'inn': 4,
    'anime': 5,
  },

  ERROR_MESSAGE: {
    'DEFAULT': '内部エラーが発生しました',
    '404': 'お探しのページを見つけることができませんでした',
    'PAGE_EXCEEDED': '存在しないページ番号が指定されています',
    'IN_PREPARING_RANKING': '最新のランキングを生成中です。<br>しばらく経ってから再度アクセスしてください。',
  },

  THRESHOLD_COUNT_OF_OUT_OF_RANGE_USER_COUNT: 30,

  STR_LENGTH_FOR_CALC_LSD: 20,

  PRODUCT_NUM_PER_PAGE: 10,

  INITIAL_DISPLAY_TWEET_NUM_IN_RANKING: 3,

  DEPRIORITIZE_WORDS_IN_TWEET_TEXT: [
    '実況',
    '今日買った漫画',
    '#自分の趣味全開で',
  ],

  VALIDITY_STATUS_NAME_TO_ID: {
    'normal': 0,
    'suspicious': 1,
    'protected': 2, // manually checked as valid product
    'invalid': 99, // manually checked as "invalid" product
  },
};

const REFERENCE_CONST = {
  PRODUCT_TYPE_ID_TO_NAME_HASH: _.invert(CONST.PRODUCT_TYPE_NAME_TO_ID_HASH),

  PRODUCT_TYPE_BUNDLE_ID_TO_NAME_HASH: _.invert(CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID),

  PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS: {
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['book']]: [
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['comic'],
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['novel'],
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['it'],
    ],
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['game']]: [
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['console_game'],
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['portable_game'],
    ],
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['inn']]: [
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['inn_reservation']
    ],
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['dating']]: [
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['dating_service']
    ],
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['anime']]: [
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['anime']
    ],
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']]: _.values(CONST.PRODUCT_TYPE_NAME_TO_ID_HASH),
  },

  PRODUCT_TYPE_BUNDLE_ID_TO_JA_NAME_HASH: {
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']]: '総合',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['book']]: '本・書籍',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['game']]: 'ゲーム',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['dating']]: '出会い',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['inn']]: '宿泊・旅行予約',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['anime']]: 'アニメ',
  },

  PRODUCT_TYPE_ID_TO_JA_NAME_HASH: {
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['comic']]: '漫画',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['novel']]: '小説',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['it']]: 'IT・プログラミング',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['dating_service']]: '出会い',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['console_game']]: '据え置き型ゲーム',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['inn_reservation']]: '宿泊・旅行予約サービス',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['portable_game']]: '携帯ゲーム',
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['anime']]: 'アニメ',
  },

  PRODUCT_TYPE_BUNDLE_ID_TO_FONT_AWESOME_CLASS: {
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']]: 'fas fa-globe',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['book']]: 'fas fa-book-reader',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['game']]: 'fas fa-gamepad',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['dating']]: 'fas fa-heart',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['inn']]: 'fas fa-hotel',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['anime']]: 'fab fa-earlybirds',
  },

  EXCEPTION_NO_BUZZ_NUM_THRESHOLD_PRODUCT_TYPE_IDS: [
    CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['dating_service'],
    CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['inn_reservation'],
  ],

  PRODUCT_MODEL_NAME_TO_MODEL_CLASS: _.indexBy(CONST.PRODUCT_MODELS, modelClass => {
    return modelClass.name;
  }),

  VALID_STATUS_IDS: [
    CONST.VALIDITY_STATUS_NAME_TO_ID.normal,
    CONST.VALIDITY_STATUS_NAME_TO_ID.protected,
  ],
};

var PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID = {};
_.each(REFERENCE_CONST.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS, (productTypeIds, productTypeBundleId) => {

  if (productTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']) {
    return;
  }

  _.each(productTypeIds, productTypeId => {
    PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID[productTypeId] = productTypeBundleId;
  });
});
REFERENCE_CONST['PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID'] = PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID;

module.exports = _.extend(CONST, REFERENCE_CONST);
