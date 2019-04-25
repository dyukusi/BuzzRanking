module.exports = function(grunt) {
  grunt.initConfig({
    browserify : {
      index : {
        src : 'public/js/index.js',
        dest : 'public/js/compressed/index.min.js',
      },

      book_ranking : {
        src : 'public/js/book_ranking/index.js',
        dest : 'public/js/book_ranking/compressed/index.min.js',
      },
    },

    sass: {
      dist: {
        files: {
          'public/css/temp.css' : 'public/sass/temp.sass'
        }
      }
    },

    watch: {
      index : {
        files : ['public/js/index.js'],
        tasks : ['browserify:index'],
      },

      book_ranking : {
        files : ['public/js/book_ranking/index.js'],
        tasks : ['browserify:book_ranking'],
      },

      css: {
        files: 'public/sass/*.sass',
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
