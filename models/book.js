const appRoot = require('app-root-path');
const Q = require('q');
const __ = require('underscore');
const DBUtil = require(appRoot + '/my_libs/db_util.js');
const Sequelize = require('sequelize');
const sequelize = require(appRoot + '/db/sequelize_config');

class Book extends Sequelize.Model {
  // ------------------- Instance Methods -------------------
  getProductName() {
    return this.title;
  }

  // ------------------- Class Methods -------------------
  static selectByProductIds(productIds) {
    return this.findAll({
      where: {
        productId: productIds,
      }
    });
  }

  static selectByProductTypeIds(productTypeIds, options) {
    var where = {
      productTypeId: productTypeIds,
    };

    if (options.excludeUndefinedReleaseDate) {
      where['$ne'] = '9999-12-31';
    }

    return this.findAll({
      where: where,
    });
  }

  static selectByISBNCodes(isbnCodes) {
    return this.findAll({
      where: {
        isbnCode: isbnCodes,
      }
    });
  }

  static bulkInsert(insertObjects) {
    return DBUtil.productBulkInsertUpdateOnDuplicate(Book, insertObjects);
  }
}

Book.init({
    productId: {
      type: Sequelize.INTEGER(10).UNSIGNED,
      allowNull: false,
      field: 'product_id',
      primaryKey: true,
    },
    productTypeId: {
      type: Sequelize.INTEGER(11),
      allowNull: false,
      field: 'product_type_id'
    },
    isbnCode: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'isbn_code',
      unique: true,
    },
    title: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title'
    },
    titleKana: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'title_kana'
    },
    subTitle: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'sub_title'
    },
    subTitleKana: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'sub_title_kana'
    },
    series: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'series'
    },
    seriesKana: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'series_kana'
    },
    contents: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'contents'
    },
    author: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'author'
    },
    authorKana: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'author_kana'
    },
    publisher: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'publisher'
    },
    size: {
      type: Sequelize.STRING(255),
      allowNull: false,
      field: 'size'
    },
    caption: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'caption'
    },
    itemUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'item_url'
    },
    affiliateItemUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'affiliate_item_url'
    },
    imageUrlBase: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'image_url_base'
    },
    chirayomiUrl: {
      type: Sequelize.TEXT,
      allowNull: false,
      field: 'chirayomi_url'
    },
    price: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'price'
    },
    reviewCount: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'review_count'
    },
    reviewRateAverage: {
      type: Sequelize.INTEGER(11).UNSIGNED,
      allowNull: false,
      field: 'review_rate_average'
    },
    genreId: {
      type: Sequelize.STRING(255),
      allowNull: false,
      defaultValue: '',
      field: 'genre_id'
    },
    saleDateStr: {
      type: Sequelize.STRING(30),
      allowNull: true,
      field: 'sale_date_str'
    },
    saleDate: {
      type: Sequelize.DATEONLY,
      allowNull: false,
      field: 'sale_date'
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
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
    modelName: 'book',
    sequelize
  }
);

module.exports = Book;
