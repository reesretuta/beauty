'use strict';

// Declare app level module which depends on filters, and services
var app = angular.module('app', ['ngRoute', 'growlNotifications', 'ngSanitize', 'ngAnimate', 'ngCookies', 'ui.bootstrap', 'ui.mask', 'ui.keypress', 'ui.jq', 'ui.validate', 'app.filters', 'app.services', 'app.controllers', 'app.directives', 'pasvaz.bindonce', 'jmdobry.angular-cache', 'ui.ladda', 'autocomplete', 'ui.event', 'mgo-angular-wizard', 'pascalprecht.translate'])
    .config([ '$locationProvider', '$routeProvider', '$rootScopeProvider', '$angularCacheFactoryProvider', '$translateProvider', '$httpProvider', '$provide', 'BASE_URL', 'STORE_BASE_URL', 'JOIN_BASE_URL', function ($locationProvider, $routeProvider, $rootScopeProvider, $angularCacheFactoryProvider, $translateProvider, $httpProvider, $provide, BASE_URL, STORE_BASE_URL, JOIN_BASE_URL) {
        //$locationProvider.html5Mode(true);
        $angularCacheFactoryProvider.setCacheDefaults({
            maxAge: 300000, // default to 5 minute caching
            deleteOnExpire: 'aggressive'
        });

        $locationProvider.html5Mode(true).hashPrefix('!');
        $rootScopeProvider.digestTtl(30);

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
        }).when(JOIN_BASE_URL + '/', {
          templateUrl: BASE_URL + '/partials/online_sponsoring/landing.html',
          controller: 'OnlineSponsorLandingController',
          reloadOnSearch: false
        }).when(JOIN_BASE_URL + '/checkout', {
          templateUrl: BASE_URL + '/partials/checkout/checkout-join.html',
          controller: 'CheckoutController',
          reloadOnSearch: false
        }).otherwise({
          templateUrl: BASE_URL + '/partials/page-not-found.html',
          controller: 'MainController'
        });

        $translateProvider.useStaticFilesLoader({
          prefix: '/i18n/locale-',
          suffix: '.json'
        });

        //$translateProvider.registerAvailableLanguageKeys(['en_US', 'es_US'], {
        //    'en_US': 'en_US',
        //    'es_US': 'es_US'
        //});
        //$translateProvider.determinePreferredLanguage();
        //$translateProvider.fallbackLanguage('en_US');

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
        $httpProvider.responseInterceptors.push(interceptor);

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
    }]).run(function ($rootScope, $animate, BASE_URL) {
        $rootScope.BASE_URL = BASE_URL;
        $rootScope.STORE_BASE_URL = BASE_URL + "/shop";
        $rootScope.JOIN_BASE_URL = BASE_URL + "/join";
        $animate.enabled(true);
    });
