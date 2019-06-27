var express = require('express');
var router = express.Router();
var passport = require('passport');
var passportGoogleOauth = require('passport-google-oauth2');
const Config = require('config');
const GoogleStrategy = passportGoogleOauth.Strategy;

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((user, done) => {
  done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: Config.google_oauth_api.client_id,
    clientSecret: Config.google_oauth_api.client_secret,
    callbackURL: Config.google_oauth_api.callback_url,
  },
  function (request, accessToken, refreshToken, profile, done) {
    return done(null, profile);
  }
));

router.get(
  '/',
  passport.authenticate('google', {
    scope: ['email', 'profile']
  }));

router.get(
  // OAuth 2 callback url. Use this url to configure your OAuth client in the
  // Google Developers console
  '/google/callback',

  // Finish OAuth 2 flow using Passport.js
  passport.authenticate('google', {
    successRedirect: '/admin',
    failureRedirect: '/error'
  })
);

module.exports = router;
