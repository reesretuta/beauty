angular.module('app.controllers.main')
    .controller('MainController', function ($scope, $document, $timeout, $location, $rootScope, $routeParams, $log, Categories, Cart, Search, breadcrumbs) {

        $scope.breadcrumbs = breadcrumbs;

        // this page will watch for URL changes for back/forward that require it to change anything needed (like search)
        var cancelChangeListener;
        function createListener() { 
            $log.debug("createListener(): creating change listener");
            cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
                var url = $location.url(),
                    path = $location.path(),
                    params = $location.search();

                $log.debug("changeListener(): location change event in projects page", url, params);

                var urlSearch = S(params.search != null ? params.search : "").toString();
                var localSearch = Search.getQuery();

                $log.debug("changeListener(): url search", urlSearch, "local search", localSearch);

                // if we have a composition and run, and the current scope doesn't already have the same run
                if (path == "/products" && (urlSearch != localSearch)) {
                    $log.debug("changeListener(): updating search params in response to location change");

                    Search.search(urlSearch);
                } else {
                    $log.debug("changeListener(): ignoring");
                }
            });
        }
        createListener();

        $scope.getItemsInCart = function() {
            var count = Cart.getItemCount();
            $log.debug("items count", count);
            return count;
        }
        
        $scope.removeFromCart = function(product) {
            $log.debug("removing product", product);
            Cart.removeFromCart(product);
        }
        
        $scope.quantities = {};

        $scope.addToCart = function(product) {
            $log.debug("adding product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            
            $log.debug("adding product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.addToCart(p);
        }

        $scope.updateCart = function(product) {
            $log.debug("updating product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            $log.debug("updating product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.updateCart(p);
        }

        $scope.searchProducts = function() {
            $log.debug("going to products for search", Search.getQuery());
            $location.path("/products").search("search", Search.getQuery());
        }

        $rootScope.getImagePath = function(paths) {
            if (Array.isArray(paths)) {
                //$log.debug("getImagePath(): getting image path from array");
                return '/' + paths[0];
            }
            //$log.debug("getImagePath(): getting image path from string");
            return '/' + paths;
        }


        $scope.buildPath = function(category, product, path) {
            if (path == null && product != null) {
                $log.debug("setting path to product name");
                path = product;
            }
            var newPath = '';
            if (category != null) {
                newPath = category.name;
                $log.debug("prepending category name", newPath);
                if (path != null) {
                    newPath += " / " + path;
                    $log.debug("new path", newPath);
                }
                return $scope.buildPath(category.parentcategory, product, newPath);
            } else {
                $log.debug("returning current path", path);
                newPath = path;
            }
            return newPath;
        }

    });