const request = require('request');
const fs = require('fs');

request({
  url: 'https://sandboxapi.g2a.com/v1/products',
  method: 'GET',
  q: {
    page: 10,
  },
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'qdaiciDiyMaTjxMt, 74026b3dc2c6db6a30a73e71cdb138b1e1b5eb7a97ced46689e2d28db1050875',
  },
}, function (error, response, body) {
  if(error) {
    console.log(error)
    return;
  }

  fs.writeFile('out.json', body, function (e, data) {
    if (e) console.log(e);
    else console.log("finished");
  });


  console.log(body);

});

