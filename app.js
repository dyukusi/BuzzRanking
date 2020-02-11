const appRoot = require('app-root-path');
const createError = require('http-errors');
const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const passport = require('passport');
const session = require('express-session');
const rfs = require("rotating-file-stream");
const redirectToHTTPS = require('express-http-to-https').redirectToHTTPS;

const __ = require('underscore');
const CONST = require(appRoot + '/lib/const.js');

var app = express();

// import modules used in client side from node_modules directory
// app.use("/amcharts4", express.static(__dirname + "/node_modules/@amcharts/amcharts4/"));

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

// add 'require' function in ejs template code
app.use(function (req, res, next) {
  var _render = res.render;
  res.render = function (view, options, fn) {
    // extend config and continue with original render
    options = options || {};
    options.require = require;

    // options.config = config;
    // options.moment = moment;
    // if (req.user && req.user.toJSON) {
    //   options.user = req.user.toJSON();
    // }
    _render.call(this, view, options, fn);
  }
  next();
});

app.use('/', require('./routes/index.js'));
app.use('/', require('./routes/ranking.js'));

app.use('/product', require('./routes/product.js'));
app.use('/product-bundle', require('./routes/product-bundle.js'));
app.use('/twitter', require('./routes/twitter.js'));
app.use('/auth', require('./routes/auth.js'));
app.use('/admin', require('./routes/admin.js'));
app.use('/api', require('./routes/api.js'));

// for redirect
app.use('/', require('./routes/old_url_redirector.js'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(__.extend(createError(404), {
    dispMessage: CONST.ERROR_TYPE_NAME_TO_MESSAGE_HASH["404"],
  }));
});

// error handler
app.use(function (err, req, res, next) {
  var status = err.status || 500;

  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.log("Request URL: " + req.url);
  console.error(err);

  if (res.sendResponse) {
    res.send = res.sendResponse;
  }

  // render the error page
  res.status(status);
  res.render('error', {
    status: status,
    dispMessage: err.dispMessage || CONST.ERROR_TYPE_NAME_TO_MESSAGE_HASH.DEFAULT,
  });
});

process.on('uncaughtException', function (err) {
  console.log(err);
});

module.exports = app;
