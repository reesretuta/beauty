angular.module('app.controllers.main')
    .controller('MainController', function ($scope, $document, $timeout, $location, $rootScope, $routeParams, $log, $translate, Session, Categories, Cart, Search, BreadcrumbsHelper, RecentlyViewed) {

        // this page will watch for URL changes for back/forward that require it to change anything needed (like search)
        var cancelChangeListener;
        function createListener() { 
            $log.debug("MainController(): createListener(): creating change listener");
            cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
                var url = $location.url(),
                    path = $location.path(),
                    params = $location.search();

                // if we have a composition and run, and the current scope doesn't already have the same run
                if (path == "/products" && (urlSearch != localSearch)) {
                    $log.debug("MainController(): changeListener(): location change event in projects page", url, params);

                    var urlSearch = S(params.search != null ? params.search : "").toString();
                    var localSearch = Search.getQuery();

                    $log.debug("MainController(): changeListener(): url search", urlSearch, "local search", localSearch);

                    $log.debug("MainController(): changeListener(): updating search params in response to location change");

                    Search.search(urlSearch);
                } else {
                    $log.debug("MainController(): changeListener(): ignoring");
                }
            });
        }
        createListener();

        $scope.session = Session.getSession();
        $log.debug("MainController(): loaded session", $scope.session);

        $scope.$watch('session.language', function(newVal, oldVal) {
            $translate.use($scope.session.language);
        });

        $scope.getItemsInCart = function() {
            var count = Cart.getItemCount();
            //$log.debug("MainController(): items count", count);
            return count;
        }
        
        $scope.removeFromCart = function(product) {
            $log.debug("MainController(): removing product", product);
            Cart.removeFromCart(product);
        }
        
        $scope.quantities = {};

        $scope.addToCart = function(product) {
            $log.debug("MainController(): adding product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            
            $log.debug("MainController(): adding product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.addToCart(p);
        }

        $scope.updateCart = function(product) {
            $log.debug("MainController(): updating product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            $log.debug("MainController(): updating product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.updateCart(p);
        }

        $scope.searchProducts = function() {
            if (Search.getQuery() != null) {

            }
            $log.debug("MainController(): going to products for search", Search.getQuery());
            $location.url("/products?search="+(Search.getQuery() != null ? Search.getQuery() : ''), 'false');
        }

        $rootScope.getImagePath = function(paths) {
            if (Array.isArray(paths)) {
                //$log.debug("MainController(): getImagePath(): getting image path from array");
                return '/' + paths[0];
            }
            //$log.debug("MainController(): getImagePath(): getting image path from string");
            return '/' + paths;
        }

        // begin navigation
        $scope.selectedIndex = {};
        $rootScope.navStatic = '1';
        $scope.itemClicked = function(level, index) {
            $scope.selectedIndex[level] = index;
            $log.debug("item clicked, setting navStatic=0");
            $rootScope.navStatic = 0;
        }

        $scope.setNavStatic = function(val) {
            $log.debug("setting navStatic=1");
            BreadcrumbsHelper.setPath(null, null);
            $rootScope.navStatic = val;
        }

        $scope.categoryInPath = function(category) {
            // loop through current breadcrumbs
            for (var i=0; i < $rootScope.breadcrumbs.length; i++) {
                var breadcrumb = $rootScope.breadcrumbs[i];
                //$log.debug("CategoriesController(): checking if category is in path", category, breadcrumb);
                if (breadcrumb.type == 'category' && breadcrumb.id == category.id) {
                    $log.debug("clearing static nav");
                    $rootScope.navStatic = 0;
                    return true;
                }
            }

            return false;
        }
        // end navigation

        $scope.logout = function() {
            Session.logout();
            $location.path("/");
        }

        $scope.loggedIn = function() {
            return Session.isLoggedIn();
        }

        $scope.getUserEmail = function() {
            var user = Session.getUser();
            if (user != null) {
                var email = user.email;
                $log.debug("MainController(): username", email);
                if (email != null) {
                    return email;
                }
            }
            return "";
        }

        function cleanup() {
            if (cancelChangeListener) {
                $log.debug("MainController(): cleanup(): canceling change listener");
                cancelChangeListener();
            }
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });