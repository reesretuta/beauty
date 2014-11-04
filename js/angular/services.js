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
    .factory('Session', function($rootScope, $resource, $log, $location, $http, $cookieStore, $cookies, $timeout, $q, Consultants, API_URL, STORE_BASE_URL) {
        var sessionService = {};

        // load the session
        var initialized = $q.defer();

        function setLocalSession(session) {
            $rootScope.session = session;
        }

        function getLocalSession() {
            if ($rootScope.session == null) {
                $log.debug("sessionService(): initializing session");
                $rootScope.session = {
                    language: 'en_US',
                    cart: [],
                    checkout: {},
                    client: {}
                };

                // sanity data checks
                if (!Array.isArray($rootScope.session.cart)) {
                    $rootScope.session.cart = [];
                }
                if (typeof $rootScope.session.checkout == '') {
                    
                }
            }

            return $rootScope.session;
        }
        getLocalSession();

        function deleteLocalSession() {
            if ($rootScope.session != null) {
                delete $rootScope.session;
            }
        }

        sessionService.getLocalSession = getLocalSession;

        $rootScope.$on('loginSessionExpired', function (event, data) {
            $log.debug("session expired, cleaning up", event, data);

            var session = getLocalSession();

            if (session.client && session.client.id) {
                // remove local client
                deleteLocalSession();
                $log.debug("removing session cookie", $cookies["connect.sid"]);
                $cookieStore.remove("connect.sid");

                alert('You have been logged out due to inactivity');
                $location.path(STORE_BASE_URL).search();
                $log.error("session expired")
            }
        });

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

        sessionService.set = function(items) {
            var d = $q.defer();

            // once we're initialized
            initialized.promise.then(function() {
                $log.debug("sessionService(): set()", items);
                var session = getLocalSession();
                for (var key in items) {
                    if (items.hasOwnProperty(key)) {
                        session[key] = items[key];
                        $log.debug("sessionService(): set()", key, items[key]);
                    }
                }
                $log.debug("sessionService(): set()", session);
                return sessionService.save();
            }, function(err) {
                $log.error("sessionService(): save(): initialization failed", err);
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
                    d.reject(data);
                });
            });


            return d.promise;
        }

        var key = ["-----BEGIN PGP PUBLIC KEY BLOCK-----",
            "Version: GnuPG v1",
            "",
            "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",
            "YPxuUDQHu0aR58vdYj4E/LXBH4Y3Yw==",
            "=jeuV",
            "-----END PGP PUBLIC KEY BLOCK-----"];

        sessionService.createConsultant = function(consultant) {
            var d = $q.defer();

            initialized.promise.then(function(session) {
                $log.debug("Session(): createConsultant(): attempting to create consultant=", consultant.email);

                // do PGP encryption here
                require(["/lib/openpgp.min.js"], function(openpgp) {
                    var publicKey = openpgp.key.readArmored(key.join("\n"));
                    var consultantData = JSON.stringify(consultant);
                    var encrypted = openpgp.encryptMessage(publicKey.keys, consultantData);
                    encrypted = encrypted.trim();
                    $log.debug("consultant", consultantData);
                    $log.debug("encrypted consultant data", encrypted);

                    try {
                        Consultants.save({}, {
                            encrypted: encrypted
                        }).$promise.then(function(c) {
                            $log.debug("sessionService(): createConsultant(): created consultant");
                            d.resolve(c);
                        }, function(response) {
                            $log.error("sessionService(): createConsultant(): failed to create consultant", response.data);
                            d.reject(response.data);
                        });
                    } catch (ex) {
                        d.reject({
                            errorCode: 500,
                            message: "Failed to create order"
                        });
                    }
                });

            });


            return d.promise;
        }

        sessionService.lookupConsultant = function(ssn) {
            var d = $q.defer();

            initialized.promise.then(function(session) {
                $log.debug("sessionService(): lookupConsultant(): attempting to lookup consultant", ssn);

                // do PGP encryption here
                require(["/lib/openpgp.min.js"], function(openpgp) {
                    var publicKey = openpgp.key.readArmored(key.join("\n"));
                    var consultantData = JSON.stringify({
                        "ssn": ssn
                    });
                    var encrypted = openpgp.encryptMessage(publicKey.keys, consultantData);
                    encrypted = encrypted.trim();
                    $log.debug("sessionService(): lookupConsultant(): consultant ssn data", consultantData);
                    $log.debug("sessionService(): lookupConsultant(): encrypted consultant ssn", encrypted);

                    try {
                        Consultants.lookup(encrypted).then(function(c) {
                            $log.debug("sessionService(): lookupConsultant(): found consultant");
                            d.resolve(c);
                        }, function(error) {
                            $log.error("sessionService(): lookupConsultant(): failed to lookup consultant");
                            d.reject(error);
                        });
                    } catch (ex) {
                        $log.error("sessionService(): lookupConsultant(): failed to lookup consultant", ex);
                        d.reject({
                            errorCode: 500,
                            message: "Failed to lookup consultant"
                        });
                    }
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
            //$log.debug("sessionService(): getLanguage(): session", session);
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
                d.reject(error);
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

        cartService.getFirstProductSku = function() {
            var session = Session.getLocalSession();
            if (session.cart == null || session.cart.length == 0) {
                return null;
            }
            return session.cart[0].sku;
        }

        cartService.getItems = function() {
            var d = $q.defer();

            Session.get().then(function(session) {
                $log.debug("cartService().getItems(): loaded session with cart", session.cart);
                // load the project for the cart items
                cartService.loadProducts(session.cart).then(function(items) {
                    $log.debug("cartService().getItems(): loaded items from cart & populated products", items);

                    // filter out invalid cart items
                    var list = [];
                    for (var i=0; i < items.length; i++) {
                        var item = items[i];
                        if (item.sku) {
                            list.push(item);
                        } else {
                            $log.error("removing bad item from cart");
                        }
                    }

                    d.resolve(list);
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
            $log.debug("cartService(): addToCart(): adding", item);
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
                    name_es_US: item.name_es_US,
                    sku: item.sku,
                    kitSelections: item.kitSelections,
                    quantity: item.quantity,
                    contains: item.contains
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

                $.each(products, function(index, product) {
                    // FIXME - calculate the correct display price
                    Products.selectCurrentPrice(product);

                    // merge back in
                    if (itemMap[product.sku]) {
                        var item = itemMap[product.sku];
                        item.product = product;
                    }
                });

                $log.debug("cartService(): loadProducts(): returning items", items);
                d.resolve(items);
            }, function(error) {
                $log.debug("cartService(): loadProducts(): error loading products", error);
                d.reject(error);
            });

            return d.promise;
        };

        return cartService;
    })
    .factory('Geocodes', function ($resource, $http, $log, $q, API_URL) {
        return $resource(API_URL + '/geocodes', {});
    })
    .factory('Leads', function ($resource, $http, $log, $q, API_URL) {
        return $resource(API_URL + '/leads', {});
    })
    .factory('SalesTax', function ($resource, $http, $log, $q, API_URL) {
        var salesTaxService = {};

        salesTaxService.calculate = function(clientId, consultantId, geocode, typeOrder, source, products) {
            var d = $q.defer();

            //$log.debug("salesTaxService(): login(): attempting to login with username=", username, "password=", password);
            var session = $http.post(API_URL + '/calculateTax', {
                clientId: clientId,
                consultantId: consultantId,
                geocode: geocode,
                typeOrder: typeOrder,
                source: source,
                products: products
            }).success(function(salesTaxInfo, status, headers, config) {
                $log.debug("salesTaxService(): get()", salesTaxInfo);
                d.resolve(salesTaxInfo);
            }).error(function(data, status, headers, config) {
                //failure(data, status, headers, config);
                $log.error("salesTaxService(): get(): error", data, status);
                d.reject(data);
            });

            return d.promise;
        }

        return salesTaxService;
    })
    .factory('Products', function ($resource, $http, $log, $q, Categories, API_URL) {
        var productService = $resource(API_URL + '/products/:productId', {productId: '@_id'});
        var origQuery = productService.query;
        var origGet = productService.get;

        productService.query = function(params) {
            var d = $q.defer();

            $log.debug('productService(): query()', params);
            var ret = origQuery(params);

            ret.$promise.then(function(products) {
                $log.debug("productService(): get(): result", products);
                $.each(products, function(index, product) {
                    productService.selectCurrentPrice(product);
                });
                d.resolve(products);
            }, function(response) {
                $log.error("productService(): get(): failure", response.data);
                d.reject(response.data);
            });

            return d.promise;
        }

        productService.get = function(params) {
            var d = $q.defer();

            $log.debug('productService(): get()', params);
            var ret = origGet(params);

            ret.$promise.then(function(product) {
                $log.debug("productService(): get(): result", product);
                productService.selectCurrentPrice(product);
                d.resolve(product);
            }, function(response) {
                $log.error("productService(): get(): failure", response.data);
                d.reject(response.data);
            });

            return d.promise;
        }

        productService.selectCurrentPrice = function(product) {
            /**
             * {
                            "commissionableVolume" : 0,
                            "instantProfit" : 0,
                            "price" : 24,
                            "qualifyingVolume" : 0,
                            "rebate" : 0,
                            "retailVolume" : 0,
                            "shippingSurcharge" : 0,
                            "typeId" : 1,
                            "effectiveStartDate" : "2014-10-09T04:00:00.000Z",
                            "effectiveEndDate" : "2025-01-01T05:00:00Z",
                            "customerTypes" : [
                                "Non-Party Customer",
                                "Consultant",
                                "Party Guest",
                                "Hostess"
                            ]
                        }
             */
            var priceSelected = false;

            $.each(product.prices, function (index2, price) {
                $log.debug("cartService(): loadProducts(): processing price", price);
                var now = new Date().getTime();
                var start = S(price.effectiveStartDate).isEmpty() ? null : moment(price.effectiveStartDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').unix()*1000;
                var end = S(price.effectiveEndDate).isEmpty() ? null : moment(price.effectiveEndDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').unix()*1000;
                if ((now >= start || start == null) && (now <= end || end == null)) {
                    // this is our current price
                    $log.debug("cartService(): loadProducts(): setting price", price, "now", now, "start", start, "end", end);
                    product.currentPrice = price;
                    priceSelected = true;
                    return;
                }
            });

            $log.debug("cartService(): loadProducts(): priceSelected?", priceSelected, product.prices);
        }
        return productService;
    })
    .factory('Consultants', function ($resource, $http, $log, $q, API_URL) {
        var consultantService = $resource(API_URL + '/consultants/:consultantId', {consultantId: '@_id'});

        consultantService.lookup = function(encrypted) {
            $log.debug("consultantService(): lookup()", encrypted);
            var d = $q.defer();

            // lookup the consultant by SSN
            var a = $http.post(API_URL + '/consultants/lookup', {
                encrypted: encrypted
            }, {}).success(function(exists, status, headers, config) {
                $log.debug("consultantService(): lookup(): found", a);
                d.resolve(exists);
            }).error(function(data, status, headers, config) {
                $log.error("consultantService(): lookup(): error", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        return consultantService;
    })
    .factory('Addresses', function ($resource, $http, $log, $q, Session, API_URL) {
        var addressService = $resource(API_URL + '/clients/:clientId/addresses/:addressId', {addressId: '@_id'});

        addressService.validateAddress = function(address) {
            $log.debug("Address(): validateAddress(): validating", address);
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

                // preserve this
                a.businessCO = address.businessCO;

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
            addressService.save({clientId: clientId}, address).$promise.then(function(adjustedAddress) {
                $log.debug("adjustedAddressService(): addAddress(): saved address", adjustedAddress);

                // preserve this
                adjustedAddress.businessCO = address.businessCO;

                if (session.client.adjustedAddresses == null) {
                    session.client.adjustedAddresses = [];
                }

                session.client.adjustedAddresses.push(adjustedAddress);
                $log.debug("adjustedAddressService(): addAddress(): adding address to client address", session.client.adjustedAddresses);

                // update the session with the adjustedAddress information
                Session.save().then(function(session) {
                    $log.debug("adjustedAddressService(): addAddress(): saved address to session", session);
                    d.resolve(adjustedAddress);
                }, function() {
                    $log.error("adjustedAddressService(): addAddress(): failed to save address to session");
                    d.reject('Failed to update address in session');
                });
            }, function(response) {
                $log.error("adjustedAddressService(): addAddress(): failed to save address", response.data);
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

            }, function(response) {
                $log.error("addressService(): removeAddress(): failed to removed address from client addresses", response.data);
                d.reject('Failed to remove address');
            });

            return d.promise;
        }

        addressService.validateEmail = function(email) {
            $log.debug("Address(): validateEmail(): validating", email);
            var d = $q.defer();

            // validate the address first
            var a = $http.get(API_URL + '/validate/email?email='+email, {}).success(function(a, status, headers, config) {
                $log.debug("Address(): validateEmail(): validated", a);
                d.resolve(a);
            }).error(function(data, status, headers, config) {
                $log.error("Address(): validateEmail(): error", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        return addressService;
    })
    .factory('CreditCards', function ($resource, $http, $log, $q, Session, API_URL) {
        var creditCardService = $resource(API_URL + '/clients/:clientId/creditCards/:creditCardId', {creditCardId: '@_id'});

        var key = ["-----BEGIN PGP PUBLIC KEY BLOCK-----",
            "Version: GnuPG v1",
            "",
            "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",
            "YPxuUDQHu0aR58vdYj4E/LXBH4Y3Yw==",
            "=jeuV",
            "-----END PGP PUBLIC KEY BLOCK-----"];

        creditCardService.addCreditCard = function(creditCard) {
            $log.debug("addressService(): addCreditCard()");
            var d = $q.defer();

            var session = Session.getLocalSession();
            var clientId = session.client.id;

            // do PGP encryption here
            require(["/lib/openpgp.min.js"], function(openpgp) {
                var publicKey = openpgp.key.readArmored(key.join("\n"));
                var cardData = JSON.stringify(creditCard);
                var encrypted = openpgp.encryptMessage(publicKey.keys, cardData);
                encrypted = encrypted.trim();
                console.log("credit card data", cardData);
                console.log("encrypted credit card data", encrypted);

                creditCardService.save({clientId: clientId}, {
                    encrypted: encrypted
                }).$promise.then(function(cc) {
                    if (session.checkout.creditCards == null) {
                        session.checkout.creditCards = [];
                    }

                    // update local session, server will update the server session
                    session.client.creditCards.push(cc);
                    $log.debug("addressService(): addCreditCard(): adding credit card to client credit cards", session.client.creditCards);
                    d.resolve(creditCard);
                }, function(response) {
                    $log.error("addressService(): addCreditCard(): failed adding credit card to client credit cards", response.data);
                    d.reject('Failed to save creditCard');
                });
            });

            return d.promise;
        }

        creditCardService.validateCard = function(ccnumber) {
            if (!ccnumber) {
                return {
                    valid: false,
                    type: null
                };
            }
            ccnumber = ccnumber.toString().replace(/\s+/g, '');
            var len = ccnumber.length;
            var cardType = null, valid = false;
            var mul = 0,
                prodArr = [[0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [0, 2, 4, 6, 8, 1, 3, 5, 7, 9]],
                sum = 0;

            while (len--) {
                sum += prodArr[mul][parseInt(ccnumber.charAt(len), 10)];
                mul ^= 1;
            }

            if (sum % 10 === 0 && sum > 0) {
                valid = true
            }

            if(/^(34|37)/.test(ccnumber) && ccnumber.length == 15) {
                cardType = "American Express";
            }
            if(/^(62|88)/.test(ccnumber) && ccnumber.length >= 16  && ccnumber.length <= 19) {
                cardType = "China UnionPay";
            }
            if(/^30[0-5]/.test(ccnumber) && ccnumber.length == 14) {
                cardType = "Diners Club Carte Blanche";
            }
            if(/^(2014|2149)/.test(ccnumber) && ccnumber.length == 15) {
                cardType = "Diners Club enRoute";
            }
            if(/^(36|38|39|309)/.test(ccnumber) && ccnumber.length == 14) {
                cardType = "Diners Club International";
            }
            if(/^(6011|64[4-9]|65|622(1(2[6-9]|[3-9][0-9])|[2-8][0-9]{2}|9([01][0-9]|2[0-5])))/.test(ccnumber) && ccnumber.length == 16) {
                cardType = "Discover Card";
            }
            if(/^35(2[89]|[3-8][0-9])/.test(ccnumber) && ccnumber.length == 16) {
                cardType = "JCB";
            }
            if(/^(6304|6706|6771|6709)/.test(ccnumber) && ccnumber.length >= 16  && ccnumber.length <= 19) {
                cardType = "Laser";
            }
            if(/^(5018|5020|5038|5612|5893|6304|6759|6761|6762|6763|0604|6390)/.test(ccnumber) && ccnumber.length >= 12  && ccnumber.length <= 19) {
                cardType = "Maestro";
            }
            if(/^5[1-5]/.test(ccnumber) && ccnumber.length == 16) {
                cardType = "MasterCard";
            }
            if (/^4/.test(ccnumber) && (ccnumber.length == 13 || ccnumber.length == 16)) {
                cardType = "Visa"
            }
            if (/^(4026|417500|4405|4508|4844|4913|4917)/.test(ccnumber) && ccnumber.length == 16) {
                cardType = "Visa Electron"
            }
            if(/^500[0-9]/.test(ccnumber) && ccnumber.length == 16) {
                cardType = "BMO ABM Card";
            }

            return {
                valid: valid && ["Visa", "MasterCard", "American Express", "Discover Card", "BMO ABM Card"].indexOf(cardType) != -1,
                type: cardType
            }
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
            total += item.quantity * item.product.currentPrice.price;
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
              total += item.quantity * item.product.currentPrice.price;
            }
          }
        })

        return total;
      }

      return orderHelper;
    })
    .factory('focus', function ($rootScope, $timeout) {
        return function(name) {
            $timeout(function (){
                console.log('broadcast focus event', name);
                $rootScope.$broadcast('focusOn', name);
            });
        }
    })
    .constant('BASE_URL', '')
    .constant('STORE_BASE_URL', '/shop')
    .constant('JOIN_BASE_URL', '/join')
    .constant('API_URL', '/api');
