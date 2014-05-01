'use strict';

// Declare app level module which depends on filters, and services
var app = angular.module('app', ['ngRoute', 'growlNotifications', 'ngSanitize', 'ngAnimate', 'ui.bootstrap', 'ui.keypress', 'ui.jq', 'app.filters', 'app.services', 'app.controllers', 'app.directives', 'pasvaz.bindonce', 'jmdobry.angular-cache', 'ui.ladda', 'ui.autocomplete', 'ui.event', 'ng-breadcrumbs', 'mgo-angular-wizard', 'pascalprecht.translate'])
    .config([ '$locationProvider', '$routeProvider', '$rootScopeProvider', '$angularCacheFactoryProvider', '$translateProvider', '$provide', 'BASE_URL', function ($locationProvider, $routeProvider, $rootScopeProvider, $angularCacheFactoryProvider, $translateProvider, $provide, BASE_URL) {
        //$locationProvider.html5Mode(true);
        $angularCacheFactoryProvider.setCacheDefaults({
            maxAge: 300000, // default to 5 minute caching
            deleteOnExpire: 'aggressive'
        });

        $rootScopeProvider.digestTtl(30);
        $routeProvider.when(BASE_URL + '/', {
            templateUrl: BASE_URL + '/partials/home.html',
            controller: 'HomeController',
            label: 'Home'
        }).when(BASE_URL + '/products', {
            templateUrl: BASE_URL + '/partials/products/products.html',
            controller: 'ProductsController',
            label: 'Products'
        }).when(BASE_URL + '/products/:productId', {
            templateUrl: BASE_URL + '/partials/products/product.html',
            controller: 'ProductDetailsController',
            label: 'Product Details'
        }).when(BASE_URL + '/objects', {
            templateUrl: BASE_URL + '/partials/objects/objects.html',
            controller: 'ObjectsController'
        }).when(BASE_URL + '/cart', {
            templateUrl: BASE_URL + '/partials/cart/cart.html',
            controller: 'CartController'
        }).when(BASE_URL + '/checkout', {
            templateUrl: BASE_URL + '/partials/checkout/checkout.html',
            controller: 'CheckoutController',
            reloadOnSearch: false
        }).otherwise({
            templateUrl: BASE_URL + '/partials/page-not-found.html',
            controller: 'NotFoundController'
        });
//
//        $translateProvider.translations('en', {
//            'NAV_HOME': 'Home',
//            'NAV_ABOUT': 'About'
//        });
//
//        $translateProvider.translations('es', {
//            'NAV_HOME': 'Case',
//            'NAV_ABOUT': 'Acerca de'
//        });

        $translateProvider.useStaticFilesLoader({
            prefix: '/i18n/locale-',
            suffix: '.json'
        });

        $translateProvider.preferredLanguage('en_US');
    }])
    .run(function ($rootScope, $animate, BASE_URL) {
        $rootScope.BASE_URL = BASE_URL;
        $animate.enabled(true);
    });
