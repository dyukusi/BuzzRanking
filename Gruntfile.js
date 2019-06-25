module.exports = function(grunt) {
  grunt.initConfig({
    browserify : {
      header: {
        src : 'public/js/header.js',
        dest : 'public/js/compressed/header.min.js',
      },

      index : {
        src : ['public/js/index.js', 'public/js/header.js'],
        dest : 'public/js/compressed/index.min.js',
      },

      product_detail : {
        src : ['public/js/product_detail.js', 'public/js/header.js'],
        dest : 'public/js/compressed/product_detail.min.js',
      },

      ranking : {
        src : ['public/js/ranking.js', 'public/js/header.js'],
        dest : 'public/js/compressed/ranking.min.js',
      },

    },

    sass: {
      dist: {
        files: {
          'public/css/common.css' : 'public/sass/common.sass'
        }
      }
    },

    watch: {
      header : {
        files : ['public/js/header.js'],
        tasks : ['browserify:header', 'browserify:index', 'browserify:ranking', 'browserify:product_detail'],
      },

      index : {
        files : ['public/js/index.js'],
        tasks : ['browserify:index'],
      },

      product_detail : {
        files : ['public/js/product_detail.js'],
        tasks : ['browserify:product_detail'],
      },

      ranking : {
        files : ['public/js/ranking.js'],
        tasks : ['browserify:ranking'],
      },

      // css: {
      //   files: 'public/sass/common.sass',
      //   tasks: ['sass'],
      // }
    },

  });

  // plugins
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-browserify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-watch');
  grunt.loadNpmTasks('grunt-contrib-uglify');

  // tasks
  grunt.registerTask('default', ['cssmin', 'br', 'sass']);
  grunt.registerTask('br', ['browserify']);
};
