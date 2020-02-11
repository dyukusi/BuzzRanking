const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const ProductBase = require(appRoot + '/models/product_base');
const Moment = require('moment');

class Game extends ProductBase {
  // ------------------- Instance Methods -------------------
  getImageURL() {
    return this.imageUrlBase;
  }

  getReleaseDateMoment() {
    if (this.saleDate) {
      return new Moment(this.saleDate);
    }

    var dateStr = '';
    var yearMatch = this.saleDateStr.match(/(\d+)年/);

    if (!yearMatch) {
      return new Moment(this.createdAt);
    }

    dateStr += yearMatch[1];

    var monthMatch = this.saleDateStr.match(/(\d+)月/);

    if (!monthMatch) {
      return new Moment(dateStr + '-12-31');
    }

    dateStr += '-' + monthMatch[1];

    var dayMatch = this.saleDateStr.match(/(\d+)日/);

    if (!dayMatch) {
      return new Moment(dateStr + '');
    }

    dateStr += '-' + dayMatch[1];

    return new Moment(dateStr + '');
  }

  isNewReleasedProductByMoment(moment) {
    var baseMoment = moment.clone();

    var releaseMoment = this.getReleaseDateMoment();
    var thresholdMoment = releaseMoment.clone().subtract(7, 'day');

    // normally 1 cour Anime = 3 months. +1 for extra evaluation term
    return thresholdMoment.unix() <= baseMoment.unix() &&
      baseMoment.unix() <= releaseMoment.add(60, 'day').unix();
  }

  // ------------------- Class Methods -------------------
}

Game.init({
    productId: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      autoIncrement: true,
      field: 'product_id'
    },
    productTypeId: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      field: 'product_type_id'
    },
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: true,
      field: 'product_bundle_id'
    },
    janCode: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      unique: true,
      field: 'jan_code'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title'
    },
    titleKana: {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: '',
      field: 'title_kana'
    },
    makerCode: {
      type: Sequelize.STRING(255),
      allowNull: true,
      defaultValue: '',
      field: 'maker_code'
    },
    caption: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'caption'
    },
    rakutenAffiliateItemUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'rakuten_affiliate_item_url'
    },
    imageUrlBase: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'image_url_base'
    },
    genreId: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'genre_id'
    },
    saleDateStr: {
      type: Sequelize.STRING(30),
      allowNull: false,
      defaultValue: '',
      field: 'sale_date_str'
    },
    saleDate: {
      type: Sequelize.DATEONLY,
      allowNull: true,
      field: 'sale_date'
    },
    validityStatus: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'validity_status'
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'updated_at'
    },
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    }
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'game',
    sequelize
  }
);

module.exports = Game;
