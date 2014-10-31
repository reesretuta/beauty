angular.module('app.controllers.recentlyViewed')
    .controller('RecentlyViewedController', function ($sce, HashKeyCopier, Product, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, Cart, RecentlyViewed) {
        
        var loadRecentlyViewed = function() {
            $scope.recentlyViewedProducts = RecentlyViewed.getItems();
            $log.debug('loading viewed products', $scope.recentlyViewedProducts)
        }
        loadRecentlyViewed();
    });
