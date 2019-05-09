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

      book_ranking : {
        src : ['public/js/book_ranking/book_ranking.js', 'public/js/header.js'],
        dest : 'public/js/compressed/book_ranking.min.js',
      },

      dating_ranking : {
        src : ['public/js/dating_ranking/dating_ranking.js', 'public/js/header.js'],
        dest : 'public/js/compressed/dating_ranking.min.js',
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
        tasks : ['browserify:header', 'browserify:index', 'browserify:book_ranking', 'browserify:dating_ranking'],
      },

      index : {
        files : ['public/js/index.js'],
        tasks : ['browserify:index'],
      },

      book_ranking : {
        files : ['public/js/book_ranking/book_ranking.js'],
        tasks : ['browserify:book_ranking'],
      },

      dating_ranking : {
        files : ['public/js/dating_ranking/dating_ranking.js'],
        tasks : ['browserify:dating_ranking'],
      },

      css: {
        files: 'public/sass/common.sass',
        tasks: ['sass'],
      }
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
