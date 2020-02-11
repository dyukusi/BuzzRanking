const appRoot = require('app-root-path');
const __ = require('underscore');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');
const ProductBase = require(appRoot + '/models/product_base');
const Moment = require('moment');

class Movie extends ProductBase {
  // ------------------- Instance Methods -------------------
  getImageURL() {
    return this.posterUrl;
  }

  getReleaseDateMoment() {
    return new Moment(this.releaseDate);
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

Movie.init({
    productId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      primaryKey: true,
      field: 'product_id'
    },
    productTypeId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'product_type_id'
    },
    productBundleId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: true,
      field: 'product_bundle_id'
    },
    tmdbMovieId: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      unique: true,
      field: 'tmdb_movie_id',
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title'
    },
    originalTitle: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'original_title'
    },
    posterUrl: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'poster_url'
    },
    backdropUrl: {
      type: Sequelize.TEXT,
      allowNull: true,
      field: 'backdrop_url'
    },
    originalLang: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'original_lang'
    },
    genreIds: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'genre_ids'
    },
    validityStatus: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'validity_status'
    },
    releaseDate: {
      type: Sequelize.DATE,
      allowNull: true,
      field: 'release_date'
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
    modelName: 'movie',
    timestamps: false,
    sequelize
  }
);

module.exports = Movie;
