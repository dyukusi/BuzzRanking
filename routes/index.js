var express = require('express');
var router = express.Router();
const Config = require('config');
const cluster = require('cluster');

router.get('/', async function (req, res, next) {
  res.render('index', {});
});

router.get('/faq', async function (req, res, next) {
  res.render('faq', {});
});

router.get('/privacy_policy', async function (req, res, next) {
  res.render('privacy_policy', {});
});

router.get('/profile', async function (req, res, next) {
  res.render('profile', {});
});

router.get('/sitemap', function (req, res, next) {
  res.render('sitemap', {});
});

router.get('/health', function (req, res, next) {
  res.render('health', {});
});

router.get('/ads.txt', function (req, res, next) {
  res.send(Config.google_adsense_ads_txt);
});

module.exports = router;
