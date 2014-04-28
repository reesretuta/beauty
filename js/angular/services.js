'use strict';

/* Services */

angular.module('app.services', ['ngResource'])
    .factory('Page', function($rootScope, $log) {
        return {
            setTitle : function(title) {
                $log.debug("setting title to", title);
                $rootScope.title = title;
            }
        };
    })
    .factory('Objects', function ($resource, API_URL) {
        return $resource(API_URL + '/objects/:objectId');
    })
    .factory('Products', function ($resource, $http, $log, API_URL) {
        var productsService = {};

        productsService.query = function(query, success, failure) {
            return $http.get('/api/products.xml').then(function(response) {
                //$log.debug(response.data);
                $log.debug(query);

                var products = $.xml2json(response.data);
                products = products.products;
                $log.debug("products", products.productdetail);
                if (query.categoryId != null) {
                    var categoryToProductMap = {};
                    angular.forEach(products.productdetail, function(product) {
                        var categories = product.categories;
                        angular.forEach(categories, function(categoryId) {
                            if (categoryToProductMap[categoryId] == null) {
                                categoryToProductMap[categoryId] = new Array();
                            }
                            categoryToProductMap[categoryId].push(product);
                        });
                    });

                    $log.debug("categoryToProductMap", categoryToProductMap);
                    success(categoryToProductMap[query.categoryId], response.headers);
                    return categoryToProductMap[query.categoryId];
                } else {
                    success(products.categorydetail, response.headers);
                    return products.categorydetail;
                }
            }, function(response) {
                failure(response);
                $log.error(response);
            });
        }

        return productsService;
    })
    .factory('Categories', function ($resource, $http, $log, API_URL) {
        var categoriesService = {};

        categoriesService.query = function(query, success, failure) {
            return $http.get('/api/categories.xml').then(function(response) {
                //$log.debug(response.data);
                var categories = $.xml2json(response.data);
                $log.debug("categories", categories.categories.categorydetail);
                success(categories.categories.categorydetail, response.headers);
                return categories.categories.categorydetail;
            }, function(response) {
                failure(response);
                $log.error(response);
            });
        }

        return categoriesService;
    })
//    .factory('Categories', function ($resource, API_URL) {
//        return $resource(API_URL + '/categories/:categoryId');
//    })
    .constant('BASE_URL', '')
    .constant('API_URL', '/api');
