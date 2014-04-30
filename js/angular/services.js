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
    .factory('Search', function ($timeout, $location, $rootScope, $log) {
        var searchService = {};

        var SEARCH_DELAY = 1000;

        $rootScope.search = {};
        $rootScope.search.query = '';

        $rootScope.$watch('search.queryDelayed', function(newVal, oldVal) {
            $log.debug("new", newVal, "old", oldVal);
            if ($rootScope.lastSearchDelayTimeout != null) {
                $timeout.cancel($rootScope.lastSearchDelayTimeout);
            }

            // TODO: start a search spinner

            // update the root scope search
            $rootScope.lastSearchDelayTimeout = $timeout(function () {
                $log.debug("delay passed, searching", $rootScope.search.queryDelayed);
                $rootScope.search.query = $rootScope.search.queryDelayed;
                // add the search to the url if we are in products
                if ($location.path() == "/products") {
                    $location.search("search", $rootScope.search.query);
                }
                // TODO: stop the search spinner
            }, SEARCH_DELAY);
        });

        searchService.search = function(query) {
            $rootScope.search.query = query;
            $rootScope.search.queryDelayed = query;
        };

        searchService.getQuery = function() {
            return $rootScope.search.query;
        };

        return searchService;
    })
    .factory('Section', function($rootScope, $log) {
        return {
            setSection : function(section) {
                $log.debug("setting section to", section);
                $rootScope.section = section;
            }
        };
    })
    .factory('Cart', function ($rootScope, $log, growlNotifications) {
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
            var count = 0;
            angular.forEach(cart.items, function(product) {
                count += parseInt(product.quantity);
            });
            
            //$log.debug("getItemCount()");
            return count;
        };

        cartService.getItems = function() {
            var cart = getCart();
            return cart.items;
        };

        cartService.addToCart = function(p) {
            var cart = getCart();
            var getIndex;
            angular.forEach(cart.items, function(product) {
                if (product.itemnumber == p.itemnumber) {
                  var newQty = parseInt(p.quantity) + parseInt(product.quantity);
                  
                  getIndex=cart.items.indexOf(product);
                  cart.items.splice(getIndex,1);                    

                  p.quantity = newQty;
                  $log.debug("added product", p);
                  return p;
                }
            });

            $log.debug("addToCart()", cart);
            cart.items.splice(getIndex,0,p);

            // growlnotification when adding to cart
            growlNotifications.add('<i class="fa fa-shopping-cart"></i> '+p.productname+' <a href="#/cart"><b>added to cart</b></a>', 'warning', 4000);
        };
        
        cartService.updateCart = function(p) {
            var cart = getCart();
            var getIndex;
            angular.forEach(cart.items, function(product) {
                if (product.itemnumber == p.itemnumber) {
                  getIndex=cart.items.indexOf(product);
                  cart.items.splice(getIndex,1);  
                  return getIndex;
                }
                
            });

            $log.debug("updateCart()", cart);
            cart.items.splice(getIndex,0,p);
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
                        } else if (product.groupid == query.productId) {
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
                } else if (query.search != null) {
                    var returnedProducts = new Array();
                    $log.debug("search", query.search);
                    angular.forEach(products.productdetail, function(product) {
                        if (S(product.itemnumber).toLowerCase().contains(S(query.search).toLowerCase()) || S(product.productname).toLowerCase().contains(S(query.search).toLowerCase())) {
                            returnedProducts.push(product);
                        }
                    });
                    $log.debug("got products by search", returnedProducts);
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

        function findCategory(categories, id, recurse, parent) {
            for (var i=0; i < categories.length; i++) {
                var category = categories[i];
                $log.debug("id", category.id, "categoryId", id);
                if (parent) {
                    category.parentcategory = parent;
                }
                if (category.id == id) {
                    $log.debug("found category, returning!", category);
                    return category;
                } else if (recurse && Array.isArray(category.childcategory)) {
                    var c = findCategory(category.childcategory, id, true, category);
                    if (c != null) {
                        return c;
                    }
                }
            }
            return null;
        }

        categoriesService.get = function(query, success, failure) {
            return $http.get('/api/categories.xml').success(function(data, status, headers, config) {
                $log.debug("searching for category");
                //$log.debug(response.data);
                $log.debug("query", query);

                var categories = $.xml2json(data, {"normalize": true});
                categories = categories.categories;
                $log.debug("categories", categories.categorydetail);
                if (query.categoryId != null) {
                    var c = findCategory(categories.categorydetail, query.categoryId, query.recurse);

                    if (c != null) {
                        success(c, status, headers);
                        return c;
                    }

                    // if we got here, we didn't find the category, 404
                    failure({}, 404, headers, config);
                } else {
                    failure({}, 404, headers, config);
                }
            }).error(function(data, status, headers, config) {
                failure(data, status, headers, config);
                $log.error(data, status, headers, config);
            });
        }

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
    .factory('RecentlyViewed', function ($rootScope, $log, growlNotifications) {
        var productService = {};

        function getRecentlyViewed() {
            if ($rootScope.recentlyViewed == null) {
                $rootScope.recentlyViewed = {};
            }
            var recentlyViewed = $rootScope.recentlyViewed;
            if (recentlyViewed.items == null) {
                recentlyViewed.items = new Array();
            }
            return recentlyViewed;
        }
        getRecentlyViewed();

//        productService.getItemCount = function() {
//            var relatedProducts = getRelatedProducts();
//            var count = 0;
//            angular.forEach(relatedProducts.items, function(product) {
//                count += parseInt(product.quantity);
//            });
//            
//            return count;
//        };

        productService.getItems = function() {
            var recentlyViewed = getRecentlyViewed();
            return recentlyViewed.items;
        };

        productService.addRecentlyViewed = function(p) {
            var recentlyViewed = getRecentlyViewed();
            var getIndex;
            angular.forEach(recentlyViewed.items, function(product) {
                if (product.itemnumber != p.itemnumber) {
                  
//                  getIndex=cart.items.indexOf(product);
//                  cart.items.splice(getIndex,1);                    
//
//                  p.quantity = newQty;
//                  $log.debug("added product", p);
                  recentlyViewed.items.push(p);
                }
            });

//            relatedProducts.items.splice(getIndex,0,p);
            
        };
        
//        cartService.updateCart = function(p) {
//            var cart = getCart();
//            var getIndex;
//            angular.forEach(cart.items, function(product) {
//                if (product.itemnumber == p.itemnumber) {
//                  getIndex=cart.items.indexOf(product);
//                  cart.items.splice(getIndex,1);  
//                  return getIndex;
//                }
//                
//            });
//
//            $log.debug("updateCart()", cart);
//            cart.items.splice(getIndex,0,p);
//        };
//
//        cartService.removeFromCart = function(p) {
//            var cart = getCart();
//            angular.forEach(cart.items, function(product) {
//                if (product.itemnumber ==p.itemnumber) {
//                  var getIndex=cart.items.indexOf(product);
//                  cart.items.splice(getIndex,1);     
//                }
//                
//            });
//            
//        };

        return productService;
    })
//    .factory('Categories', function ($resource, API_URL) {
//        return $resource(API_URL + '/categories/:categoryId');
//    })
    .constant('BASE_URL', '')
    .constant('API_URL', '/api');
