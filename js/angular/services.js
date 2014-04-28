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

        productsService.get = function(query, success, failure) {
            return $http.get('/api/products.xml').success(function(data, status, headers, config) {
                $log.debug("searching for product");
                //$log.debug(response.data);
                $log.debug("query", query);

                var products = $.xml2json(data, {"normalize": true});
                products = products.products;
                $log.debug("products", products.productdetail);
                if (query.productId != null) {
                    angular.forEach(products.productdetail, function(product) {
                        $log.debug("itemnumber", product.itemnumber, "productId", query.productId);
                        if (product.itemnumber == query.productId) {
                            success(product, status, headers, config);
                            return product;
                        }
                    });

                    // if we got here, we didn't find the product, 404
                    failure({}, 404, headers, config);
                } else {
                    failure({}, 404, headers, config);
                }
            }).error(function(data, status, headers, config) {
                failure(data, status, headers, config);
                $log.error(data, status, headers, config);
            });
        }

        productsService.query = function(query, success, failure) {
            return $http.get('/api/products.xml').then(function(response) {
                //$log.debug(response.data);
                $log.debug(query);

                var products = $.xml2json(response.data, {"normalize": true});
                products = products.products;
                $log.debug("products", products.productdetail);
                if (query.categoryId != null) {
                    var categoryToProductMap = {};
                    angular.forEach(products.productdetail, function(product) {
                        $log.debug("processing product", product);
                        var categories = product.categories.category;
                        $log.debug("processing categories", Array.isArray(categories), categories);
                        if (!(Array.isArray(categories))) {
                            var id = categories.id;
                            categories = new Array();
                            categories.push(id);
                        }
                        angular.forEach(categories, function(category) {
                            $log.debug("processing category", category);
                            if (categoryToProductMap[category.id] == null) {
                                categoryToProductMap[category.id] = new Array();
                            }
                            categoryToProductMap[category.id].push(product);
                        });
                    });

                    $log.debug("categoryToProductMap", categoryToProductMap);
                    success(categoryToProductMap[query.categoryId], response.headers);
                    return categoryToProductMap[query.categoryId];
                } else {
                    success(products.productdetail, response.headers);
                    return products.productdetail;
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
