'use strict';

// Declare app level module which depends on filters, and services
var app = angular.module('app', ['ngRoute', 'growlNotifications', 'ngSanitize', 'ngAnimate', 'ui.bootstrap', 'ui.mask', 'ui.keypress', 'ui.jq', 'app.filters', 'app.services', 'app.controllers', 'app.directives', 'pasvaz.bindonce', 'jmdobry.angular-cache', 'ui.ladda', 'autocomplete', 'ui.event', 'mgo-angular-wizard', 'pascalprecht.translate'])
    .config([ '$locationProvider', '$routeProvider', '$rootScopeProvider', '$angularCacheFactoryProvider', '$translateProvider', '$provide', 'BASE_URL', 'STORE_BASE_URL', 'JOIN_BASE_URL', function ($locationProvider, $routeProvider, $rootScopeProvider, $angularCacheFactoryProvider, $translateProvider, $provide, BASE_URL, STORE_BASE_URL, JOIN_BASE_URL) {
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
          templateUrl: BASE_URL + '/partials/checkout/checkout.html',
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

        $translateProvider.preferredLanguage('en_US');
    }])
    .run(function ($rootScope, $animate, BASE_URL) {
        $rootScope.BASE_URL = BASE_URL;
        $rootScope.STORE_BASE_URL = BASE_URL + "/shop";
        $rootScope.JOIN_BASE_URL = BASE_URL + "/join";
        $animate.enabled(true);
    });
