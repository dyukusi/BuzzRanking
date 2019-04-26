process.on('uncaughtException', function (err) {
  console.log(err);
});

var appRoot = require('app-root-path');
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
// var session = require('express-session');

var redirectToHTTPS = require('express-http-to-https').redirectToHTTPS

// global vars
global.Config = require('config');
global.appRoot = require('app-root-path');
global.__ = require('underscore');
global.sprintf = require('sprintf-js').sprintf;
global.async = require('async');

var indexRouter = require('./routes/index.js');
var bookRouter = require('./routes/book.js');

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

app.use('/', indexRouter);
app.use('/book', bookRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
