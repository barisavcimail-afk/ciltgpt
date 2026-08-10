(function () {
  window.CiltGPTProductRecommendations = window.CiltGPTProducts.filter(
    (product) => product.recommendedInReports,
  );
})();
