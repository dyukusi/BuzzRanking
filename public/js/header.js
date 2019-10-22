const $ = jQuery = require('jquery');
const _ = require('underscore');
require('bootstrap');

disableStickyHeaderTemporarily = false;
var remainingCountOfDisableScrollEvent = 0;

$(function() {
  if (location.pathname.match('book')) {
    $('#nav-book-ranking').addClass("active");
  } else if (location.pathname.match('dating')) {
    $('#nav-dating-ranking').addClass("active");
    // $('#nav-dating-ranking a i').remove();
    // $('#nav-dating-ranking a').html('<i class="fas fa-heart">' + $('#nav-dating-ranking a').html());
  }

  initScrollHideNavbar();
  initTopBtn();
  initAboutBtn();
});

function initAboutBtn() {
  var scrollTarget = $('body,html');

  $('#nav-about').click(function() {
    scrollTarget.animate({
      scrollTop: $('#footer')[0].offsetTop,
    }, 300);
    return false;
  });
}

function initScrollHideNavbar() {
  var startPos = 0, winScrollTop = 0;
  var scrollEventFunction = function () {
    if (disableStickyHeaderTemporarily) {
      remainingCountOfDisableScrollEvent = 3;
      disableStickyHeaderTemporarily = false;

      winScrollTop = $(this).scrollTop();
      startPos = winScrollTop;
    }

    if (remainingCountOfDisableScrollEvent) {
      remainingCountOfDisableScrollEvent--;
      return;
    }

    var navEle = $('nav');
    var aboutIcon = $('#nav-about a');
    var navHeight = navEle.outerHeight(true);
    var buzzrankingLogoHeight = $('.navbar-brand').outerHeight();
    var commonNavRowHeight = $('.common-nav').outerHeight();
    winScrollTop = $(this).scrollTop();

    if (winScrollTop > navHeight) {
      aboutIcon.addClass('about-icon-bottom');

      navEle.addClass('fixed-top');
      $('body').css('padding-top', navHeight + 'px');

      // down
      if (winScrollTop >= startPos) {
        $('#header').addClass('hide');
      }
      // up
      else {
        $('#header').removeClass('hide');

        var adjustedHeight = isNavBarCollapsed() ? buzzrankingLogoHeight : buzzrankingLogoHeight + commonNavRowHeight;
        navEle.css('top', -1 * adjustedHeight + 'px');
      }
    } else {
      navEle.removeClass('fixed-top');
      aboutIcon.removeClass('about-icon-bottom');
      $('body').css('padding-top', '0px');
      navEle.css('top', '0px');
    }

    startPos = winScrollTop;
  };

  $(window).on('scroll', function() {
    scrollEventFunction();
  });
  $('body').on('touchmove', function() {
    scrollEventFunction();
  });

};

function initTopBtn() {
  var TopBtn = $('#PageTopBtn');
  var BottomPos = -10;
  TopBtn.hide();
  $(window).scroll(function(e) {
    $window = $(e.currentTarget);
    WindowHeight = $window.height();
    PageHeight = $(document).height();
    footerHeight = $(".footer").height();
    ScrollTop = $window.scrollTop();
    MoveTopBtn = WindowHeight + ScrollTop + footerHeight - PageHeight;

    if ($(this).scrollTop() > 100) {
      TopBtn.fadeIn();
    }
    else {
      TopBtn.fadeOut();
    }

    if(ScrollTop >= PageHeight - WindowHeight - footerHeight + BottomPos) {
      // TopBtn.css({ bottom: MoveTopBtn });
    }
    else {
      // TopBtn.css({ bottom: BottomPos });
    }
  });

  TopBtn.click(function() {
    var scrollTimeMsec = 200;

    $('body,html').animate({
      scrollTop: 0
    }, scrollTimeMsec);

    setTimeout(function() {
      var navEle = $('nav');
      var buzzrankingLogoHeight = $('.navbar-brand').outerHeight();

      $('#header').removeClass('hide');
      navEle.css('top', -1 * buzzrankingLogoHeight + 'px');
    }, scrollTimeMsec + 1);

    return false;
  });
}

function isNavBarCollapsed() {
  return window.innerWidth < 992;
}

