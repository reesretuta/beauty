'use strict';

// Declare app level module which depends on filters, and services
var app = angular.module('app', ['ngRoute', 'growlNotifications', 'ngSanitize', 'ngAnimate', 'ngCookies', 'ui.mask', 'ui.keypress', 'ui.jq', 'ui.validate', 'app.filters', 'app.services', 'app.controllers', 'app.directives', 'pasvaz.bindonce', 'jmdobry.angular-cache', 'autocomplete', 'ui.event', 'mgo-angular-wizard', 'pascalprecht.translate', 'LocalStorageModule',
        'ui.bootstrap.tpls', 'ui.bootstrap.alert', 'ui.bootstrap.dropdown', 'ui.bootstrap.tooltip', 'ui.bootstrap.buttons', 'ui.bootstrap.modal', 'ui.bootstrap.popover', 'ui.bootstrap.tabs', 'infinite-scroll', 'angulartics', 'angulartics.google.analytics', 'angulartics.google.tagmanager', 'angulartics.scroll', 'angulartics.debug', 'newrelic-timing'])
    .config([ '$locationProvider', '$routeProvider', '$rootScopeProvider', '$angularCacheFactoryProvider', '$translateProvider', '$httpProvider', '$provide', 'localStorageServiceProvider', '$analyticsProvider', 'BASE_URL', 'STORE_BASE_URL', 'JOIN_BASE_URL', function ($locationProvider, $routeProvider, $rootScopeProvider, $angularCacheFactoryProvider, $translateProvider, $httpProvider, $provide, localStorageServiceProvider, $analyticsProvider, BASE_URL, STORE_BASE_URL, JOIN_BASE_URL) {
        //$locationProvider.html5Mode(true);
        $angularCacheFactoryProvider.setCacheDefaults({
            maxAge: 300000, // default to 5 minute caching
            deleteOnExpire: 'aggressive'
        });

        $locationProvider.html5Mode(true).hashPrefix('!');
        $rootScopeProvider.digestTtl(30);

        // notify on set / remove items
        localStorageServiceProvider.setNotify(true, true);

        $analyticsProvider.settings.ga.additionalAccountNames = [];

        $routeProvider.when(STORE_BASE_URL + '/', {
          templateUrl: BASE_URL + '/partials/home.html',
          controller: 'HomeController',
          label: 'Home'
        }).when(STORE_BASE_URL + '/products', {
          templateUrl: BASE_URL + '/partials/products/products.html',
          controller: 'ProductsController'
        }).when(STORE_BASE_URL + '/products/:productId', {
            templateUrl: BASE_URL + '/partials/products/product.html',
            controller: 'ProductDetailsController'
        }).when(STORE_BASE_URL + '/products/:productId/:productId2', {
            templateUrl: BASE_URL + '/partials/products/product.html',
            controller: 'ProductDetailsController'
        }).when(STORE_BASE_URL + '/objects', {
          templateUrl: BASE_URL + '/partials/objects/objects.html',
          controller: 'ObjectsController'
        }).when(STORE_BASE_URL + '/cart', {
          templateUrl: BASE_URL + '/partials/cart/cart.html',
          controller: 'CartController'
        }).when(STORE_BASE_URL + '/checkout', {
          templateUrl: BASE_URL + '/partials/checkout/checkout.html',
          controller: 'CheckoutController',
          reloadOnSearch: false
        }).when(BASE_URL + '/account', {
          templateUrl: BASE_URL + '/partials/account/account.html',
            controller: 'AccountController',
          reloadOnSearch: false
        }).when(JOIN_BASE_URL + '/', {
          templateUrl: BASE_URL + '/partials/online_sponsoring/landing.html',
          controller: 'OnlineSponsorLandingController',
          reloadOnSearch: false
        }).when(JOIN_BASE_URL + '/checkout', {
          templateUrl: BASE_URL + '/partials/checkout/checkout-join.html',
          controller: 'CheckoutController',
          reloadOnSearch: false
        }).when(STORE_BASE_URL + '/passwordReset', {
          templateUrl: BASE_URL + '/partials/password-reset.html',
          controller: 'PasswordResetController'
        }).when(STORE_BASE_URL + '/forgotPassword', {
          templateUrl: BASE_URL + '/partials/forgot-password.html',
          controller: 'PasswordResetController'
        })
        .when(STORE_BASE_URL + '/oops', {
          templateUrl: BASE_URL + '/partials/unknown-error.html',
          controller: 'MainController'
        })
        .when(JOIN_BASE_URL + '/oops', {
          templateUrl: BASE_URL + '/partials/unknown-error.html',
          controller: 'MainController'
        })
        .otherwise({
          templateUrl: BASE_URL + '/partials/page-not-found.html',
          controller: 'MainController'
        });

        $translateProvider.useStaticFilesLoader({
          prefix: '/i18n/locale-',
          suffix: '.json'
        });

        $translateProvider.fallbackLanguage('en_US');
        $translateProvider.preferredLanguage('en_US');

        var interceptor = ['$location', '$q', '$timeout', '$rootScope', '$log', function($location, $q, $timeout, $rootScope, $log) {
            var cancelSessionTimerPromise = null;

            function resetSessionTimer(response) {
                $log.debug("resetSessionTimer()");
                if (cancelSessionTimerPromise != null) {
                    $timeout.cancel(cancelSessionTimerPromise);
                }

                // expire login sessions after an hour of inactivity
                cancelSessionTimerPromise = $timeout(function() {
                    $log.debug('resetSessionTimer(): session expired, notifying listeners');

                    // let everyone else know
                    $rootScope.$emit('loginSessionExpired', 'Login session expired');
                }, 3600000);
            }

            function success(response) {
                if (S(response.config.url).startsWith("/api")) {
                    resetSessionTimer(response);
                }
                return response;
            }

            function error(response) {
                return $q.reject(response);
            }

            return function(promise) {
                return promise.then(success, error);
            }
        }];

        var path = window.location.pathname;
        if (path && path.match(STORE_BASE_URL)) {
            console.log("setting up session expiration listener");
            $httpProvider.interceptors.push(function() {
                return {
                    response: interceptor
                }
            });
        } else {
            console.log("NOT setting up session expiration listener");
        }

//        $provide.decorator( '$log', function( $delegate ) {
//            // Save the original $log.debug()
//            var debugFn = $delegate.debug;
//            var errorFn = $delegate.error;
//
//            $delegate.debug = function() {
//                var args    = [].slice.call(arguments);
//
//                // send the log message to the server in debug mode
//                $.ajax("/debug?message="+args.toString(), {});
//
//                debugFn.apply(null, args)
//            };
//
//            $delegate.error = function() {
//                var args    = [].slice.call(arguments);
//
//                // send the log message to the server in debug mode
//                $.ajax("/error?message="+args.toString(), {});
//
//                errorFn.apply(null, args)
//            };
//
//            return $delegate;
//        });
    }]).run(function ($rootScope, $animate, $log, $window, $location, Session, Consultant, $translate, $templateCache, BASE_URL, CDN_URL) {
        $rootScope.BASE_URL = BASE_URL;
        $rootScope.CDN_URL = CDN_URL;
        $rootScope.STORE_BASE_URL = BASE_URL + "/shop";
        $rootScope.JOIN_BASE_URL = BASE_URL + "/join";
        $animate.enabled(true);

        // set var if they framed the app.
        $rootScope.iveBeenFramed = false;

        if (top !== self) {
            $rootScope.iveBeenFramed = true;
            $log.debug("app(): $rootScope.iveBeenFramed", $rootScope.iveBeenFramed);
        }

        var search = $location.search();
        $log.debug("app(): got query params", search);
        
        var cid = parseInt(search["cid"]);
        if (isNaN(cid)) {
            cid = null;
        }
        var source = search["source"];
        var language = search["language"];
        $log.debug("app(): consultantId", cid, "source", source, "language", language);

        var sess = {};
        if (!S(language).isEmpty() && (language == "en_US" || language == "es_US")) {
            sess["language"] = language;
            $translate.use(language);
        }
        if (!S(source).isEmpty()) {
            sess["source"] = (source == "fb" || source == "mb" || source == "pws") ? source : "web";
        }
        if (!S(cid).isEmpty()) {
            sess["consultantId"] = cid;
            Consultant.get({consultantId: cid}).$promise.then(function(consultant) {
                $log.debug("app(): loaded consultant", consultant);
                $rootScope.consultant = consultant;
            });
        }

        if (Object.keys(sess).length > 0) {
            Session.set(sess).then(function(session) {
                $log.debug("app(): save to session", session);
            }, function(err) {
                $log.debug("app(): failed to save to session sponsorId", cid, "source", source, "language", language);
            });
        }

        $templateCache.put("template/popover/popover-html-unsafe-popup.html",
            "<div class=\"popover {{placement}}\" ng-class=\"{ in: isOpen(), fade: animation() }\">\n" +
            "  <div class=\"arrow\"></div>\n" +
            "\n" +
            "  <div class=\"popover-inner\">\n" +
            "      <h3 class=\"popover-title\" ng-bind-html=\"title | unsafe\" ng-show=\"title\"></h3>\n" +
            "      <div class=\"popover-content\" ng-bind-html=\"content | unsafe\"></div>\n" +
            "  </div>\n" +
            "</div>\n" +
            "");
});

/**
 * handle exceptions gracefully
 * -----------------------------
 * in production, return users to an error page
 */

/*.factory('$exceptionHandler', ['$log', '$injector', 'STORE_BASE_URL', 'JOIN_BASE_URL', function($log, $injector, STORE_BASE_URL, JOIN_BASE_URL) {

    var ENV, BASE_URL;

    // determine env
    ENV = 'development';

    // shop or join?
    BASE_URL = (new RegExp(STORE_BASE_URL).test(window.location.host)) ?
        STORE_BASE_URL : JOIN_BASE_URL;

    $log.debug('exception_handler: ENV: %s, BASE_URL: %s', ENV, BASE_URL);

    // production behavior (OOPS!)
    if (ENV === 'production') {
        return function(exception, cause) {
            var nextPath, $location = $injector.get('$location');
            exception.message += ' [caused by "' + cause + '"]';
            $log.debug('exception_handler: exception.message:', exception.message);
            $location.path(STORE_BASE_URL + '/oops');
        };
    } else {
        return function(exception, cause) {
            $log.error('exception_handler: exception', exception);
            exception.message += ' [caused by "' + cause + '"]';
        }
    }

}]);*/


