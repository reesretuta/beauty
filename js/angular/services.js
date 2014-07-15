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

//        $rootScope.$watch('search.queryDelayed', function(newVal, oldVal) {
//            $log.debug("new", newVal, "old", oldVal);
//            if ($rootScope.lastSearchDelayTimeout != null) {
//                $timeout.cancel($rootScope.lastSearchDelayTimeout);
//            }
//
//            // TODO: start a search spinner
//
//            // update the root scope search
//            $rootScope.lastSearchDelayTimeout = $timeout(function () {
//                $log.debug("delay passed, searching", $rootScope.search.queryDelayed);
//                $rootScope.search.query = $rootScope.search.queryDelayed;
//                // add the search to the url if we are in products
//                if ($location.path() == "/products") {
//                    $location.search("search", $rootScope.search.query);
//                } else {
//                    $location.url("/products");
//                    if ($rootScope.search.query != null && $rootScope.search.query !== undefined) {
//                        $location.search("search", $rootScope.search.query);
//                    }
//                }
//                // TODO: stop the search spinner
//            }, SEARCH_DELAY);
//        });
//
        searchService.search = function(query) {
            $log.debug("searching");
            $rootScope.search.query = query;

            if ($location.path() == "/products") {
                $location.search("search", $rootScope.search.query);
            } else {
                $location.url("/products");
                if ($rootScope.search.query != null && $rootScope.search.query !== undefined) {
                    $location.search("search", $rootScope.search.query);
                }
            }
        };

        searchService.getQuery = function() {
            return $rootScope.search.query;
        };

        return searchService;
    })
    .factory('Session', function(Checkout, $rootScope, $log) {
        var sessionService = {};

        function getSession() {
            if ($rootScope.session == null) {
                $rootScope.session = {
                    'language': 'en_US'
                };
            }
            var session = $rootScope.session;
            return session;
        }
        getSession();

        sessionService.getSession = function() {
            return getSession();
        }

        sessionService.login = function(username, password) {
            //$log.debug("Session(): login(): attempting to login with username=", username, "password=", password);
            if (username == 'joe@blog.com' && password == 'password') {
                // always assume yes for now
                var session = getSession();
                session.authenticated = true;
                session.user = {
                    'email': username
                };
                return true;
            } else {
                return false;
            }
        }
        
        sessionService.createUser = function(username) {
            var session = getSession();
            session.authenticated = true;
            session.user = {
                'email': username
            };
            return true;
        }

        sessionService.getLanguage = function() {
            var session = getSession();
            if (session.language == null) {
                session.language = 'en_US';
            }
            return session.language;
        }

        sessionService.setLanguage = function(language) {
            var session = getSession();
            session.language = language;
        }

        sessionService.isLoggedIn = function() {
            var session = getSession();
            //$log.debug("Session(): isLoggedIn(): ", session.authenticated);
            return session.authenticated;
        }

        sessionService.getUser = function() {
            var session = getSession();
            //$log.debug("Session(): getUser(): ", session.user);
            return session.user;
        }

        sessionService.logout = function() {
            var session = getSession();
            session.authenticated = false;
            Checkout.clear();
        }

        return sessionService;
    })
    .factory('Section', function($rootScope, $log) {
        return {
            setSection : function(section) {
                $log.debug("setting section to", section);
                $rootScope.section = section;
            }
        };
    })
    .factory('Checkout', function ($rootScope, $log) {
        var checkoutService = {};

        function getCheckout() {
            if ($rootScope.checkout == null) {
                $rootScope.checkout = {};
            }
            var checkout = $rootScope.checkout;
            return checkout;
        }
        getCheckout();

        checkoutService.getCheckout = function() {
            return getCheckout();
        };

        checkoutService.setCheckout = function(checkout) {
            $rootScope.checkout = checkout;
        };

        checkoutService.clear = function() {
            $rootScope.checkout = {};
        }

        return checkoutService;
    })
    .factory('Cart', function ($rootScope, $log, $timeout, growlNotifications) {
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
            $rootScope.adding = true;

            var cart = getCart();
            $log.debug("addToCart()", cart, p);

            // check the cart for matching items, so we can update instead of add
            var updated = false;
            $.each(cart.items, function(index, product) {
                //$log.debug("addToCart(): comparing products", p, product);
                if (product.sku == p.sku && p.kitSelections == null && product.kitSelections == null) {
                    //$log.debug("addToCart(): non-kit products are identical");
                    var newQty = parseInt(p.quantity) + parseInt(product.quantity);
                    product.quantity = newQty;
                    $log.debug("addToCart(): added one more", p);
                    updated = true;
                    return true;
                }
// commenting out for now, this is the code that will group kits with identically configured kits
//                else if (p.kitSelections != null && product.kitSelections != null) {
//                    //$log.debug("addToCart(): determining if kit selections are identical");
//                    // compare kit selections
//                    //$log.debug("addToCart(): looping through this products kit selections", p.kitSelections);
//                    $.each(p.kitSelections, function(kitsku, kitProduct) {
//                        //$log.debug("addToCart(): looping through car products kit selections", product.kitSelections);
//                        $.each(product.kitSelections, function(otherkitsku, otherKitProduct) {
//                            //$log.debug("comparing kit", kitsku, product, "to", otherkitsku, otherKitProduct);
//                            if (kitsku == otherkitsku && kitProduct.sku == otherKitProduct.sku) {
//                                //$log.debug("matched");
//                                var newQty = parseInt(p.quantity) + parseInt(product.quantity);
//                                product.quantity = newQty;
//                                $log.debug("addToCart(): added one more kit", p);
//                                updated = true;
//                                return true;
//                            }
//                        });
//                    });
//                }
            });

            if (!updated) {
                // we haven't updated the cart, so this is a new item to add
                $log.debug("addToCart(): adding new item", p);
                cart.items.push(p);
            }

            // growlnotification when adding to cart
            growlNotifications.add('<i class="fa fa-shopping-cart"></i> '+p.name+' <a href="#/cart"><b>added to cart</b></a>', 'warning', 4000);

            $timeout(function() {
                $rootScope.adding = false;
                // set class
                $timeout(function() {
                    // remove check
                }, 2000);
            }, 2000);
        };

        cartService.removeFromCart = function(p) {
            var cart = getCart();
            angular.forEach(cart.items, function(product) {
                if (product.sku ==p.sku) {
                  var getIndex=cart.items.indexOf(product);
                  cart.items.splice(getIndex,1);     
                }
                
            });
            
        };

        cartService.clear = function() {
            var cart = getCart();
            cart.items = new Array();
        };

        return cartService;
    })
    .factory('Products', function ($resource, $http, $log, Categories, API_URL) {
        return $resource(API_URL + '/products/:productId', {productId: '@_id'});


//        productsService.get = function(query, success, failure) {
//            return $http.get('/api/products.xml').success(function(data, status, headers, config) {
//                $log.debug("searching for product");
//                //$log.debug(response.data);
//                $log.debug("query", query);
//
//                var products = $.xml2json(data, {"normalize": true});
//                products = products.products;
//                $log.debug("products", products.productdetail);
//                if (query.productId != null) {
//                    angular.forEach(products.productdetail, function(product) {
//                        $log.debug("sku", product.sku, "productId", query.productId);
//                        if (product.sku == query.productId) {
//                            success(product, status, headers, config);
//                            return product;
//                        } else if (product.sku == query.productId) {
//                            success(product, status, headers, config);
//                            return product;
//                        }
//                    });
//
//                    // if we got here, we didn't find the product, 404
//                    failure({}, 404, headers, config);
//                } else {
//                    failure({}, 404, headers, config);
//                }
//            }).error(function(data, status, headers, config) {
//                failure(data, status, headers, config);
//                $log.error(data, status, headers, config);
//            });
//        }

//        function getAllProductInCategory(cat, categoryToProductMap) {
//            var allProducts = new Array();
//
//            if (categoryToProductMap[cat.id]) {
//                allProducts = allProducts.concat(categoryToProductMap[cat.id]);
//            }
//
//            angular.forEach(cat.childcategory, function(childCat) {
//                allProducts = allProducts.concat(getAllProductInCategory(childCat, categoryToProductMap));
//            });
//
//            return allProducts;
//        }

//        productsService.query = function(query, success, failure) {
//            return $http.get('/api/products.xml').success(function(data, status, headers, config) {
//                //$log.debug(data);
//                $log.debug("productsService(): query()", query);
//
//                var products = $.xml2json(data, {"normalize": true});
//                products = products.products;
//                $log.debug("productsService(): query(): products", products.productdetail);
//                if (query.categoryId != null) {
//                    $log.debug("productsService(): query(): fetching category in query", query.categoryId);
//
//                    Categories.get({'categoryId': query.categoryId, 'recurse': true}, function(queryCategory, status, headers, config) {
//                        // got category
//                        $log.debug("productsService(): query(): loaded category for product query", queryCategory);
//
//                        var categoryToProductMap = {};
//                        angular.forEach(products.productdetail, function(product) {
//                            $log.debug("productsService(): query(): processing product", product);
//                            var categories = product.categories.category;
//                            $log.debug("productsService(): query(): processing categories", Array.isArray(categories), categories);
//                            // convert single category item into an array with that item
//                            if (!(Array.isArray(categories))) {
//                                var cat = categories;
//                                categories = new Array();
//                                categories.push(cat);
//                                //$log.debug("productsService(): query(): converted to array", categories);
//                            }
//                            // run through each product and add it to the categories it belongs to
//                            angular.forEach(categories, function(category) {
//                                $log.debug("productsService(): query(): processing category", category);
//                                if (categoryToProductMap[category.id] == null) {
//                                    categoryToProductMap[category.id] = new Array();
//                                }
//                                categoryToProductMap[category.id].push(product);
//                            });
//                        });
//
//                        // run through the category tree to get the lineage for the specified category
//                        // return the merged results for all products for all children categories as well
//                        var allProducts = getAllProductInCategory(queryCategory, categoryToProductMap);
//
//                        $log.debug("productsService(): query(): categoryToProductMap", categoryToProductMap);
//                        success(allProducts, status, headers, config);
//                        return allProducts;
//                    }, function(data, status, headers, config) {
//                        // failure
//                        $log.error("error looking up category");
//                        failure(data, status, headers, config);
//                    });
//
//                } else if (query.productIds != null) {
//                    var returnedProducts = new Array();
//                    $log.debug("productsService(): query(): productIds", query.productIds);
//                    angular.forEach(query.productIds, function(productId) {
//                        $log.debug("productsService(): query(): productId", productId);
//                        $log.debug("productsService(): query(): products", products.productdetail);
//                        var found = 0;
//                        angular.forEach(products.productdetail, function(product) {
//                            $log.debug("productsService(): query(): productId", productId, "sku", product.sku);
//                            if (productId == product.sku) {
//                                returnedProducts.push(product);
//                                found = 1;
//                            }
//                        });
//                        if (!found) {
//                            failure({}, 404, headers, config);
//                        }
//                    });
//                    $log.debug("productsService(): query(): got products by ids", returnedProducts);
//                    success(returnedProducts, status, headers, config);
//                    return returnedProducts;
//                } else if (query.search != null) {
//                    var returnedProducts = new Array();
//                    $log.debug("productsService(): query(): search", query.search);
//                    angular.forEach(products.productdetail, function(product) {
//                        if (S(product.sku).toLowerCase().contains(S(query.search).toLowerCase()) || S(product.name).toLowerCase().contains(S(query.search).toLowerCase())) {
//                            returnedProducts.push(product);
//                        } else if (product.sku) {
//                            angular.forEach(product.productskus.productdetail, function(p) {
//                                if (S(p.sku).toLowerCase().contains(S(query.search).toLowerCase()) || S(p.name).toLowerCase().contains(S(query.search).toLowerCase())) {
//                                    p.parent = product;
//                                    returnedProducts.push(p);
//                                }
//                            });
//                        }
//                    });
//                    $log.debug("productsService(): query(): got products by search", returnedProducts);
//                    success(returnedProducts, status, headers, config);
//                    return returnedProducts;
//                } else {
//                    success(products.productdetail, status, headers, config);
//                    return products.productdetail;
//                }
//            }).error(function(data, status, headers, config) {
//                failure(data, status, headers, config);
//                $log.error(data, status, headers, config);
//            });
//        }

//        return productsService;
    })
    .factory('Categories', function ($resource, $http, $log, API_URL) {
        var categoriesService = {};

//        function findCategory(categories, id, recurse, parent) {
//            for (var i=0; i < categories.length; i++) {
//                var category = categories[i];
//                $log.debug("categoriesService(): id", category.id, "categoryId", id);
//                if (parent) {
//                    category.parentcategory = parent;
//                }
//                if (category.id == id) {
//                    $log.debug("categoriesService(): found category, returning!", category);
//                    return category;
//                } else if (recurse && Array.isArray(category.children)) {
//                    var c = findCategory(category.children, id, true, category);
//                    if (c != null) {
//                        return c;
//                    }
//                }
//            }
//            return null;
//        }

        function generateCategoryMap(categories) {
            //$log.debug("categoriesService(): generateCategoryMap()", categories);
            var idToCategoryMap = {};

            // create a map of all categories
            for (var i=0; i < categories.length; i++) {
                var category = categories[i];
                idToCategoryMap[category.id] = category;

                // traverse children
                if (category.children) {
                    var childMap = generateCategoryMap(category.children);
                    $.each(childMap, function(key, value) {
                        idToCategoryMap[key] = value;
                    });
                }
            }

            //$log.debug("categoriesService(): generateCategoryMap(): generated", idToCategoryMap);
            return idToCategoryMap;
        }

        function populateParentCategories(categories, idToCategoryMap) {
            //$log.debug("categoriesService(): populateParentCategories()", categories, idToCategoryMap);
            // create a map of all categories
            for (var i=0; i < categories.length; i++) {
                var category = categories[i];

                //$log.debug("categoriesService(): populateParentCategories(): processing category", category);

                // if we have a parent id, but not object, populate it
                if (category.parent && category.parentcategory == null) {
                    //$log.debug("categoriesService(): populateParentCategories(): setting parent!");
                    category.parentcategory = idToCategoryMap[category.parent];
                }

                // traverse children
                if (category.children) {
                    populateParentCategories(category.children, idToCategoryMap);
                }
            }
        }

        categoriesService.get = function(query, success, failure) {
            return $http.get(API_URL + '/categories/' + query.categoryId).success(function(data, status, headers, config) {
                $log.debug("categoriesService(): searching for category");
                //$log.debug(response.data);
                $log.debug("categoriesService(): query", query);

                var category = data;
                //console.log("categoriesService(): data returned", category);

                var categories = categoriesService.query({}, function(categories, headers) {
                    //$log.debug("categoriesService(): loaded categories to populate parents");

                    // populate parent categories
                    var idToCategoryMap = generateCategoryMap(categories);
                    populateParentCategories(categories, idToCategoryMap);
                    //$log.debug("categoriesService(): generated idToCategoryMap", idToCategoryMap);
                    populateParentCategories([category], idToCategoryMap);

                    $log.debug("categoriesService(): category", category);

                    success(category, status, headers);
                    return category;
                }, function() {
                    failure(data, status, headers, config);
                    $log.error(data, status, headers, config);
                })
            }).error(function(data, status, headers, config) {
                failure(data, status, headers, config);
                $log.error(data, status, headers, config);
            });
        }

        categoriesService.query = function(query, success, failure) {
            return $http.get(API_URL + '/categories').then(function(response) {
                //$log.debug(response.data);
                //var categories = $.xml2json(response.data);
                //categories = categories.categories;
                var categories = response.data;

                // populate parent categories
                var idToCategoryMap = generateCategoryMap(categories);
                populateParentCategories(categories, idToCategoryMap);

                $log.debug("categories", categories);
                success(categories, response.headers);
                return categories;
            }, function(response) {
                failure(response);
                $log.error(response);
            });
        }

        return categoriesService;
    })
    .factory('BreadcrumbsHelper', function($rootScope, $log) {
        var breadcrumbService       = {};

        if ($rootScope.breadcrumbs == null) {
            $rootScope.breadcrumbs = [];
        }

        var buildPath = function(category, product, list) {
            if (list == null && product != null) {
                list = new Array();
                $log.debug("breadcrumbService.buildPath(): setting path to product name", product.name);
                list.unshift({
                    type: 'product',
                    name: product.name,
                    id: product.id,
                    url: '/products/' + product.id,
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
                    url: '/products?category=' + category.id,
                    item: category
                });
                return buildPath(category.parentcategory, product, list);
            } else {
                $log.debug("breadcrumbService.buildPath(): returning current path", list);
            }
            return list;
        }

        breadcrumbService.setPath = function(category, product) {
            $log.debug("breadcrumbService.setPath()", category, product);
            if (category == null) {
                $log.debug("breadcrumbService.setPath(): removing breadcrumbs");
                $rootScope.breadcrumbs = new Array();
                return $rootScope.breadcrumbs;
            }

            var list = buildPath(category, product, null);

            $log.debug("breadcrumbService.setPath(): setting breadcrumbs", list);

            var newCrumbs = new Array();
            // always push home first
            newCrumbs.push({
                label: 'Our Products',
                type: 'none',
                path: '/'
            });

            angular.forEach(list, function(crumb) {
                var newCrumb = {
                    id: crumb.id,
                    type: crumb.type
                };
                newCrumb.label = crumb.name;
                if (crumb.type == 'category') {
                    newCrumb.path = '/products?category=' + crumb.id;
                } else if (crumb.type == 'product') {
                    newCrumb.path = '/products/' + crumb.id;
                }
                newCrumbs.push(newCrumb);
            });

            $log.debug("breadcrumbService.setPath(): setting new breadcrumbs", newCrumbs);
            $rootScope.breadcrumbs = newCrumbs;
            return newCrumbs;
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
                $log.debug("checking recently added against list", p.sku, product.sku );
                if (product.sku == p.sku) {
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
