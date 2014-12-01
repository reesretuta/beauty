
angular.module('app.controllers.main')
    .controller('MainController', function ($scope, $document, $timeout, $location, $rootScope, $routeParams, $log, $translate, $q, STORE_BASE_URL, Session, Categories, Product, Cart, Search, BreadcrumbsHelper, RecentlyViewed, CDN_URL, $route) {

        $rootScope.adding = false;

        $scope.username = "";
        $scope.password = "";

        angular.element('.login-dropdown .dropdown-menu input, .login-dropdown .dropdown-menu button').on('click', function(e) {
            e.stopPropagation()
        });

        $scope.login = function() {
            Session.login($scope.username, $scope.password).then(function(session) {
                $log.debug("MainController(): logged in", session);
            }, function(error) {
                $log.debug("MainController(): failed to login", error);
            });
        }

        $scope.logout = function() {
            $log.debug("MainController(): logging out");
            Session.logout();
        }

        // this page will watch for URL changes for back/forward that require it to change anything needed (like search)
        var cancelChangeListener;
        function createListener() { 
            $log.debug("MainController(): createListener(): creating change listener");
            cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
                var url = $location.url(),
                    path = $location.path(),
                    params = $location.search();

                // if we have a store page
                if (path == STORE_BASE_URL + "/products" && (urlSearch != localSearch)) {
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

        Session.get().then(function(session) {
            $log.debug("MainController(): loaded session", session);
            // session should now be in the root scope
        }, function(error) {
            $log.debug("MainController(): error loading session", error);
        });

        $scope.$watch('session.language', function(newVal, oldVal) {
            $translate.use(Session.get().language);
        });

        $scope.removeFromCart = function(product) {
            $log.debug("MainController(): removing product", product);
            Cart.removeFromCart(product).then(function() {
                $log.debug("MainController(): removed", product);
            }, function (error) {
                $log.error("MainController(): error removing", product);
            });
        }
        
        $scope.quantities = {};

        $rootScope.getTranslated = function(product) {
            return Product.getTranslated(product);
        }

        $scope.addToCart = function(product) {
            $log.debug("MainController(): adding product", product);
            var qty = $scope.quantities[product.sku];
            if (qty === null) {
                qty = 1;
            }
            $log.debug("MainController(): addToCart()", product, qty);
            Cart.addToCart({
                name: product.name,
                name_es_US: product.name_es_US,
                sku: product.sku,
                kitSelections: product.kitSelections,
                quantity: qty
            }).then(function() {
                $log.debug("MainController(): addToCart()", product);
            }, function (error) {
                $log.error("MainController(): addToCart(): error", product);
            });
        }

        $scope.searchProducts = function(query) {
            $log.debug("MainController(): going to products for search", query, $routeParams.search);
            if ($routeParams.search === query) {
                $route.reload();
            }
            $location.url(STORE_BASE_URL + "/products?search="+(query != null ? query : ''), 'false');
            $rootScope.search.queryString = null;
        };

        $rootScope.getImagePath = function(image) {
            if (image == null || image.localPath == null) {
                return "/img/product_placeholder.gif";
            }
            //console.log("CDN", CDN_URL, "image path", image.localPath);
            return CDN_URL + "/assets" + image.localPath;
        }

        $rootScope.getBreadCrumbs = function() {
            return BreadcrumbsHelper.getBreadCrumbs();
        }

        // begin navigation
        $rootScope.navStatic = '0';
        
        $scope.categoryClicked = function(category) {
            $log.debug("MainController(): category clicked", category);
            // set breadcrumbs
            BreadcrumbsHelper.setPath(category, null);
            $rootScope.navStatic = 0;
        }

        $scope.setNavStatic = function(val) {
            $log.debug("MainController(): setting navStatic=1");
            BreadcrumbsHelper.setPath(null, null);
            $rootScope.navStatic = val;
        }

        $scope.categoryInPath = function(category) {
            //$log.debug("CategoriesController(): categoryInPath(): checking if category", category, "is in breadcrumb path", $rootScope.breadcrumbs);
            // loop through current breadcrumbs
            for (var i=0; i < $rootScope.breadcrumbs.length; i++) {
                var breadcrumb = $rootScope.breadcrumbs[i];
                //$log.debug("CategoriesController(): checking if category is in path", category, breadcrumb);
                if (breadcrumb.type == 'category' && breadcrumb.id == category.id) {
                    //$log.debug("MainController(): clearing static nav");
                    $rootScope.navStatic = 0;
                    return true;
                }
            }
            return false;
        }
        // end navigation

        $scope.logout = function() {
            Session.logout();
            $location.path(STORE_BASE_URL);
        };

        $scope.loggedIn = function() {
            return Session.isLoggedIn();
        };

        $scope.getUserEmail = function() {
            var user = Session.getUser();
            if (user != null) {
                var email = user.email;
                //$log.debug("MainController(): getUserEmail()", email);
                if (email != null) {
                    return email;
                }
            }
            return "";
        };

        $scope.countCartItems = function (cart) {
            var count = 0;
            angular.forEach(cart, function(product) {
                count += product.quantity;
            });
            return count;
        };

        function cleanup() {
            if (cancelChangeListener) {
                $log.debug("MainController(): cleanup(): canceling change listener");
                cancelChangeListener();
            }
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function () {
            cleanup();
        });

        // carousel
        $log.debug('MainController(): .carousel()');

        $('#carousel-product-generic').carousel();

        $scope.carouselPrev = function () {
            $log.debug('MainController(): .carousel("prev")');
            $scope.$evalAsync(function() {
                $('#carousel-product-generic').carousel('prev');
            });
        };

        $scope.carouselNext = function () {
            $log.debug('MainController(): .carousel("next")');
            $scope.$evalAsync(function() {
                $('#carousel-product-generic').carousel('next');
            });
        };

    });