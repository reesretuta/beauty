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
    .factory('Search', function ($timeout, $location, $rootScope, $log, STORE_BASE_URL) {
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
//                if ($location.path() == STORE_BASE_URL + "/products") {
//                    $location.search("search", $rootScope.search.query);
//                } else {
//                    $location.url(STORE_BASE_URL + "/products");
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

            if ($location.path() == STORE_BASE_URL + "/products") {
                $location.search("search", $rootScope.search.query);
            } else {
                $location.url(STORE_BASE_URL + "/products");
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
    .factory('Session', function($rootScope, $resource, $log, $http, API_URL, $q) {
        var sessionService = {};

        // load the session
        var initialized = $q.defer();

        function setLocalSession(session) {
            $rootScope.session = session;
        }

        function getLocalSession() {
            if ($rootScope.session == null) {
                $rootScope.session = {
                    language: 'en_US',
                    cart: [],
                    checkout: {}
                };
            }

            return $rootScope.session;
        }

        function deleteLocalSession() {
            if ($rootScope.session != null) {
                delete $rootScope.session;
            }
        }

        sessionService.getLocalSession = getLocalSession;

        // used for initialization
        function getInternal() {
            $log.debug("sessionService(): getInternal()");

            var d = $q.defer();

            $http.get(API_URL + '/session', {}).success(function(session, status, headers, config) {
                $log.debug("sessionService(): getInternal(): loaded session", session);
                setLocalSession(session);
                d.resolve(session);
            }).error(function(data, status, headers, config) {
                $log.error(data, status, headers, config);
                d.reject(data);
            });

            return d.promise;
        }

        // waits for initialization before resolving promises
        sessionService.get = function() {
            $log.debug("sessionService(): get()");
            var d = $q.defer();
            initialized.promise.then(function() {
                getInternal().then(function(session) {
                    $log.debug("sessionService(): get(): returning session", session);
                    d.resolve(session);
                }, function(err) {
                    // initialize anyways, else we are stuck
                    $log.error("sessionService(): get(): error, failed to get session", err);
                    d.reject({});
                });
            });
            return d.promise;
        }

        // INITIALIZATION
        function initialize() {
            $log.debug("sessionService(): initialize()");

            getInternal().then(function(session) {
                $log.debug("sessionService(): initialize(): initialized session");
                initialized.resolve(session);
            }, function(err) {
                // initialize anyways, else we are stuck
                $log.error("sessionService(): initialize(): error initializing session", err);
                initialized.resolve({});
            });
        }
        initialize();

        sessionService.waitForInitialization = function() {
            var d = $q.defer();

            // once we're initialized
            initialized.promise.then(function(session) {
                d.resolve(session);
            }, function(err) {
                $log.error("sessionService(): save(): initialization failed");
                d.reject(err);
            });

            return d.promise;
        }

        sessionService.save = function() {
            var session = getLocalSession();
            $log.debug("sessionService(): save(): request save", session);
            var d = $q.defer();

            // once we're initialized
            initialized.promise.then(function() {
                var session = getLocalSession();
                $log.debug("sessionService(): save(): saving session", session);

                $http.put(API_URL + '/session', session, {}).success(function(data, status, headers, config) {
                    $log.debug("sessionService(): save(): saved", session);
                    //success(session, status, headers);
                    d.resolve(session);
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): save(): failed", data, status);
                    d.reject(data);
                });
            }, function(err) {
                $log.error("sessionService(): save(): initialization failed", err);
            });

            return d.promise;
        }

        sessionService.createClient = function(client) {
            var d = $q.defer();

            initialized.promise.then(function(session) {
                $log.debug("Session(): createClient(): attempting to create user username=", client.email);

                //$log.debug("Session(): login(): attempting to login with username=", username, "password=", password);
                var session = $http.post(API_URL + '/clients', {
                    email: client.email,
                    password: client.password,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    dateOfBirth: client.dateOfBirth,
                    consultantId: client.consultantId,
                    language: client.language
                }, {}).success(function(data, status, headers, config) {
                    $log.debug("sessionService(): createClient()", data.clientId);

                    sessionService.get().then(function(session) {
                        $log.debug("sessionService(): createClient(): loaded session");
                        d.resolve(session);
                    }, function(err) {
                        $log.error("sessionService(): createClient(): error loading session", err);
                        d.reject(err);
                    });
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): createClient(): error creating client", status, data);
                    $log.error(data, status, headers, config);
                    d.reject(data);
                });
            });

            return d.promise;
        }

        sessionService.login = function(username, password) {
            $rootScope.loginError = '';
            var d = $q.defer();

            initialized.promise.then(function(session) {
                //$log.debug("Session(): login(): attempting to login with username=", username, "password=", password);
                var session = $http.post(API_URL + '/authenticate', {username: username, password: password}, {}).success(function(session, status, headers, config) {
                    $log.debug("sessionService(): login()", session, status);
                    // update the session
                    setLocalSession(session);
                    $log.debug("sessionService(): login(): isLoggedIn()", sessionService.isLoggedIn());
                    //success(session, status, headers);
                    d.resolve(session);
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): login(): error", data, status);
                    d.reject(data);
                    $rootScope.loginError = data.message;
                });
            });

            return d.promise;
        }

        // pull from locally cached session
        sessionService.getLanguage = function() {
            var session = getLocalSession();
            return session.language;
        }

        sessionService.setLanguage = function(language) {
            var session = getLocalSession();
            session.language = language;

            initialized.promise.then(function() {
                sessionService.save().then(function() {
                    $log.debug("sessionService(): save(): saved session");
                }, function() {
                    $log.error("sessionService(): save(): failed to save session");
                });
            });
        }

        sessionService.isLoggedIn = function() {
            var session = getLocalSession();
            if (session.client && session.client.id) {
                return true;
            }
            //$log.debug("Session(): isLoggedIn(): ", session.authenticated);
            return false;
        }

        sessionService.getClient = function() {
            var session = getLocalSession();
            //$log.debug("Session(): getUser(): ", session.user);
            return session.client;
        }

        sessionService.getUser = sessionService.getClient;

        sessionService.logout = function() {
            var d = $q.defer();

            initialized.promise.then(function() {
                $log.debug("sessionService(): logout(): attempting to logout");
                $http.post(API_URL + '/logout', {}, {}).success(function(data, status, headers, config) {
                    $log.debug("sessionService(): logout()");

                    var sess = getLocalSession();
                    deleteLocalSession();

                    //// copy over cart
                    //var newSess = getLocalSession();
                    //newSess.cart = sess.cart;
                    //sessionService.save().then(function(session) {
                    //    d.resolve(session);
                    //});
                    //success({}, status, headers);
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error(data, status, headers, config);
                    d.reject(data);
                });
            });

            return d.promise;
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
    .factory('Checkout', function ($rootScope, $log, $q, Session) {
        var checkoutService = {};

        checkoutService.getLocalCheckout = function() {
            var session = Session.getLocalSession();
            return session.checkout;
        };

        checkoutService.getCheckout = function() {
            var d = $q.defer();

            Session.get().then(function(session) {
                d.resolve(session.checkout);
            }, function(error) {
                d.reject(error);
            });

            return d.promise;
        }

        checkoutService.setCheckout = function(checkout) {
            var d = $q.defer();

            var session = Session.getLocalSession();
            session.checkout = checkout;

            Session.save().then(function() {
                $log.debug("checkoutService(): setCheckout(): saved checkout to session");
                d.resolve(checkout);
            }, function(error) {
                $log.error("checkoutService(): setCheckout(): failed to save checkout to session");
                d.resolve(error);
            });

            return d.promise;
        };

        checkoutService.clear = function() {
            var d = $q.defer();

            Session.get().then(function(session) {
                $log.debug("checkoutService(): clear(): got session", session);
                session.checkout = {};

                Session.save().then(function(session) {
                    $log.debug("checkoutService(): clear(): cleared checkout from session", session.checkout);
                    d.resolve(session.checkout);
                }, function(error) {
                    $log.error("checkoutService(): clear(): failed to clear checkout from session");
                    d.reject(error);
                });
            }, function(error) {
                $log.error("checkoutService(): clear(): failed to get session for cart clearing");
            });

            return d.promise;
        }

        return checkoutService;
    })
    .factory('Cart', function ($rootScope, $log, $timeout, $q, STORE_BASE_URL, Session, Products, growlNotifications) {
        var cartService = {};

        function getLocalSessionCart() {
            var session = Session.getLocalSession();
            //$log.debug('cartService(): local session cart', session.cart);
            return session.cart;
        }

        function clearLocalSessionCart() {
            var session = Session.getLocalSession();
            session.cart = [];
        }

        cartService.getItemCount = function() {
            var cart = getLocalSessionCart();
            var count = 0;
            angular.forEach(cart, function(cartItem) {
                count += parseInt(cartItem.quantity);
            });

            //$log.debug("getItemCount()");
            return count;
        };

        cartService.getItems = function() {
            var d = $q.defer();

            Session.get().then(function(session) {
                $log.debug("cartService().getItems(): loaded session with cart", session.cart);
                // load the project for the cart items
                cartService.loadProducts(session.cart).then(function(items) {
                    $log.debug("cartService().getItems(): loaded items from cart & populated products", items);
                    d.resolve(items);
                }, function(error) {
                    $log.error("cartService().getItems(): failed to populated products", error);
                    d.reject(error);
                })
            }, function(error) {
                $log.error("cartService().getItems(): failed to get session to get cart items", error);
                d.reject(error);
            });

            return d.promise;
        };

        cartService.addToCart = function(item) {
            var d = $q.defer();

            $rootScope.adding = true;

            var cart = getLocalSessionCart();
            $log.debug("cartService(): addToCart()", cart, item);

            // check the cart for matching items, so we can update instead of add
            var updated = false;
            $.each(cart, function(index, cartItem) {
                //$log.debug("cartService(): addToCart(): comparing products", p, product);
                if (cartItem.sku == item.sku && item.kitSelections == null && cartItem.kitSelections == null) {
                    //$log.debug("cartService(): addToCart(): non-kit products are identical");
                    var newQty = parseInt(item.quantity) + parseInt(cartItem.quantity);
                    cartItem.quantity = newQty;
                    $log.debug("cartService(): addToCart(): added one more", item);
                    updated = true;
                    return true;
                }
            });

            if (!updated) {
                // we haven't updated the cart, so this is a new item to add
                $log.debug("cartService(): addToCart(): adding new item", item);
                cart.push({
                    name: item.name,
                    sku: item.sku,
                    kitSelections: item.kitSelections,
                    quantity: item.quantity
                });
            }

            // growlnotification when adding to cart
            growlNotifications.add('<i class="fa fa-shopping-cart"></i> '+item.name+' <a href="' + STORE_BASE_URL + '/cart"><b>added to cart</b></a>', 'warning', 4000);

            $log.debug("cartService(): addToCart(): saving cart to session", cart);

            var startTime = new Date().getTime();

            Session.save().then(function(session) {
                $log.debug("cartService(): addToCart(): saved cart to session", session);
                d.resolve(cart);

                if (new Date().getTime() - startTime < 1500) {
                    // wait until we've had 1500ms pass
                    $timeout(function() {
                        $rootScope.adding = false;
                        // set class
                        //$timeout(function() {
                        //    // remove check
                        //}, 2000);
                    }, 1500 - (new Date().getTime() - startTime));
                } else {
                    // > 1500 ms has passed, clear
                    $rootScope.adding = false;
                }
            }, function(error) {
                $log.error("cartService(): addToCart(): failed to save cart to session");
                d.reject(error);
            });

            return d.promise;
        };

        cartService.removeFromCart = function(item) {
            var d = $q.defer();

            var cart = getLocalSessionCart();
            angular.forEach(cart, function(cartItem) {
                // FIXME - if it's a kit, verify we remove the right kit configuration
                if (cartItem.sku == item.sku) {
                  var getIndex = cart.indexOf(cartItem);
                  cart.splice(getIndex, 1);
                }
            });

            $log.debug("cartService(): removeFromCart(): cart now", cart);
            $log.debug("cartService(): removeFromCart(): session now", Session.getLocalSession());

            $log.debug("cartService(): removeFromCart(): saving cart to session");

            Session.save().then(function() {
                $log.debug("cartService(): removeFromCart(): saved cart to session");
                d.resolve(cart);
            }, function(error) {
                $log.error("cartService(): removeFromCart(): failed to save cart to session");
                d.reject(error);
            });

            return d.promise;
        };

        cartService.clear = function() {
            var d = $q.defer();

            clearLocalSessionCart();
            $log.debug("cartService(): clear(): session now", Session.getLocalSession());

            Session.save().then(function(session) {
                $log.debug("cartService(): clear(): saved cart to session", session.cart);
                d.resolve(session.cart);
            }, function(error) {
                $log.error("cartService(): clear(): failed to save cart to session");
                d.reject(error);
            });

            return d.promise;
        };

        cartService.loadProducts = function(items) {
            var d = $q.defer();

            if (items == null || items.length == 0) {
                d.resolve([]);
                return d.promise;
            }
            var productIds = [];
            var itemMap = {};
            $.each(items, function(index, item) {
                productIds.push(item.sku);
                itemMap[item.sku] = item;
            });
            $log.debug("cartService(): loadProducts(): loading products", productIds);

            var p = Products.query({productIds: productIds});
            $log.debug("cartService(): loadProducts(): got promise", p);

            p.then(function(products) {
                $log.debug("cartService(): loadProducts(): loaded products", products);
                // merge back in quantities / kitGroupSelections
                $.each(products, function(index, product) {
                    if (itemMap[product.sku]) {
                        var item = itemMap[product.sku];
                        item.product = product;
                    }
                });
                d.resolve(items);
            }, function(error) {
                $log.debug("cartService(): loadProducts(): error loading products", error);
                d.reject(error);
            });

            return d.promise;
        };

        return cartService;
    })
    .factory('Products', function ($resource, $http, $log, $q, Categories, API_URL) {
        var productService = $resource(API_URL + '/products/:productId', {productId: '@_id'});
        var origQuery = productService.query;
        var origGet = productService.get;

        productService.query = function(params) {
            $log.debug('productService(): query()', params);
            var ret = origQuery(params);
            $log.debug('productService(): query()', params, ret);
            ret.$promise.then(function(val) {
                $log.debug("productService(): query(): result", val);
            });
            return ret.$promise;
        }

        productService.get = function(params) {
            $log.debug('productService(): get()', params);
            var ret = origGet(params);
            $log.debug('productService(): get()', params, ret);
            ret.$promise.then(function(val) {
                $log.debug("productService(): get(): result", val);
            });
            return ret.$promise;
        }

        return productService;
    })
    .factory('Consultants', function ($resource, $http, $log, API_URL) {
        return $resource(API_URL + '/consultants/:consultantId', {consultantId: '@_id'});
    })
    .factory('Addresses', function ($resource, $http, $log, $q, Session, API_URL) {
        var addressService = $resource(API_URL + '/clients/:clientId/addresses/:addressId', {addressId: '@_id'});

        addressService.validateAddress = function(address) {
            $log.debug("Address(): validateAddress(): saving", address);
            var d = $q.defer();

            // validate the address first
            var a = $http.post(API_URL + '/validate/address', {
                name: address.name,
                address1: address.address1,
                address2: address.address2,
                city: address.city,
                state: address.state,
                zip: address.zip,
                country: address.country,
                phone: address.phone
            }, {}).success(function(a, status, headers, config) {
                $log.debug("Address(): validateAddress(): validated, saving", a);
                d.resolve(a);
            }).error(function(data, status, headers, config) {
                $log.error("Address(): validateAddress(): validate()", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        addressService.addAddress = function(address) {
            $log.debug("Address(): addAddress(): saving", address);
            var d = $q.defer();

            var session = Session.getLocalSession();
            var clientId = session.client.id;

                // save the address
            addressService.save({clientId: clientId}, address).$promise.then(function(response) {
                var addressId = response.addressId;
                address.id = addressId;

                if (session.client.addresses == null) {
                    session.client.addresses = [];
                }

                session.client.addresses.push(address);
                $log.debug("addressService(): addAddress(): adding address to client addresses", session.client.addresses);

                // update the session with the address information
                Session.save().then(function(session) {
                    $log.debug("addressService(): addAddress(): saved address to session", session);
                    d.resolve(address);
                }, function() {
                    $log.error("addressService(): addAddress(): failed to save address to session");
                    d.reject('Failed to update address in session');
                });
            }, function(error) {
                d.reject('Failed to save address');
            });

            return d.promise;
        }

        addressService.removeAddress = function(addressId) {
            $log.debug("Address(): removeAddress(): removing", addressId);
            var d = $q.defer();

            var session = Session.getLocalSession();

            addressService.remove({clientId: session.client.id, addressId: addressId}).$promise.then(function(response) {
                // remove the address from the client data
                for (var i=0; i < session.client.addresses.length; i++) {
                    if (session.client.addresses[i].id == addressId) {
                        session.client.addresses = session.client.addresses.splice(i, 1);
                        break;
                    }
                }

                if (session.checkout && session.checkout.shipping && session.checkout.shipping.id == addressId) {
                    session.checkout.shipping = null;
                }
                if (session.checkout && session.checkout.billing && session.checkout.billing.id == addressId) {
                    session.checkout.billing = null;
                }

                $log.debug("addressService(): removeAddress(): removed address from client addresses", session.client.addresses);
                d.resolve();

            }, function(error) {
                d.reject('Failed to remove address');
            });

            return d.promise;
        }
        return addressService;
    })
    .factory('CreditCards', function ($resource, $http, $log, $q, Session, API_URL) {
        var creditCardService = $resource(API_URL + '/clients/:clientId/creditCards/:creditCardId', {creditCardId: '@_id'});

        creditCardService.addCreditCard = function(creditCard) {
            $log.debug("addressService(): addCreditCard()");
            var d = $q.defer();

            var session = Session.getLocalSession();
            var clientId = session.client.id;

            creditCardService.save({clientId: clientId}, creditCard).$promise.then(function(data) {
                if (session.checkout.creditCards == null) {
                    session.checkout.creditCards = [];
                }

                creditCard.id = data.creditCardId;
                session.client.creditCards.push(creditCard);
                $log.debug("addressService(): addCreditCard(): adding address to client credit cards", session.client.creditCards);

                // update the session with the creditCard information
                Session.save().then(function(session) {
                    $log.debug("creditCardService(): addCreditCard(): saved creditCard to session", session);
                    d.resolve(creditCard);
                }, function() {
                    $log.error("creditCardService(): addCreditCard(): failed to save creditCard to session");
                    d.reject('Failed to update creditCard in session');
                });
            }, function(error) {
                d.reject('Failed to save creditCard');
            });

            return d.promise;
        }

        return creditCardService;
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
        var recentlyViewedService = {};

        if ($rootScope.recentlyViewed == null) {
            $rootScope.recentlyViewed = {};
            $rootScope.recentlyViewed.items = new Array();
        }

        recentlyViewedService.getItems = function() {
            return $rootScope.recentlyViewed.items;
        };

        recentlyViewedService.addRecentlyViewed = function(p) {
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
        return recentlyViewedService;
    })
    .factory('OrderHelper', function ($rootScope, $log, growlNotifications) {
      var orderHelper = {};

      // get the total for a list of products
      orderHelper.getTotal = function(items) {
        var total = 0;
        angular.forEach(items, function(item) {
          //$log.debug("calculating price for item", item);
          if (!(Array.isArray(item.product.prices)) || item.product.prices.length == 1) {
            total += item.quantity * item.product.prices[0].price;
          } else if (item.product.prices.length == 0) {
            // there is a problem, we don't have prices
            $log.error("there are no prices listed for this item", item);
          } else {
            var priceFound = 0;
            angular.forEach(item.product.prices, function(price) {
              if (price.type==2) {
                priceFound = 1;
                total += item.quantity * price.price;
              }
            })
            if (!priceFound) {
              // use the first price in the list (FIXME - need to check dates))
              total += item.quantity * item.product.prices[0].price;
            }
          }
        })

        return total;
      }

      return orderHelper;
    })
    .constant('BASE_URL', '')
    .constant('STORE_BASE_URL', '/shop')
    .constant('JOIN_BASE_URL', '/join')
    .constant('API_URL', '/api');
