const appRoot = require('app-root-path');
const __ = require('underscore');
const Moment = require('moment');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const ProductBase = require(appRoot + '/models/product_base');
const CONST = require(appRoot + '/lib/const.js');

class Anime extends ProductBase {
  // ------------------- Instance Methods -------------------
  getImageURL() {
    var ogpImageURL = this.ogpImageUrl;
    var siteThumbnailURL = "http://capture.heartrails.com/300x300?" + this.publicUrl;
    // var siteThumbnailURL = "https://blinky.nemui.org/shot/large?" + officialSiteURL;

    return ogpImageURL || siteThumbnailURL;
  }

  getReleaseDateMoment() {
    var month = CONST.ANIME_COUR_INTO_MONTH_HASH[this.cours];
    var dateStr = this.year + '-' + ('0' + month).slice(-2);
    return new Moment(dateStr);
  }

  isNewReleasedProductByMoment(moment) {
    var baseMoment = moment.clone();

    var releaseMoment = this.getReleaseDateMoment();
    var thresholdMoment = releaseMoment.clone().subtract(7, 'day');

    // normally 1 cour Anime = 3 months. +1 for extra evaluation term
    return thresholdMoment.unix() <= baseMoment.unix() &&
        baseMoment.unix() <= releaseMoment.add(120, 'day').unix();
  }
  // ------------------- Class Methods -------------------
}

Anime.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_id'
    },
    productTypeId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_type_id'
    },
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: true,
      field: 'product_bundle_id'
    },
    shangrilaId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      unique: true,
      field: 'shangrila_id'
    },
    year: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'year'
    },
    cours: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'cours'
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title'
    },
    publicUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'public_url'
    },
    ogpImageUrl: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'ogp_image_url'
    },
    twitterAccount: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'twitter_account'
    },
    twitterHashTag: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'twitter_hash_tag'
    },
    sex: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'sex'
    },
    sequel: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'sequel'
    },
    cityCode: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'city_code'
    },
    cityName: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'city_name'
    },
    productCompany: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'product_company'
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
      allowNull: true,
      defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      field: 'created_at'
    },
  }, {
    freezeTableName: true,
    underscored: true,
    modelName: 'anime',
    sequelize
  }
);

module.exports = Anime;
