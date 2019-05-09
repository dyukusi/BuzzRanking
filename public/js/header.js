const $ = jQuery = require('jquery');
const _ = require('underscore');
require('bootstrap');

$(() => {
  if (location.pathname.match('book')) {
    $('#nav-book-ranking').addClass("active");
    // $('#nav-book-ranking a i').remove();
    // $('#nav-book-ranking a').html('<i class="fas fa-book-reader">' + $('#nav-book-ranking a').html());

  } else if (location.pathname.match('dating')) {
    $('#nav-dating-ranking').addClass("active");
    // $('#nav-dating-ranking a i').remove();
    // $('#nav-dating-ranking a').html('<i class="fas fa-heart">' + $('#nav-dating-ranking a').html());
  }

  initScrollHideNavbar();
});

function initScrollHideNavbar() {
  var startPos = 0, winScrollTop = 0;
  $(window).on('scroll', function () {
    var navEle = $('nav');
    var navHeight = navEle.outerHeight(true);
    var buzzrankingLogoHeight = $('.navbar-brand').outerHeight();
    winScrollTop = $(this).scrollTop();

    if (winScrollTop > navHeight) {
      navEle.addClass('fixed-top');
      $('body').css('padding-top', navHeight + 'px');

      // down
      if (winScrollTop >= startPos) {
        $('#header').addClass('hide');
      }
      // up
      else {
        $('#header').removeClass('hide');
        navEle.css('top', -1 * buzzrankingLogoHeight + 'px');
      }
    } else {
      navEle.removeClass('fixed-top');
      $('body').css('padding-top', '0px');
      navEle.css('top', '0px');
    }

    startPos = winScrollTop;
  });
}
