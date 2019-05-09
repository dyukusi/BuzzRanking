exports.convertJapaneseDateStrIntoMysqlDate = function (japaneseDateStr) {
  var after = japaneseDateStr.replace('年', '-').replace('月', '-').replace('日', '');
  var pattern = /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/g;

  return after.match(pattern) ? after : '9999-12-31';
};

// XXXX年XX月XX日　XX:XX
exports.convertDateObjectIntoJapaneseDateString = function (date) {
  return sprintf(
    '%s年%s月%s日',
    date.getFullYear(), date.getMonth() + 1, date.getDate()
  );
};

exports.generateStatRangeJapaneseString = function (baseDate) {
  var tempDate = new Date(baseDate);
  var oneWeekAgo = new Date(tempDate.setDate(tempDate.getDate() - 7));

  return sprintf(
    '%s ~ %s',
    this.convertDateObjectIntoJapaneseDateString(oneWeekAgo),
    this.convertDateObjectIntoJapaneseDateString(baseDate)
  );
};

exports.isAdminByReq = function (req) {
  var email = req.user ? req.user.email : null;
  return email == Config.admin_gmail_address;
}

// middle wares
exports.htmlCache = function(cacheDurationSec) {
  return (req, res, next) => {
    let key = '__express__' + req.originalUrl || req.url
    let cachedBody = mcache.get(key)
    if (cachedBody) {
      res.send(cachedBody)
      return
    } else {
      res.sendResponse = res.send
      res.send = (body) => {
        mcache.put(key, body, duration * 1000);
        res.sendResponse(body)
      }
      next()
    }
  };
}
