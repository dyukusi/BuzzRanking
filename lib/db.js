var mysql = require('mysql');
var Config = require('config');
var c = Config['db'];

var dbConfig = {
  host: c.host,
  user: c.user,
  password: c.password,
  database: c.database,
  charset : c.charset,
};

var connection = mysql.createConnection(dbConfig);

module.exports = connection;
