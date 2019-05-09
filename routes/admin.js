var express = require('express');
var router = express.Router();

function isAdmin(req, res, next) {
  var email = req.user ? req.user.email : null;

  if (email == Config.admin_gmail_address) {
    return next();
  }
  else {
    res.redirect('/auth');
  }
}

router.get('/', isAdmin, function(req, res, next) {
  res.render('admin', {});
});

module.exports = router;
