process.on('uncaughtException', function (err) {
  console.log(err);
});

var appRoot = require('app-root-path');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var passport = require('passport');
var session = require('express-session');
var rfs = require("rotating-file-stream");
var ReleaseControl = require(appRoot + '/models/release_control.js');
// var UAParser = require('ua-parser-js');

var redirectToHTTPS = require('express-http-to-https').redirectToHTTPS

// global vars
global.Config = require('config');
global.appRoot = require('app-root-path');
global.__ = require('underscore');
global.sprintf = require('sprintf-js').sprintf;
global.async = require('async');
global.myUtil = require(appRoot + '/my_libs/util.js');
global.Const = require(appRoot + '/my_libs/const.js');
global.Q = require('q');
global.sleep = msec => new Promise(resolve => setTimeout(resolve, msec));

var app = express();

var accessLogStream = rfs('access.log', {
  size:'10MB',
  interval: '10d',
  compress: 'gzip',
  path: './log/',
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Auto HTTP => HTTPS
// Don't redirect if the hostname is `localhost:port` or the route is `/insecure`
app.use(redirectToHTTPS([/localhost:(\d{4})/], [/\/health/], 301));

app.use(logger('short', {
  stream: accessLogStream,
  skip: (req, res) => {
    var url = req.url;
    if(url.indexOf('?') > 0) url = url.substr(0,url.indexOf('?'));
    if(url.match(/(health|jpg)$/ig)) {
      return true;
    }
    return false;
  },
}));

app.use(express.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  resave: false,
  secret: 'buzzranking_session_secret',
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

// check cached ranking
app.use((req, res, next) => {
  (async () => {
    var latestReleaseControlModel = await ReleaseControl.selectLatestReleaseDate();
    var targetMoment = latestReleaseControlModel.getDateMoment();

    if (myUtil.isCachedRanking(targetMoment)) {
      next();
    } else {
      // need wait for building ranking obj by buildLatestRankingPoller or admin
      var statusCode = 503; // maintenance code
      res.status(statusCode);
      res.render('error', {
        status: 503,
        dispMessage: Const.ERROR_MESSAGE.IN_PREPARING_RANKING,
      });
    }
  })();
});

app.use('/', require('./routes/index.js'));
app.use('/product', require('./routes/product.js'));
app.use('/ranking', require('./routes/ranking.js'));
app.use('/auth', require('./routes/auth.js'));
app.use('/admin', require('./routes/admin.js'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(__.extend(createError(404), {
    dispMessage: Const.ERROR_MESSAGE["404"],
  }));
});

// error handler
app.use(function (err, req, res, next) {
  var status = err.status || 500;

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.error(err);

  // render the error page
  res.status(status);
  res.render('error', {
    status: status,
    dispMessage: err.dispMessage || Const.ERROR_MESSAGE.DEFAULT,
  });
});

module.exports = app;
