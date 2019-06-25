const Config = require('config');
const c = Config['db'];
const Sequelize = require('sequelize');

const dbConfig = new Sequelize(
  c.database,
  c.user,
  c.password,
  {
    host: c.host,
    dialect: 'mysql',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    logging: false,
    timezone: "+09:00",
  }
);

module.exports = dbConfig;
