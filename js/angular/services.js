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
    .factory('Cart', function ($rootScope, $log) {
        var cartService = {};

        function getCart() {
            if ($rootScope.cart == null) {
                $rootScope.cart = {};
            }
            var cart = $rootScope.cart;
            if (cart.items == null) {
                cart.items = new Array();
            }
            return cart;
        }
        getCart();

        cartService.getItemCount = function() {
            var cart = getCart();
            $log.debug("getItemCount()");
            return Object.keys(cart.items).length;
        };

        cartService.getItems = function() {
            var cart = getCart();
            return cart.items;
        };

        cartService.addToCart = function(p) {
            var cart = getCart();
            angular.forEach(cart.items, function(product) {
                if (product.itemnumber == p.itemnumber) {
                    
                  var newQty = parseInt(p.quantity) + parseInt(product.quantity);
                  
                  var getIndex=cart.items.indexOf(product);
                  cart.items.splice(getIndex,1);     
                  
                  p.quantity = newQty;
                  return p;

                } 
                
            });
            
            $log.debug("addToCart()", cart);
            cart.items.push(p);
        };

        cartService.removeFromCart = function(p) {
            var cart = getCart();
            angular.forEach(cart.items, function(product) {
                if (product.itemnumber ==p.itemnumber) {
                    
                  
                  var getIndex=cart.items.indexOf(product);
                  cart.items.splice(getIndex,1);     
                  

                } 
                
            });
            
        };

        return cartService;
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
            return $http.get('/api/products.xml').success(function(data, status, headers, config) {
                //$log.debug(data);
                $log.debug("productsService(): query", query);

                var products = $.xml2json(data, {"normalize": true});
                products = products.products;
                $log.debug("products", products.productdetail);
                if (query.categoryId != null) {
                    var categoryToProductMap = {};
                    angular.forEach(products.productdetail, function(product) {
                        $log.debug("processing product", product);
                        var categories = product.categories.category;
                        $log.debug("processing categories", Array.isArray(categories), categories);
                        if (!(Array.isArray(categories))) {
                            var cat = categories;
                            categories = new Array();
                            categories.push(cat);
                            //$log.debug("converted to array", categories);
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
                    success(categoryToProductMap[query.categoryId], status, headers, config);
                    return categoryToProductMap[query.categoryId];
                } else if (query.productIds != null) {
                    var returnedProducts = new Array();
                    $log.debug("productIds", query.productIds);
                    angular.forEach(query.productIds, function(productId) {
                        $log.debug("productId", productId);
                        $log.debug("products", products.productdetail);
                        var found = 0;
                        angular.forEach(products.productdetail, function(product) {
                            $log.debug("productId", productId, "itemNumber", product.itemnumber);
                            if (productId == product.itemnumber) {
                                returnedProducts.push(product);
                                found = 1;
                            }
                        });
                        if (!found) {
                            failure({}, 404, headers, config);
                        }
                    });
                    $log.debug("got products by ids", returnedProducts);
                    success(returnedProducts, status, headers, config);
                    return returnedProducts;
                } else {
                    success(products.productdetail, status, headers, config);
                    return products.productdetail;
                }
            }).error(function(data, status, headers, config) {
                failure(data, status, headers, config);
                $log.error(data, status, headers, config);
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
