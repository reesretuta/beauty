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
    .factory('Products', function ($resource, $http, $log, Categories, API_URL) {
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

        function getAllProductInCategory(cat, categoryToProductMap) {
            var allProducts = new Array();

            if (categoryToProductMap[cat.id]) {
                allProducts = allProducts.concat(categoryToProductMap[cat.id]);
            }

            angular.forEach(cat.childcategory, function(childCat) {
                allProducts = allProducts.concat(getAllProductInCategory(childCat, categoryToProductMap));
            });

            return allProducts;
        }

        productsService.query = function(query, success, failure) {
            return $http.get('/api/products.xml').success(function(data, status, headers, config) {
                //$log.debug(data);
                $log.debug("productsService(): query()", query);

                var products = $.xml2json(data, {"normalize": true});
                products = products.products;
                $log.debug("productsService(): query(): products", products.productdetail);
                if (query.categoryId != null) {
                    $log.debug("productsService(): query(): fetching category in query", query.categoryId);

                    Categories.get({'categoryId': query.categoryId, 'recurse': true}, function(queryCategory, status, headers, config) {
                        // got category
                        $log.debug("productsService(): query(): loaded category for product query", queryCategory);

                        var categoryToProductMap = {};
                        angular.forEach(products.productdetail, function(product) {
                            $log.debug("productsService(): query(): processing product", product);
                            var categories = product.categories.category;
                            $log.debug("productsService(): query(): processing categories", Array.isArray(categories), categories);
                            // convert single category item into an array with that item
                            if (!(Array.isArray(categories))) {
                                var cat = categories;
                                categories = new Array();
                                categories.push(cat);
                                //$log.debug("productsService(): query(): converted to array", categories);
                            }
                            // run through each product and add it to the categories it belongs to
                            angular.forEach(categories, function(category) {
                                $log.debug("productsService(): query(): processing category", category);
                                if (categoryToProductMap[category.id] == null) {
                                    categoryToProductMap[category.id] = new Array();
                                }
                                categoryToProductMap[category.id].push(product);
                            });
                        });

                        // run through the category tree to get the lineage for the specified category
                        // return the merged results for all products for all children categories as well
                        var allProducts = getAllProductInCategory(queryCategory, categoryToProductMap);

                        $log.debug("productsService(): query(): categoryToProductMap", categoryToProductMap);
                        success(allProducts, status, headers, config);
                        return allProducts;
                    }, function(data, status, headers, config) {
                        // failure
                        $log.error("error looking up category");
                        failure(data, status, headers, config);
                    });

                } else if (query.productIds != null) {
                    var returnedProducts = new Array();
                    $log.debug("productsService(): query(): productIds", query.productIds);
                    angular.forEach(query.productIds, function(productId) {
                        $log.debug("productsService(): query(): productId", productId);
                        $log.debug("productsService(): query(): products", products.productdetail);
                        var found = 0;
                        angular.forEach(products.productdetail, function(product) {
                            $log.debug("productsService(): query(): productId", productId, "itemNumber", product.itemnumber);
                            if (productId == product.itemnumber) {
                                returnedProducts.push(product);
                                found = 1;
                            }
                        });
                        if (!found) {
                            failure({}, 404, headers, config);
                        }
                    });
                    $log.debug("productsService(): query(): got products by ids", returnedProducts);
                    success(returnedProducts, status, headers, config);
                    return returnedProducts;
                } else if (query.search != null) {
                    var returnedProducts = new Array();
                    $log.debug("productsService(): query(): search", query.search);
                    angular.forEach(products.productdetail, function(product) {
                        if (S(product.itemnumber).toLowerCase().contains(S(query.search).toLowerCase()) || S(product.productname).toLowerCase().contains(S(query.search).toLowerCase())) {
                            returnedProducts.push(product);
                        }
                    });
                    $log.debug("productsService(): query(): got products by search", returnedProducts);
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
                $log.debug("categoriesService(): id", category.id, "categoryId", id);
                if (parent) {
                    category.parentcategory = parent;
                }
                if (category.id == id) {
                    $log.debug("categoriesService(): found category, returning!", category);
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
                $log.debug("categoriesService(): searching for category");
                //$log.debug(response.data);
                $log.debug("categoriesService(): query", query);

                var categories = $.xml2json(data, {"normalize": true});
                categories = categories.categories;
                $log.debug("categoriesService(): categories", categories.categorydetail);
                if (query.categoryId != null) {
                    var c = findCategory(categories.categorydetail, query.categoryId, query.recurse);

                    if (c != null) {
                        $log.debug("categoriesService(): found category", c);
                        success(c, status, headers);
                        return c;
                    }

                    $log.debug("categoriesService(): couldn't find category", c);

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
    .factory('BreadcrumbsHelper', function($log) {
        var breadcrumbService = {};

        breadcrumbService.setPath = function(breadcrumbs, list) {
            $log.debug("breadcrumbService.buildPath(): setting breadcrumbs", breadcrumbs, list);

            var newCrumbs = new Array();
            // always push home first
            newCrumbs.push({
                label: 'Home',
                path: '/'
            });
            angular.forEach(list, function(crumb) {
                var newCrumb = {};
                newCrumb.label = crumb.name;
                if (crumb.type == 'category') {
                    newCrumb.path = '/products?category=' + crumb.id;
                } else if (crumb.type == 'product') {
                    newCrumb.path = '/products/' + crumb.id;
                }
                newCrumbs.push(newCrumb);
            });

            $log.debug("breadcrumbService.buildPath(): setting new breadcrumbs", newCrumbs);
            breadcrumbs.breadcrumbs = newCrumbs;
        }

        breadcrumbService.buildPath = function(category, product, list) {
            if (list == null && product != null) {
                list = new Array();
                $log.debug("breadcrumbService.buildPath(): setting path to product name");
                list.unshift({
                    type: 'product',
                    name: product.productname,
                    id: product.id,
                    item: product
                });
            } else if (list == null) {
                list = new Array();
            }
            if (category != null) {
                $log.debug("breadcrumbService.buildPath(): prepending category name", category.name);
                list.unshift({
                    type: 'category',
                    name: category.name,
                    id: category.id,
                    item: category
                });
                return breadcrumbService.buildPath(category.parentcategory, product, list);
            } else {
                $log.debug("breadcrumbService.buildPath(): returning current path", list);
            }
            return list;
        }

        return breadcrumbService;
    })
    .factory('RecentlyViewed', function ($rootScope, $log, growlNotifications) {
        var productService = {};

        if ($rootScope.recentlyViewed == null) {
            $rootScope.recentlyViewed = {};
            $rootScope.recentlyViewed.items = new Array();
        }

        productService.getItems = function() {
            return $rootScope.recentlyViewed.items;
        };

        productService.addRecentlyViewed = function(p) {
            var found = 0;
            angular.forEach($rootScope.recentlyViewed.items, function(product) {
                $log.debug("checking recently added against list", p.itemnumber, product.itemnumber );
                if (product.itemnumber == p.itemnumber) {
                    $log.debug("already in recently viewed", p);
                    found = 1;
                }
            });

            if (!found) {
                $rootScope.recentlyViewed.items.push(angular.copy(p));
                var viewProdCount = $rootScope.recentlyViewed.items.length;
                if(viewProdCount > 4) {
                    $rootScope.recentlyViewed.items.splice(0,1);
                }
            }

            $log.debug("recently viewed is now", $rootScope.recentlyViewed);
        };
        return productService;
    })
    .constant('BASE_URL', '')
    .constant('API_URL', '/api');
