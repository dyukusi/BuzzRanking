const ejsLint = require('ejs-lint');
const fs = require('fs');

module.exports = function(grunt) {
  grunt.registerTask('ejslint', 'execute ejslint', function() {
    var ejsFilePath = grunt.config('ejslint').src;
    var ejs = fs.readFileSync(ejsFilePath, 'utf-8');
    var result = ejsLint(ejs, {});
    console.log('--- ' + ejsFilePath);
    console.log(result);
  });
};
