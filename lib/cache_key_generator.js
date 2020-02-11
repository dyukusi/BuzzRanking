function generateHtmlCacheForRanking(dateStr, rankingTypeName, productTypeBundleId, productTypeId, page) {
  return 'html_' + dateStr + '_' + rankingTypeName + '_' + productTypeBundleId + '_' + productTypeId + '_' + page;
}

function getProductDataListForDebugCacheKey() {
  return 'product_data_list_for_debug';
}

function generateRankedProductsCacheKeyByStatId(statId) {
  return 'product_bundle_id_into_related_data_hash_' + statId;
}

function generateSimpleBuzzChartImageCacheKeyByProductBundleId(productBundleId) {
  return 'simple_buzz_chart_' + productBundleId;
}

function generateTop3RankProductDataListCacheKey(statId, productTypeId) {
  return 'top_3_product_data_list_per_product_type_id_' + statId + "_" + productTypeId;
}

function generateTweetDataListForProductDetailPageCacheKey(productId) {
  return 'tweet_data_list_for_product_detail_page_' + productId;
}

function generateProductDetailHTMLCacheKey(productId) {
  return 'product_detail_html_' + productId;
}

function generateProductBundleDetailHTMLCacheKey(productBundleId) {
  return 'product_detail_html_' + productBundleId;
}

function generateChartDataCacheKey(productBundleId) {
  return 'chart_data_' + productBundleId;
}

function generateProductDataCacheKey(productBundleId) {
  return 'product_data_' + productBundleId;
}

function generateSortedTweetModelsCacheKey(productBundleId) {
  return 'sorted_tweet_models_' + productBundleId;
}

function generateSimpleRankingDataListCacheKey(targetDateStr) {
  return 'simple_ranking_data_list_' + targetDateStr;
}

module.exports = {
  generateSimpleBuzzChartImageCacheKeyByProductBundleId: generateSimpleBuzzChartImageCacheKeyByProductBundleId,
  generateRankedProductsCacheKeyByStatId: generateRankedProductsCacheKeyByStatId,
  generateTop3RankProductDataListCacheKey: generateTop3RankProductDataListCacheKey,
  generateTweetDataListForProductDetailPageCacheKey: generateTweetDataListForProductDetailPageCacheKey,
  generateProductDetailHTMLCacheKey: generateProductDetailHTMLCacheKey,
  generateProductBundleDetailHTMLCacheKey: generateProductBundleDetailHTMLCacheKey,
  generateSimpleRankingDataListCacheKey: generateSimpleRankingDataListCacheKey,

  getProductDataListForDebugCacheKey: getProductDataListForDebugCacheKey,
  generateChartDataCacheKey: generateChartDataCacheKey,
  generateHtmlCacheForRanking: generateHtmlCacheForRanking,
  generateProductDataCacheKey: generateProductDataCacheKey,
  generateSortedTweetModelsCacheKey: generateSortedTweetModelsCacheKey,
}
