const appRoot = require('app-root-path');
const {GoogleApis} = require('googleapis');
const google = new GoogleApis();
const _ = require('underscore');
const Config = require('config');
const Moment = require('moment');

async function getProductBundleIdIntoPvInWeekHash() {
  var pvDataList = await fetchPvDataListInWeek();

  var productBundleIdIntoPvHash = (() => {
    var hash = {};
    var regex = new RegExp(/\/product\/(\d+)($|\?|\/$)/g);

    _.each(pvDataList, pvData => {
      var result = regex.exec(pvData.url);
      if (!result) return;

      var productBundleId = result[1];
      hash[productBundleId] = pvData.pv;
    });

    return hash;
  })();

  return productBundleIdIntoPvHash;
}

async function fetchPvDataListInWeek() {
  var response = await callAPI();
  var rows = response.data.reports[0].data.rows;

  var pvDataList = _.chain(rows)
    .map(row => {
      return {
        url: row.dimensions[0],
        pv: +row.metrics[0].values[0],
      };
    })
    .value();

  return pvDataList
}

function callAPI() {
  return new Promise((resolve, reject) => {
    var analytics = google.analyticsreporting('v4');
    var credential = require(Config.google_analytics_api.credential_json_path);
    var viewId = Config.google_analytics_api.view_id;
    var endDateMoment = new Moment(); // today
    var startDateMoment = endDateMoment.clone().subtract(7, 'day');

    var jwtClient = new google.auth.JWT(credential.client_email, null, credential.private_key, ["https://www.googleapis.com/auth/analytics.readonly"], null);

    jwtClient.authorize((error, tokens) => {
      if (error) {
        console.log(error);
        return;
      }
      analytics.reports.batchGet({
        resource: {
          "reportRequests": [
            {
              "dateRanges": [
                {
                  "startDate": startDateMoment.format('YYYY-MM-DD'),
                  "endDate": endDateMoment.format('YYYY-MM-DD'),
                }
              ],
              "viewId": viewId,
              "dimensions": [
                {
                  "name": "ga:pagePath"
                }
              ],
              "metrics": [
                {
                  "expression": "ga:pageviews"
                }
              ],
            }
          ]
        },
        auth: jwtClient
      }, (error, response) => {
        if (error) {
          return reject(error);
        }

        return resolve(response);
      });
    });
  });

}

module.exports = {
  fetchPvDataListInWeek,
  getProductBundleIdIntoPvInWeekHash
}
