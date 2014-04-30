angular.module('app.controllers.recentlyViewed')
    .controller('RecentlyViewedController', function ($sce, HashKeyCopier, Products, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, Cart, breadcrumbs, RecentlyViewed) {
        
        var loadRecentlyViewed = function() {
            $scope.products = RecentlyViewed.getItems(); alert($scope.products); $log.debug('loading viewed products', $scope.products)
        }
        loadRecentlyViewed();
    });
