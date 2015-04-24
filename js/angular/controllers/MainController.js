
angular.module('app.controllers.main').controller('MainController', function ($scope, $document, $timeout, $location, $rootScope, $routeParams, $log, $translate, $q, STORE_BASE_URL, Session, Categories, Consultant, Product, Cart, Search, BreadcrumbsHelper, RecentlyViewed, CDN_URL, $route, WizardHandler, Leads) {

    $rootScope.adding = false;

    $scope.username = '';
    $scope.password = '';

    angular.element('.login-dropdown .dropdown-menu input, .login-dropdown .dropdown-menu button').on('click', function(evt) {
        evt.stopPropagation();
    });

    // determine if we are on either usa.jafra.com or joinjafra.com, we use this to hide elements from live production
    $rootScope.isProduction = /jafra\.com/.test($location.host()) ? true : false;
    $rootScope.isStaging = /jafra\-stage/.test($location.host()) ? true : false;
    $log.debug('MainController(): $rootScope.isProduction?:', $rootScope.isProduction);
    $log.debug('MainController(): $rootScope.isStaging?:', $rootScope.isStaging);

    $scope.login = function() {
        Session.login($scope.username, $scope.password).then(function(session) {
            $log.debug("MainController(): logged in", session);
            // check for start page, if so -> move to 
            if ($location.path() === '/shop/checkout') {
                WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
            }
        }, function(error) {
            $log.debug("MainController(): failed to login", error);
        });
    };

    $scope.logout = function() {
        $log.debug("MainController(): logging out");
        Session.logout();
    };

    // this page will watch for URL changes for back/forward that require it to change anything needed (like search)
    var cancelChangeListener;
    function createListener() {
        $log.debug("MainController(): createListener(): creating change listener");
        cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
            var url = $location.url(),
                path = $location.path(),
                params = $location.search();

            $log.debug("MainController(): changeListener(): locationChangeSuccess", url, params);

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

            // keep cid / source in URL
            if (params.cid == null || params.source == null) {
                Session.get().then(function(session) {
                   if (session.cid != null || session.source != null) {
                       $log.debug("MainController(): changeListener(): preserving cid/source in URL");
                       if (session.consultantId != null) {
                           $log.debug("MainController(): changeListener(): using session cid", session.consultantId);
                           params["cid"] = session.consultantId;
                           params["source"] = session.source;
                           $location.search(params);
                           $location.replace();
                           $log.debug("MainController(): changeListener(): replace URL");
                       }
                   }
                });
            }
        });
    }
    createListener();

    Session.get().then(function(session) {
        $log.debug("MainController(): loaded session", session);
        if (session.consultantId) {
            Consultant.get({consultantId: session.consultantId}).$promise.then(function(consultant) {
                $log.debug('MainController(): loaded consultant', consultant);
                $rootScope.consultant = consultant;
            });
        }
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
    };
    
    $scope.quantities = {};

    $rootScope.getTranslated = function(product) {
        var translated = Product.getTranslated(product);
        //$log.debug("MainController(): got translated", translated, "for", product);
        return translated;
    };

    $rootScope.getTranslatedPromoMessage = function(product) {
        var translated = Product.getTranslatedPromoMessage(product);
        //$log.debug("MainController(): got translated promo message", translated, "for", product);
        return translated;
    };

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
    };

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
    };

    $rootScope.getBreadCrumbs = function() {
        return BreadcrumbsHelper.getBreadCrumbs();
    };

    // begin navigation
    $rootScope.navStatic = '0';
    
    $scope.categoryClicked = function(category) {
        $log.debug("MainController(): category clicked", category);
        // set breadcrumbs
        BreadcrumbsHelper.setPath(category, null);
        $rootScope.navStatic = 0;
    };

    $scope.setNavStatic = function(val) {
        $log.debug("MainController(): setting navStatic=1");
        BreadcrumbsHelper.setPath(null, null);
        $rootScope.navStatic = val;
    };

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
    };

    $scope.logout = function() {
        Session.logout();
        $location.path(STORE_BASE_URL);
    };

    $rootScope.loggedIn = function() {
        var loggedIn = Session.isLoggedIn();
        //$log.debug("MainController(): loggedIn(): ", loggedIn);
        return loggedIn;
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

    $scope.$on('$destroy', function () {
        cleanup();
    });

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
