var express = require('express');
var router = express.Router();

router.get('/', function (req, res, next) {
  res.render('index', {});
});

router.get('/health', function (req, res, next) {
  res.render('health', {});
});

module.exports = router;
