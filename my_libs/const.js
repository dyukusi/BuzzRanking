const appRoot = require('app-root-path');
const _ = require('underscore');
const Book = require(appRoot + '/models/book');
const Game = require(appRoot + '/models/game');
const WebService = require(appRoot + '/models/web_service');
const Anime = require(appRoot + '/models/anime');
const Movie = require(appRoot + '/models/movie');

const CONST = {
  PRODUCT_MODELS: [
    Book,
    Game,
    WebService,
    Anime,
    Movie,
  ],

  PRODUCT_TYPE_NAME_TO_ID_HASH: {
    'comic': 1,
    'dating_service': 2,
    'console_game': 3,
    'novel': 4,
    'it': 5,
    'inn_reservation': 6,
    'portable_game': 7,
    'anime': 8,
    'movie': 9,
  },

  PRODUCT_TYPE_BUNDLE_NAME_TO_ID: {
    'all': 999,
    'book': 1,
    'game': 2,
    'dating': 3,
    'inn': 4,
    'anime': 5,
    'movie': 6,
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
    '交換',
  ],

  VALIDITY_STATUS_NAME_TO_ID: {
    'normal': 0,
    'suspicious': 1,
    'protected': 2, // manually checked as valid product
    'overTweetCountLimit': 3,
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
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['movie']]: [
      CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['movie']
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
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['movie']]: '映画',
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
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['movie']]: '映画',
  },

  PRODUCT_TYPE_BUNDLE_ID_TO_FONT_AWESOME_CLASS: {
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']]: 'fas fa-globe',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['book']]: 'fas fa-book-reader',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['game']]: 'fas fa-gamepad',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['dating']]: 'fas fa-heart',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['inn']]: 'fas fa-hotel',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['anime']]: 'fab fa-earlybirds',
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['movie']]: 'fas fa-film',
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

  NAV_BUNDLE_ID_ORDER: [
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all'],
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['book'],
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['game'],
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['anime'],
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['movie'],
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['inn'],
    CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['dating'],
  ],

  RANKING_PAGE_META: {
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']]: {
      title: '1000万以上のネットの声を基にした、生々しいリアルなランキングをお届け！本・書籍・ゲーム・映画・アニメ・旅行などあらゆるもののランキング総合サイト',
      desc: 'あなたは世論を100%反映した、本当のランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['book']]: {
      title: '1000万以上のネットの声を基にした、本当の人気本・書籍ランキング ',
      desc: 'あなたは世論を100%反映した、本当の人気本・書籍ランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['game']]: {
      title: '1000万以上のネットの声を基にした、本当のゲームランキング ',
      desc: 'あなたは世論を100%反映した、本当の人気ゲームランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['inn']]: {
      title: '1000万以上のネットの声を基にした、本当の旅行・宿泊予約サービスランキング ',
      desc: 'あなたは世論を100%反映した、人気旅行・宿泊予約サービスランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['dating']]: {
      title: '1000万以上のネットの声を基にした、本当の出会い・マッチングサービスランキング ',
      desc: 'あなたは世論を100%反映した、本当の出会い・マッチングサービスランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['anime']]: {
      title: '1000万以上のネットの声を基にした、本当のアニメランキング ',
      desc: 'あなたは世論を100%反映した、本当の人気アニメランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
    [CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['movie']]: {
      title: '1000万以上のネットの声を基にした、本当の映画ランキング ',
      desc: 'あなたは世論を100%反映した、本当の人気映画ランキングを見たことがありますか？ネット上の1000万以上のユーザーの声を基に、恣意的操作一切なしでそのままランキングに反映することによって、リアルで生々しい世間の評価、感想をそのままお見せします！',
    },
  },

  PRODUCT_DETAIL_PAGE_TEXTS: {
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['comic']]: {
      title: '1000万以上のネットの声を基にした%sを読むべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは本当に読むべきか？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、ご購入を考えている方は必見です！',
      promo: 'を読むべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['novel']]: {
      title: '1000万以上のネットの声を基にした%sを読むべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは本当に読むべきか？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、ご購入を考えている方は必見です！',
      promo: 'を読むべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['it']]: {
      title: '1000万以上のネットの声を基にした%sを読むべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは本当に読むべきか？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、ご購入を考えている方は必見です！',
      promo: 'を読むべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['console_game']]: {
      title: '1000万以上のネットの声を基にした%sをプレイすべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは本当に神ゲーなのか？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、プレイを検討している方は必見です！',
      promo: 'をプレイすべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['portable_game']]: {
      title: '1000万以上のネットの声を基にした%sをプレイすべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは本当に神ゲーなのか？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、プレイを検討している方は必見です！',
      promo: 'をプレイすべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['dating_service']]: {
      title: '1000万以上のネットの声を基にした%sが本当に出会える理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sって本当に出会えるの？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、利用を検討している方は必見です！',
      promo: 'を使うべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['inn_reservation']]: {
      title: '1000万以上のネットの声を基にした%sで予約するべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '旅行予約なら絶対%s？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、利用を検討している方は必見です！',
      promo: 'を使うべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['anime']]: {
      title: '1000万以上のネットの声を基にした%sを観るべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは絶対に観ておくべき！？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方、視聴を検討している方は必見です！',
      promo: 'を観るべき理由まとめ',
    },
    [CONST.PRODUCT_TYPE_NAME_TO_ID_HASH['movie']]: {
      title: '1000万以上のネットの声を基にした%sを観るべき理由まとめ ネットの注目度、感想、評判は？',
      desc: '%sは絶対に観ておくべき！？1000万以上のネットの声を基にしたリアルな評判をまとめてみました。%sが気になっている方は必見です！',
      promo: 'を観るべき理由まとめ',
    },
  },

};

var REFERENCE_REFERENCE_CONST = {
  PRODUCT_TYPE_ID_TO_BELONGED_PRODUCT_TYPE_BUNDLE_ID: (() => {
    var result = {};
    _.each(REFERENCE_CONST.PRODUCT_TYPE_BUNDLE_ID_TO_PRODUCT_TYPE_IDS, (productTypeIds, productTypeBundleId) => {
      if (productTypeBundleId == CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID['all']) return;
      _.each(productTypeIds, productTypeId => {
        result[productTypeId] = productTypeBundleId;
      });
    });
    return result;
  })(),
};


module.exports = _.extend(CONST, REFERENCE_CONST, REFERENCE_REFERENCE_CONST);
