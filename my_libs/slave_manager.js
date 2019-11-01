const appRoot = require('app-root-path');

async function messageFromMaster(message) {
  console.log(message);
}

function requestProductDataListByStatId() {

}

module.exports = {
  messageFromMaster: messageFromMaster,
  requestProductDataListByStatId: requestProductDataListByStatId,
}
