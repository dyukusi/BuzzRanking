const grunt = require('grunt');
const __ = require('underscore');

module.exports = function (grunt) {
  grunt.initConfig({
    browserify: {
      exec: {
        src: ['__temp__'],
        dest: ['__temp__'],
      },
    },

    'closure-compiler': {
      my_target: {
        files: {
          '__output_path_temp__': ['__target_file_temp__']
        },
        options: {
          compilation_level: 'SIMPLE',
          // create_source_map: 'dest/output.min.js.map',
          // output_wrapper: '(function(){\n%output%\n}).call(this)\n//# sourceMappingURL=output.min.js.map'
        }
      }
    },

    sass: {
      dist: {
        files: {
          'public/css/common.css': 'public/sass/common.sass'
        }
      }
    },

    ejslint: {
      src: ['__temp__'],
    },

    esteWatch: {
      options: {
        dirs: ['views/**', 'public/js'],
        livereload: false,
      },

      'ejs': function (filepath) {
        grunt.config(['ejslint', 'src'], filepath);
        return ['ejslint'];
      },

      'js': function (filepath) {
        var isBrowserifyTargetJSregex = new RegExp(/public\/js\/([a-z_]+)\.js$/);
        var result = isBrowserifyTargetJSregex.exec(filepath);
        var isHeader = !!filepath.match(/public\/js\/header.js/);
        var fileName = result ? result[1] : null;
        var outputFilePath = 'public/js/compressed/' + fileName + '.min.js';

        if (!fileName) return null;

        var dependencyHash = {
          'public/js/index.js': ['public/js/header.js'],
          'public/js/product_detail.js': ['public/js/header.js'],
          'public/js/ranking.js': ['public/js/header.js'],
          'public/js/twitter_account.js': ['public/js/header.js'],
          'public/js/product_list_for_admin.js': ['public/js/header.js'],
        };

        var execList = [];
        for (var i = 0; i < __.keys(dependencyHash).length; i++) {
          var modifiedFilePath = __.keys(dependencyHash)[i];
          var dependingFilePaths = dependencyHash[modifiedFilePath];
          var bundleFiles = __.flatten([modifiedFilePath, dependingFilePaths]);

          var modifiedJSName = isBrowserifyTargetJSregex.exec(modifiedFilePath)[1];
          var outputPath = 'public/js/compressed/' + modifiedJSName + '.min.js';

          if (__.contains(bundleFiles, filepath)) {
            execList.push(modifiedFilePath);
            grunt.config(['browserify', modifiedFilePath, 'src'], bundleFiles);
            grunt.config(['browserify', modifiedFilePath, 'dest'], outputPath);
          }
        }

        if (__.isEmpty(execList)) {
          grunt.config(['browserify', 'exec', 'src'], filepath);
          grunt.config(['browserify', 'exec', 'dest'], outputFilePath);
          execList.push('exec');
        }

        console.log("exec list: " + execList.toString());

        return __.map(execList, execName => {
          return 'browserify:' + execName;
        });
      },
    },
  })
  ;

// plugins
  require('google-closure-compiler').grunt(grunt, {
    platform: ['javascript']
  });
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-este-watch');

  grunt.task.loadTasks('grunt_task_module');
  grunt.registerTask('default', ['br', 'sass']);
  grunt.registerTask('br', ['browserify']);
}
;
