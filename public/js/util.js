exports.getLocationOrigin = function() {
  return location.origin ? location.origin
    : location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
};
