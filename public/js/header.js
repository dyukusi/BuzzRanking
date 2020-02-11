const $ = jQuery = require('jquery');
const _ = require('underscore');
const Autocomplete = require('autocompleter');
const MyUtil = require('./util.js');
const Cookie = require('js-cookie');
const sprintf = require('sprintf-js').sprintf;
require('bootstrap');

disableStickyHeaderTemporarily = false;
var remainingCountOfDisableScrollEvent = 0;

$(function () {
  if (location.pathname.match('book')) {
    $('#nav-book-ranking').addClass("active");
  } else if (location.pathname.match('dating')) {
    $('#nav-dating-ranking').addClass("active");
    // $('#nav-dating-ranking a i').remove();
    // $('#nav-dating-ranking a').html('<i class="fas fa-heart">' + $('#nav-dating-ranking a').html());
  }

  initAllSearchAutoComplete();
  initTwitterAccountSearchAutoCompleteIfNeed();
  adjustBodyMarginForFooter();
  initFooterMargin();
  initScrollHideNavbar();
  initTopBtn();
  initAboutBtn();
});

function initAllSearchAutoComplete() {
  var input = document.getElementById("input-all-search");
  var allSearchJustBefore = Cookie.get('all-search-just-before');

  if (allSearchJustBefore) {
    input.value = allSearchJustBefore;
  }

  var autocomplete = Autocomplete({
    input: input,
    minLength: 2,
    preventSubmit: true,
    debounceWaitMs: 300,
    showOnFocus: true,

    fetch: async (text, update) => {
      var searchResults = await $.ajax({
        url: MyUtil.getLocationOrigin() + '/api/all_search',
        type: 'GET',
        dataType: 'json',
        data: {
          searchString: text,
        },
      });

      update(searchResults.result);
    },

    onSelect: (item) => {
      input.value = item.label;
      var EXPIRE_SEC = 1000 * 10; // 10 sec
      var inFifteenMinutes = new Date(new Date().getTime() + EXPIRE_SEC);
      Cookie.set('all-search-just-before', item.label, {
        expires: inFifteenMinutes
      });

      var queryString = '';
      if (item.group != 'シリーズ') {
        queryString = '?focus_product_id=' + item.productId;
      }

      var url = '/product/' + item.productBundleId + queryString;

      window.location.href = url;
    },

    customize: (input, inputRect, container, maxHeight) => {
      container.style.maxHeight = (+window.innerHeight / 3) + 'px';
    },

    render: function (item, currentValue) {
      if (item.group == 'シリーズ') {
        return $(sprintf(
          '<div>%s <span class="all-search-product-bundle-id">(%s)</span></div>',
          item.label, item.productBundleId
        ))[0];
      } else {
        return $(sprintf(
          '<div>%s</div>',
          item.label
        ))[0];
      }
    }
  });
}

function initTwitterAccountSearchAutoCompleteIfNeed() {
  var input = document.getElementById("input-search-twitter-account");
  if (!input) return;

  var autocomplete = Autocomplete({
    input: input,
    minLength: 2,
    preventSubmit: true,
    debounceWaitMs: 100,
    showOnFocus: true,

    fetch: async (text, update) => {
      var searchResults = await $.ajax({
        url: MyUtil.getLocationOrigin() + '/api/search_twitter_account',
        type: 'GET',
        dataType: 'json',
        data: {
          searchString: text,
        },
      });

      update(searchResults.result);
    },

    onSelect: (item) => {
      input.value = item.label;

      var baseURL = $(input).data('base-url');
      window.location.href = baseURL + item.label;
    },

    customize: (input, inputRect, container, maxHeight) => {
      container.style.maxHeight = (+window.innerHeight / 3) + 'px';
    },
  });
}


function initFooterMargin() {
  $(window).resize(function () {
    adjustBodyMarginForFooter();
  });
}

function adjustBodyMarginForFooter() {
  $('body').css('margin-bottom', $('#footer').height() + 'px');
}

function initAboutBtn() {
  // var buzzrankingLogoHeight = $('.navbar-brand').outerHeight();
  // $('about-icon-bottom').css('top', buzzrankingLogoHeight + 'px');


  // var scrollTarget = $('body,html');
  // $('#nav-about').click(function() {
  //   scrollTarget.animate({
  //     scrollTop: $('#footer')[0].offsetTop,
  //   }, 300);
  //   return false;
  // });
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
        $('.my-sticky').css('top', '1rem');
      }
      // up
      else {
        $('#header').removeClass('hide');

        var adjustedHeight = buzzrankingLogoHeight;
        navEle.css('top', -1 * adjustedHeight + 'px');

        var headerHeight = $('#header').height() - $('.navbar-brand').height() + 20;
        $('.my-sticky').css('top', headerHeight);

        var buzzrankingLogoHeight = $('.navbar-brand').outerHeight();
        $('.about-icon-bottom').css('top', buzzrankingLogoHeight);
      }
    } else {
      navEle.removeClass('fixed-top');
      aboutIcon.removeClass('about-icon-bottom');
      $('body').css('padding-top', '0px');
      navEle.css('top', '0px');

      $('.about-icon').css('top', '0px');
    }

    startPos = winScrollTop;
  };

  $(window).on('scroll', function () {
    scrollEventFunction();
  });
  $('body').on('touchmove', function () {
    scrollEventFunction();
  });

};

function initTopBtn() {
  var TopBtn = $('#PageTopBtn');
  var BottomPos = -10;
  TopBtn.hide();
  $(window).scroll(function (e) {
    $window = $(e.currentTarget);
    WindowHeight = $window.height();
    PageHeight = $(document).height();
    footerHeight = $(".footer").height();
    ScrollTop = $window.scrollTop();
    MoveTopBtn = WindowHeight + ScrollTop + footerHeight - PageHeight;

    if ($(this).scrollTop() > 100) {
      TopBtn.fadeIn();
    } else {
      TopBtn.fadeOut();
    }

    if (ScrollTop >= PageHeight - WindowHeight - footerHeight + BottomPos) {
      // TopBtn.css({ bottom: MoveTopBtn });
    } else {
      // TopBtn.css({ bottom: BottomPos });
    }
  });

  TopBtn.click(function () {
    var scrollTimeMsec = 200;

    $('body,html').animate({
      scrollTop: 0
    }, scrollTimeMsec);

    setTimeout(function () {
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
