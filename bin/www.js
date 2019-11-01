#!/usr/bin/env node
const appRoot = require('app-root-path');
const app = require('../app');
const debug = require('debug')('trendranking:server');
const http = require('http');
const cluster = require('cluster');
const expressCluster = require('express-cluster');
var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var server = http.createServer(app);

if (cluster.isMaster) {
  console.log("Im master process :)");
  console.log("PORT: " + port);
}

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

// expressCluster(worker => {
//   console.log("Child process started. id: " + worker.id);
//   global.worker = worker;
//   server.listen(port);
//   server.on('error', onError);
//   server.on('listening', onListening);
//
//   var slaveManager = require(appRoot + '/my_libs/slave_manager.js');;
//   process.on('message', slaveManager.messageFromMaster);
// });
// MASTER
// if (cluster.isMaster) {
//   var masterManager = require(appRoot + '/my_libs/master_manager.js');
//   for (const id in cluster.workers) {
//     cluster.workers[id].on('message', masterManager.requestFromWorker);
//   }
// }

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;

  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
