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

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Auto HTTP => HTTPS
// Don't redirect if the hostname is `localhost:port` or the route is `/insecure`
app.use(redirectToHTTPS([/localhost:(\d{4})/], [/\/health/], 301));

app.use(logger('dev'));
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

app.use('/', require('./routes/index.js'));
app.use('/ranking', require('./routes/ranking.js'));
// app.use('/book', require('./routes/book.js'));
// app.use('/dating', require('./routes/dating.js'));
app.use('/auth', require('./routes/auth.js'));
app.use('/admin', require('./routes/admin.js'));

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.log(err);

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
