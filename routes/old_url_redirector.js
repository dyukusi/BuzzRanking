const appRoot = require('app-root-path');
const express = require('express');
const router = express.Router();
const UrlGenerator = require(appRoot + '/lib/url_generator.js');
const CONST = require(appRoot + '/lib/const.js');
const ProductUtil = require(appRoot + '/lib/product_util.js');
const __ = require('underscore');

router.get('/ranking/', async function (req, res, next) {
  var url = UrlGenerator.generateRankingPageURL({});
  return res.redirect(url);
});

router.get('/ranking/:productTypeBundleName', async function (req, res, next) {
  var productTypeBundleName = req.params.productTypeBundleName;

  if (!productTypeBundleName) {
    productTypeBundleName = 'all';
  }

  var productTypeBundleId = CONST.PRODUCT_TYPE_BUNDLE_NAME_TO_ID_HASH[productTypeBundleName.toUpperCase()];

  var url = UrlGenerator.generateRankingPageURL({
    productTypeBundleId,
  });

  return res.redirect(url);
});

router.get('/product/detail/:productId', async function (req, res, next) {
  var productId = +req.params.productId;

  if (!productId) {
    return next('specified product id is invalid: ' + productId);
  }

  var productModel = (await ProductUtil.selectProductModels({
    productId: productId,
  }))[0];

  if (__.isEmpty(productModel) || !productModel.productBundleId) {
    return next('could not find bundle of the product: ' + productId);
  }

  var productBundleId = productModel.productBundleId;
  var url = UrlGenerator.generateProductBundleDetailPageURL(productBundleId);
  return res.redirect(url);
});

module.exports = router;
