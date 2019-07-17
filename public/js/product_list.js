$ = jQuery = require('jquery');

$(function () {
  initSearchButton();
});

function initSearchButton() {
  $('#search-button').click(function(e) {
    var productTypeId = Number($('#product-type-select-input').val());
    var searchWord = $('#search-word-input').val();
    var targetURL = generateProductListURLByOptions({
      productTypeId: productTypeId,
      searchWord: searchWord,
    });

    window.location.href = targetURL;
  });
}

function generateProductListURLByOptions(options = {}) {
  var base = "/product/list?page=1";

  if (options.productTypeId) {
    base += "&product_type_id=" + options.productTypeId;
  }

  if (options.searchWord) {
    base += "&search_word=" + options.searchWord;
  }

  return base;

}
