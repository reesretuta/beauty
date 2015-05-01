'use strict';

/* Services */

angular.module('app.services', ['ngResource'])
    .factory('Page', function($rootScope, $log) {
        var titleData = {
            title: null,
            product: null
        }
        return {
            setTitle : function(title) {
                $log.debug("setting title to", title);
                titleData.staticTitle = title;
            },
            setProductTitle : function(product) {

            },
            getTitle : function() {
                return $rootScope.title;
            }
        };
    })
    .factory('Search', function ($timeout, $location, $rootScope, $log, STORE_BASE_URL) {
        var searchService = {};

        var SEARCH_DELAY = 1000;

        $rootScope.search = {};
        $rootScope.search.query = '';

        searchService.search = function(query) {
            $log.debug("searching");
            $rootScope.search.query = query;

            if ($location.path() == STORE_BASE_URL + "/products") {
                $location.search("search", $rootScope.search.query);
            } else {
                $location.url(STORE_BASE_URL + "/products");
                if ($rootScope.search.query != null && $rootScope.search.query !== undefined) {
                    $location.search("search", $rootScope.search.query);
                    $log.debug("clearing search");
                }
            }
        };

        searchService.getQuery = function() {
            return $rootScope.search.query;
        };

        return searchService;
    })
    .factory('Session', function($rootScope, $resource, $log, $location, $http, $cookieStore, $cookies, $timeout, $q, $translate, API_URL, STORE_BASE_URL) {
        var sessionService = {};

        // promise that everything waits on before resolving
        var initialized = $q.defer();

        // track session dirty
        var dirty = false;

        $rootScope.session = {};

        // IN-MEMORY SESSION FUNCTIONS
        function setLocalSession(session) {
            $rootScope.session = session;
        }

        function getLocalSession() {
            return $rootScope.session;
        }

        function deleteLocalSession() {
            if ($rootScope.session != null) {
                if ($rootScope.session != null) {
                    $rootScope.session.cart = [];
                    $rootScope.session.client = null;
                    $rootScope.session.checkout = {};
                }
            }
        }

        // idle client reaches session timeout, log them out and redirect
        $rootScope.$on('loginSessionExpired', function (event, data) {
            $log.debug("sessionService(): session expired, cleaning up", event, data);

            var session = getLocalSession();

            if (session.client && session.client.id) {
                // remove local client
                deleteLocalSession();

                $log.debug("sessionService(): removing session cookie", $cookies["connect.sid"]);
                $cookieStore.remove("connect.sid");

                alert('You have been logged out due to inactivity');
                $location.path(STORE_BASE_URL).search();
                $log.error("sessionService(): session expired")
            }
        });

        //var sessionLastUpdated = null;
        //$rootScope.$on('LocalStorageModule.notification.setitem', function (event, data) {
        //    if (data.key == 'session') {
        //        // if the date is empty or doesn't equal out last timestamp update, then add timestamp
        //        if (data.value && (data.value.timestamp == null || data.value.timestamp != sessionLastUpdated)) {
        //            // session was updated, set a timestamp since we want to expire our localstorage
        //            data.value.timestamp = new Date().getTime();
        //
        //            // ensure this update doesn't trigger another update recursively
        //            sessionLastUpdated = data.value.timestamp;
        //            $log.debug("sessionService(): setting last session update time", sessionLastUpdated);
        //        }
        //    }
        //});

        // INITIALIZATION
        function initialize() {
            $log.debug("sessionService(): initialize(): loading session from server");

            getFromServer().then(function(session) {
                $log.debug("sessionService(): initialize(): got session", session);

                // copy over values from server session
                for (var key in session) {
                    if (session.hasOwnProperty(key)) {
                        $rootScope.session[key] = session[key];
                    }
                }

                $log.debug("sessionService(): initialize(): local session is", $rootScope.session);
                initialized.resolve($rootScope.session);
            }, function(error) {
                $log.error("sessionService(): initialize(): failed to initialize session", error);
                initialized.reject();
            });
        }
        initialize();

        // PUBLIC session functions
        sessionService.get = function() {
            $log.debug("sessionService(): get()");
            var d = $q.defer();
            initialized.promise.then(function() {
                d.resolve(getLocalSession());
            });
            return d.promise;
        }

        function getFromServer() {
            $log.debug("sessionService(): getFromServer()");
            var d = $q.defer();

            $http.get(API_URL + '/session', {}).success(function(session, status, headers, config) {
                $log.debug("sessionService(): getFromServer()", session);

                // use whatever is in the session for language, server defaults
                $translate.use(session.language);

                d.resolve(session);
            }).error(function(data, status, headers, config) {
                //failure(data, status, headers, config);
                $log.error("sessionService(): getFromServer(): error creating client", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        function saveToServer() {
            var d = $q.defer();

            initialized.promise.then(function() {
                $log.debug("Session(): saveToServer(): saving session");

                var session = getLocalSession();
                var trimmedSession = angular.copy(session);
                for (var i=0; i < trimmedSession.cart.length; i++) {
                    delete trimmedSession.cart[i].product;
                }

                $http.put(API_URL + '/session', trimmedSession).success(function(s, status, headers, config) {
                    $log.debug("sessionService(): saveToServer(): saved", s);

                    d.resolve(s);
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): saveToServer(): error saving session", status, data);
                    d.reject(data);
                });
            });

            return d.promise;
        }

        sessionService.save = function() {
            var d = $q.defer();
            saveToServer().then(function(session) {
                d.resolve(session);
            }, function(err) {
                d.reject(err);
            });
            return d.promise;
        }

        sessionService.waitForInitialization = function() {
            var d = $q.defer();

            // once we're initialized
            initialized.promise.then(function() {
                var session = getLocalSession;
                d.resolve(session);
            }, function(err) {
                $log.error("sessionService(): save(): initialization failed");
                d.reject(err);
            });

            return d.promise;
        }

        sessionService.set = function(a, b) {
            var numArgs = arguments.length;
            $log.debug("sessionService(): set()", a, b, numArgs);
            var d = $q.defer();

            // once we're initialized
            initialized.promise.then(function() {
                // copy over all properties
                if (numArgs == 1) {
                    var items = a;
                    $log.debug("sessionService(): set(): object", items);
                    var session = getLocalSession();
                    for (var key in items) {
                        if (items.hasOwnProperty(key)) {
                            session[key] = items[key];
                            $log.debug("sessionService(): set(): object", key, items[key]);
                        }
                    }

                    $log.debug("sessionService(): set(): key", session);

                // set one property
                } else {
                    $log.debug("sessionService(): set(): key", a, b);
                    var session = getLocalSession();
                    session[a] = b;
                    $log.debug("sessionService(): set(): key", session);
                }

                saveToServer().then(function(s) {
                    $log.debug("sessionService(): set(): saved to server", s);
                    d.resolve(session);
                }, function (err) {
                    $log.error("sessionService(): set(): initialization failed", err);
                    d.reject(err);
                });
            }, function(err) {
                $log.error("sessionService(): set(): initialization failed", err);
                d.reject(err);
            });

            return d.promise;
        }

        sessionService.createClient = function(client) {
            var d = $q.defer();
            initialized.promise.then(function() {
                $log.debug("Session(): createClient(): attempting to create user username=", client.email);
                $http.post(API_URL + '/clients', {
                    email: client.email,
                    password: client.password,
                    firstName: client.firstName,
                    lastName: client.lastName,
                    dateOfBirth: client.dateOfBirth,
                    consultantId: client.consultantId,
                    language: client.language
                }, {}).success(function(client, status, headers, config) {
                    $log.debug("sessionService(): createClient()", client);
                    var session = getLocalSession();
                    session.client = client;
                    d.resolve(session);
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): createClient(): error creating client", status, data);
                    d.reject(data);
                });
            });
            return d.promise;
        }

        sessionService.copy = function(sessionId) {
            var d = $q.defer();
            initialized.promise.then(function() {
                $log.debug("Session(): copy()", sessionId);

                $http.put(API_URL + '/sessionCopy', {
                    sessionId: sessionId
                }, {}).success(function(data, status, headers, config) {
                    $log.debug("sessionService(): copy()", data);
                    d.resolve();
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): copy(): error", status, data);
                    d.reject(data);
                });
            });
            return d.promise;
        }

        // is client already registered?
        sessionService.clientEmailAvailable = function(email, ignoreExists) {
            var d = $q.defer();
            initialized.promise.then(function() {
                if (ignoreExists) {
                    d.resolve(true);
                    return;
                }
                $log.debug('Session(): clientEmailAvailable(): attempting to lookup client by email', email);
                $http.get(API_URL + '/clients/' + email, {}).success(function(client, status, headers, config) {
                    $log.debug('sessionService(): clientEmailAvailable(): client exists, not available');
                    d.resolve(false);
                }).error(function(data, status, headers, config) {
                    if (status == 404) {
                        $log.debug('sessionService(): clientEmailAvailable(): client not found, available');
                        d.resolve(true);
                    } else {
                        $log.error('sessionService(): clientEmailAvailable(): error, not available', status, data);
                        d.reject(false);
                    }
                });
            });
            return d.promise;
        }

        // is consultant already registered?
        sessionService.consultantEmailAvailable = function(email, ignoreExists) {
            var d = $q.defer();
            initialized.promise.then(function() {
                if (ignoreExists) {
                    d.resolve(true);
                    return;
                }
                $log.debug('Session(): consultantEmailAvailable(): attempting to lookup client by email', email);
                $http.get(API_URL + '/consultants/' + email, {}).success(function(client, status, headers, config) {
                    $log.debug('sessionService(): lookupClient(): client exists, not available');
                    d.resolve(false);
                }).error(function(data, status, headers, config) {
                    if (status == 404) {
                        $log.debug('sessionService(): consultantEmailAvailable(): client not found, available');
                        d.resolve(true);
                    } else {
                        $log.error('sessionService(): consultantEmailAvailable(): error, not available', status, data);
                        d.reject(false);
                    }
                });
            });
            return d.promise;
        }

        sessionService.login = function(username, password) {
            $rootScope.loginError = '';
            var d = $q.defer();

            initialized.promise.then(function() {
                //$log.debug("Session(): login(): attempting to login with username=", username, "password=", password);
                $http.post(API_URL + '/authenticate', {username: username, password: password}, {}).success(function(session, status, headers, config) {
                    $log.debug("sessionService(): login()", session, status);

                    // update the session with client
                    var s = getLocalSession();
                    s.client = session.client;

                    $log.debug("sessionService(): login(), session now", s);
                    d.resolve(s);
                }).error(function(data, status, headers, config) {
                    //failure(data, status, headers, config);
                    $log.error("sessionService(): login(): error", data, status);
                    d.reject(data);
                    $translate('LOGIN-ERROR').then(function (message) {
                        $rootScope.loginError = message;
                    });
                });
            });

            return d.promise;
        };

        // TMP - waiting on JCS API. Once a client is authenticated, we want to request their ids an populate the info
        sessionService.populateConsultants = function (consultantIds) {
            var p, promise = $q.defer(), promises = [];
            if (!consultantIds || consultantIds.length === 0) {
                promise.resolve([]);
            } else {
                for (var i = 0; i < consultantIds.length; i++) {
                    p = $q.defer();

                    promises.push(p.promise);
                }
                 $q.all(promises).then(function (results) {
                    promise.resolve(results);
                 });
            }
            return promise.promise;
        };

        // pull from locally cached session
        sessionService.getLanguage = function() {
            var session = getLocalSession();
            //$log.debug("sessionService(): getLanguage(): session", session);
            if (session) {
                return session.language;
            } else {
                return "en_US";
            }
        }

        sessionService.setLanguage = function(language) {
            sessionService.set('language', language).then(function() {
                $log.debug("sessionService(): setLanguage(): language set");
                $translate.use(language);
                $rootScope.$broadcast('set_language');
            });
        }

        sessionService.getSource = function() {
            var session = getLocalSession();
            //$log.debug("sessionService(): getLanguage(): source", source);
            if (session) {
                return session.source;
            } else {
                return "web";
            }
        }

        sessionService.isLoggedIn = function() {
            var session = getLocalSession();
            var loggedIn = session.client != null && session.client.id;
            //$log.debug("Session(): isLoggedIn(): ", loggedIn);
            if (session.client != null && session.client.id) {
                return true;
            }
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
                    deleteLocalSession();

                    $log.debug("sessionService(): logout(): successful", getLocalSession());

                    initialize();
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
            if ($rootScope.session) {
                return $rootScope.session.checkout;
            }
            return {};
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
            $log.debug("checkoutService(): setCheckout()", checkout);
            var d = $q.defer();

            Session.set('checkout', checkout).then(function(session) {
                d.resolve(session.checkout);
            });

            return d.promise;
        };

        checkoutService.clear = function() {
            $log.debug("checkoutService(): clear()");
            var d = $q.defer();

            Session.set('checkout', {}).then(function(session) {
                $log.debug("checkoutService(): clear(): got session", session);
                d.resolve(session.checkout);
            }, function(error) {
                $log.error("checkoutService(): clear(): failed to get session for cart clearing");
                d.reject(error);
            });

            return d.promise;
        }

        return checkoutService;
    })

    .factory('Account', function($resource, $http, $translate, API_URL, $rootScope, $log, $q, Session){
        var accountService = $resource(API_URL + '/clients/:clientId', '', {
            update : { method:'POST' }
        });
        // update client data, exposed as Account.updateClient(client)
        accountService.updateClient = function(client) {
            var d = $q.defer();
            $log.debug('accountService(): updateClient(): attempting to update client:', client);
            Session.get().then(function (session) {
                if (!session.client) {
                    d.reject('Can\'t update client, client not authenticated');
                    return;
                }
                $log.debug('Account(): updateClient(): session.get(): session:', session);
                // if email hasnt changed, delete key/val pair
                if (session.client.email === client.email) {
                    delete client.email;
                }
                client.clientId = session.client.id;
                accountService.update({ 
                    clientId : session.client.id
                }, client).$promise.then(function (data) {
                    d.resolve(data);
                }, function(response) {
                    d.reject(response);
                });
            }, function(error) {
                $log.error('Account(): updateClient(): failed to update account profile: error:', error);
                $translate('ERROR-UPDATING-PROFILE').then(function (message) {
                    d.reject(message);
                });
            });     
            return d.promise;
        };

        
        
        return accountService;
        
    })

    .factory('Cart', function ($rootScope, $log, $timeout, $q, $translate, STORE_BASE_URL, Session, Product, growlNotifications) {
        var cartService = {};
        // fetch cart
        cartService.get = function(noLoadProducts) {
            var d = $q.defer();
            Session.get().then(function(session) {
                $log.debug('cartService(): getCart()', session.cart);
                if (noLoadProducts == null || noLoadProducts == false) {
                    $log.debug('cartService(): get(): loading products for cart', session.cart);
                    // load the project for the cart items
                    cartService.loadProducts(session.cart).then(function(products) {
                        $log.debug('cartService(): get(): loaded items from cart & populated products', products);
                        d.resolve(session.cart);
                    }, function(error) {
                        $log.error('cartService(): get(): failed to populate products', error);
                        d.reject(error);
                    })
                } else {
                    d.resolve(session.cart);
                }
            }, function(error) {
                $log.error('cartService(): get(): error', error);
                d.reject(error);
            });
            return d.promise;
        };

        // set cart obj
        cartService.set = function(cart) {
            $log.debug("cartService(): setCart()", cart);
            var d = $q.defer();

            if (cart == null || !Array.isArray(cart)) {
                d.reject('Cart must be an array');
            } else {
                Session.set('cart', cart).then(function(session) {
                    $log.debug("cartService(): setCart()");
                    d.resolve(session.cart);
                }, function(error) {
                    $log.error("cartService(): setCart(): error", error);
                    d.reject(error);
                });
            }

            return d.promise;
        };

        cartService.clear = function() {
            var d = $q.defer();

            Session.set('cart', []).then(function(session) {
                $log.debug("cartService(): clear(): got session", session);
                d.resolve(session.cart);
            }, function(error) {
                $log.error("cartService(): clear(): failed to get session for cart clearing");
                d.reject(error);
            });

            return d.promise;
        }
        
        cartService.getItemCount = function() {
            var d = $q.defer();
            $log.debug('Services: Cart: getItemCount init');
            // load cart without product fetching to get count
            var cart = cartService.get(true).then(function(cart) {
                var count = 0;
                angular.forEach(cart, function(cartItem) {
                    count += parseInt(cartItem.quantity);
                });
                $log.debug("cartService(): getItemCount()", count);
                d.resolve(count);
            }, function(error) {
                $log.error("cartService(): getItemCount(): error", error);
                d.reject(error);
            });
            return d.promise;
        };

        cartService.getFirstProductSku = function() {
            var d = $q.defer();

            var cart = cartService.get().then(function(cart) {
                $log.debug("cartService(): getFirstProductSku(): got cart", cart);
                if (cart == null || cart.length == 0 || cart[0] == null) {
                    return null;
                }
                d.resolve(cart[0].sku);
            }, function(error) {
                $log.error("cartService(): getFirstProductSku(): error", error);
                d.reject(error);
            });

            return d.promise;
        }

        cartService.addToCart = function(item) {
            $log.debug("cartService(): addToCart(): adding", item);
            var d = $q.defer();

            $rootScope.adding = true;
            $rootScope.addingId = item.sku;

            cartService.get(true).then(function(cart) {
                $log.debug("cartService(): addToCart()", cart, item);

                // check the cart for matching items, so we can update instead of add
                var updated = false;
                var errors = false;
                $.each(cart, function(index, cartItem) {
                    $log.debug("cartService(): addToCart(): comparing products", item, cartItem);
                    if (cartItem.sku == item.sku && (item.kitSelections == null || Object.keys(item.kitSelections).length==0) && (cartItem.kitSelections == null || Object.keys(cartItem.kitSelections).length==0)) {
                        //$log.debug("cartService(): addToCart(): non-kit products are identical");
                        var newQty = item.quantity + cartItem.quantity;
                        if (newQty <= 20) {
                            cartItem.quantity = newQty;
                            $log.debug("cartService(): addToCart(): added one more", item);
                            updated = true;
                            return true;
                        } else {
                            // show error here
                            $log.error("cartService(): addToCart(): error adding item, max quantity reached", item);
                            // growlnotification when adding to cart
                            growlNotifications.add('<i class="fa fa-shopping-cart"></i> Could not add ' + item.name + ' to cart', 'danger', 4000);
                            errors = true;
                            return true;
                        }
                    }
                });

                if (errors) {
                    $rootScope.adding = false;
                    $rootScope.addingId = null;
                    return;
                }

                if (!updated) {
                    // we haven't updated the cart, so this is a new item to add
                    $log.debug("cartService(): addToCart(): adding new item", item);
                    cart.push({
                        name: item.name,
                        name_es_US: item.name_es_US,
                        sku: item.sku,
                        images: item.images,
                        product: item,
                        kitSelections: item.kitSelections,
                        quantity: item.quantity,
                        contains: item.contains
                    });
                }

                // growlnotification when adding to cart
                $translate('ADDED-TO-CART').then(function (message) {
                    var productName = item[$rootScope.session.language=='en_US' ? 'name' : 'name_' + $rootScope.session.language];
                    growlNotifications.add('<i class="fa fa-shopping-cart"></i> '+ productName +' <a href="' + STORE_BASE_URL + '/cart"><b>' + message + '</b></a>', 'warning', 4000);
                });

                $log.debug("cartService(): addToCart(): saving cart to session", cart);

                Session.save().then(function(s) {
                    var startTime = new Date().getTime();

                    if (!updated) {
                        // load the products since there are now new items
                        cartService.loadProducts(cart).then(function(items) {
                            $log.debug("cartService(): get(): loaded items from cart & populated products", items);

                            d.resolve(cart);
                        }, function(error) {
                            $log.error("cartService(): get(): failed to populated products", error);
                            d.reject(error);
                        })
                    } else {
                        // just updated the cart, don't need to reload products
                        d.resolve(cart);
                    }

                    if (new Date().getTime() - startTime < 1500) {
                        // wait until we've had 1500ms pass
                        $timeout(function() {
                            $rootScope.adding = false;
                            $rootScope.addingId = null;
                            // set class
                            //$timeout(function() {
                            //    // remove check
                            //}, 2000);
                        }, 1500 - (new Date().getTime() - startTime));
                    } else {
                        // > 1500 ms has passed, clear
                        $rootScope.adding = false;
                        $rootScope.addingId = null;
                    }
                }, function(error) {
                    $log.error("cartService(): get(): failed to save cart to session", error);
                    d.reject(error);
                });
            }, function(error) {
                $log.error("cartService(): addToCart(): error", error);
                d.reject(error);
            });

            return d.promise;
        };

        cartService.removeFromCart = function(item) {
            var d = $q.defer();

            var cart = cartService.get().then(function(cart) {
                angular.forEach(cart, function(cartItem) {
                    // FIXME - if it's a kit, verify we remove the right kit configuration
                    if (cartItem.sku == item.sku) {
                        var getIndex = cart.indexOf(cartItem);
                        cart.splice(getIndex, 1);
                    }
                });

                Session.save().then(function(s) {
                    $log.debug("cartService(): removeFromCart(): cart now", cart);
                    d.resolve(cart);
                }, function(error) {
                    $log.error("cartService(): removeFromCart(): error", error);
                    d.reject(error);
                });
            }, function(error) {
                $log.error("cartService(): removeFromCart(): error", error);
                d.reject(error);
            });

            return d.promise;
        };

        cartService.loadProducts = function(items) {
            $log.debug("cartService(): loadProducts()", items);
            var d = $q.defer();

            if (items == null || items.length == 0) {
                d.resolve([]);
                return d.promise;
            }
            var productIds = [];
            $.each(items, function(index, item) {
                productIds.push(item.sku);
            });
            //$log.debug("cartService(): loadProducts(): loading products", productIds);

            var p = Product.query({productIds: productIds, loadStarterKits: true}).then(function(products) {
                $log.debug("cartService(): loadProducts(): loaded products", products);

                $.each(products, function(index, product) {
                    // find the right current price
                    if (product.type != 'group') {
                        Product.selectCurrentPrice(product);
                    }

                    // merge back in
                    $.each(items, function(index, item) {
                        if (item.sku == product.sku) {
                            item.product = product;
                        }
                    });
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
        var leadService = $resource(API_URL + '/leads', {});
        var origSave = leadService.save;
        leadService.save = function(params) {
            $log.debug('leadService(): save()', params);
            return origSave(params);
        }
        return leadService;
    })
    .factory('SalesTax', function ($resource, $http, $log, $q, API_URL) {
        var salesTaxService = {};

        salesTaxService.calculate = function(clientId, consultantId, geocode, typeOrder, source, products) {
            var d = $q.defer();

            var taxInfo = {
                clientId: clientId,
                consultantId: consultantId,
                geocode: geocode,
                typeOrder: typeOrder,
                source: source,
                products: products
            };
            $log.debug("salesTaxService(): calculate()", taxInfo);

            //$log.debug("salesTaxService(): login(): attempting to login with username=", username, "password=", password);
            $http.post(API_URL + '/calculateTax', taxInfo).success(function(salesTaxInfo, status, headers, config) {
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
    .factory('Product', function ($rootScope, $resource, $http, $log, $q, Categories, API_URL) {
        var productService = $resource(API_URL + '/products/:productId', {productId: '@_id'});
        var origQuery = productService.query;
        var origGet = productService.get;

        productService.query = function(params) {
            var d = $q.defer();

            $log.debug('productService(): query()', params);
            var ret = origQuery(params);

            ret.$promise.then(function(products) {
                $log.debug("productService(): query(): result", products);
                $.each(products, function(index, product) {
                    if (product.type != 'group') {
                        productService.selectCurrentPrice(product);
                    }
                    productService.selectCurrentPromotionalMessage(product);
                });
                d.resolve(products);
            }, function(error) {
                $log.error("productService(): query(): failure", error);
                d.reject(error);
            });

            return d.promise;
        }

        productService.get = function(params) {
            var d = $q.defer();

            $log.debug('productService(): get()', params);
            var ret = origGet(params);

            ret.$promise.then(function(product) {
                $log.debug("productService(): get(): result", product);
                if (product.type != 'group') {
                    productService.selectCurrentPrice(product);
                }
                productService.selectCurrentPromotionalMessage(product);
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

            if (Array.isArray(product.prices)) {
                $.each(product.prices, function (index2, price) {
                    $log.debug("cartService(): loadProducts(): processing price", price);
                    var now = new Date().getTime();
                    var start = S(price.effectiveStartDate).isEmpty() ? null : moment(price.effectiveStartDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').unix()*1000;
                    var end = S(price.effectiveEndDate).isEmpty() ? null : moment(price.effectiveEndDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').unix()*1000;
                    if ((now >= start || start == null) && (now <= end || end == null)) {
                        // this is our current price
                        $log.debug("cartService(): selectCurrentPrice(): setting price", price, "now", now, "start", start, "end", end);
                        product.currentPrice = price;
                        priceSelected = true;
                        return;
                    }
                });

                $log.debug("cartService(): loadProducts(): priceSelected?", priceSelected, product.prices);
            } else {
                $log.warn("cartService(): loadProducts(): priceSelected? no prices found");
            }
        }

        productService.selectCurrentPromotionalMessage = function(product) {
            if (Array.isArray(product.promotionalMessages)) {
                $log.debug("processing promotional messages for product", product.sku, product.promotionalMessages);
                $.each(product.promotionalMessages, function (index2, promotionalMessage) {
                    var now = new Date().getTime();
                    var start = S(promotionalMessage.startDate).isEmpty() ? null : moment(promotionalMessage.startDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').unix()*1000;
                    var end = S(promotionalMessage.endDate).isEmpty() ? null : moment(promotionalMessage.endDate, 'YYYY-MM-DDTHH:mm:ss.SSSZ').unix()*1000;
                    if ((now >= start || start == null) && (now <= end || end == null) && promotionalMessage != null) {
                        // this is our current price
                        $log.error("setting current promotional message", product.sku, promotionalMessage);
                        if (!product.currentPromotionalMessage) {
                            var en = promotionalMessage.message;
                            if (en) {
                                en = en.replace(/#([0-9]+)/, "<a href='/shop/products/$1'>$1</a>");
                            }
                            var es = promotionalMessage.message_es_US;
                            if (es) {
                                es = es.replace(/#([0-9]+)/, "<a href='/shop/products/$1'>$1</a>");
                            }
                            product.currentPromotionalMessage = {
                                message: en,
                                message_es_US: es
                            };
                        } else {
                            // looks like we might need to merge a second item with overlapping range...likely diff language
                            if (promotionalMessage.message_es_US && product.currentPromotionalMessage.message_es_US == null) {
                                var p = promotionalMessage.message_es_US;
                                if (p) {
                                    p = p.replace(/#([0-9]+)/, "<a href='/shop/products/$1'>$1</a>");
                                }
                                product.currentPromotionalMessage.message_es_US = p;
                            } else if (promotionalMessage.message && product.currentPromotionalMessage.message == null) {
                                var p = promotionalMessage.message;
                                if (p) {
                                    p = p.replace(/#([0-9]+)/, "<a href='/shop/products/$1'>$1</a>");
                                }
                                product.currentPromotionalMessage.message = p;
                            }
                        }
                        return;
                    }
                });
            }
        }

        productService.getTranslated = function(product) {
            if (product == null) {
                return {
                    name: null,
                    description: null,
                    usage: null,
                    ingredients: null,
                    quantity: null
                };
            }
            return {
                name: product[$rootScope.session.language=='en_US'?'name':'name_'+$rootScope.session.language],
                description: product[$rootScope.session.language=='en_US'?'description':'description_'+$rootScope.session.language],
                usage: product[$rootScope.session.language=='en_US'?'usage':'usage_'+$rootScope.session.language],
                ingredients: product[$rootScope.session.language=='en_US'?'ingredients':'ingredients_'+$rootScope.session.language],
                quantity: product[$rootScope.session.language=='en_US'?'quantity':'quantity_'+$rootScope.session.language]
            };
        }

        productService.getTranslatedPromoMessage = function(product) {
            if (product == null || product.currentPromotionalMessage == null) {
                return null;
            }
            //console.log(product.currentPromotionalMessage, product.currentPromotionalMessage.message, product.currentPromotionalMessage.message_es_US);
            return product.currentPromotionalMessage[$rootScope.session.language=='en_US'?'message':'message_'+$rootScope.session.language];
        }

        return productService;
    })
    .factory('Consultant', function ($resource, $http, $log, $q, $translate, Session, Cart, PGP, API_URL) {
        var consultantService = $resource(API_URL + '/consultants/:consultantId', {consultantId: '@_id'});

        var key = PGP.getKey();

        consultantService.lookup = function(ssn) {
            var d = $q.defer();

            Session.waitForInitialization().then(function() {
                $log.debug("consultantService(): lookup(): attempting to lookup consultant", ssn);

                // do PGP encryption here
                require(["/lib/openpgp.min.js"], function(openpgp) {
                    var publicKey = openpgp.key.readArmored(key.join("\n"));
                    var consultantData = JSON.stringify({
                        "ssn": ssn
                    });
                    var encrypted = openpgp.encryptMessage(publicKey.keys, consultantData);
                    encrypted = encrypted.trim();
                    $log.debug("consultantService(): lookup(): consultant ssn data", consultantData);
                    $log.debug("consultantService(): lookup(): encrypted consultant ssn", encrypted);

                    try {
                        // lookup the consultant by SSN
                        var a = $http.post(API_URL + '/consultants/lookup', {
                            encrypted: encrypted
                        }, {}).success(function(data, status, headers, config) {
                            $log.debug("consultantService(): lookup(): found", data);
                            d.resolve(data);
                        }).error(function(data, status, headers, config) {
                            $log.error("consultantService(): lookup(): error", status, data);
                            d.reject(data);
                        });
                    } catch (ex) {
                        $log.error("consultantService(): lookup(): failed to lookup consultant", ex);

                        $translate('CONSULTANT-NOT-FOUND').then(function (message) {
                            d.reject({
                                errorCode: 500,
                                message: message
                            });
                        });
                    }
                });

            });
            return d.promise;
        };
        
        consultantService.create = function(consultant) {
            var d = $q.defer();

            Session.waitForInitialization().then(function() {
                $log.debug("Session(): create(): attempting to create consultant=", consultant.email);

                // do PGP encryption here
                require(["/lib/openpgp.min.js"], function(openpgp) {
                    var publicKey = openpgp.key.readArmored(key.join("\n"));
                    var consultantData = JSON.stringify(consultant);
                    var encrypted = openpgp.encryptMessage(publicKey.keys, consultantData);
                    encrypted = encrypted.trim();
                    // $log.debug("consultant", consultantData);
                    // $log.debug("encrypted consultant data", encrypted);

                    try {
                        consultantService.save({}, {
                            encrypted: encrypted
                        }).$promise.then(function(c) {
                            $log.debug("sessionService(): create(): created consultant");

                            // remove the items from cart
                            Cart.clear().then(function() {
                                $log.debug("sessionService(): create(): cleared cart");
                                d.resolve(c);
                            }, function(err) {
                                $log.error("sessionService(): create(): failed to clear cart");
                                d.resolve(c);
                            });
                        }, function(response) {
                            $log.error("sessionService(): create(): failed to create consultant", response.data);
                            d.reject(response.data);
                        });
                    } catch (ex) {
                        $translate('ORDER-PROBLEM').then(function (message) {
                            d.reject({
                                errorCode: 500,
                                message: message
                            });
                        });
                    }
                });

            });


            return d.promise;
        }

        return consultantService;
    })
    .factory('Order', function ($resource, $http, $rootScope, $log, $q, $translate, Session, Cart, PGP, API_URL) {
        var orderService = $resource(API_URL + '/orders/:orderId', {orderId: '@_id'});

        var key = PGP.getKey();

        orderService.create = function(order) {
            var d = $q.defer();

            $log.debug("Order(): create(): attempting to create order=", order);

            try{
                orderService.save({}, order).$promise.then(function(savedOrder) {
                    order.id = savedOrder.orderId;
                    order.orderId = savedOrder.orderId;
                    $log.debug("sessionService(): create(): created order", savedOrder, order);

                    // update the session
                    var session = $rootScope.session;
                    session.client.lastUsedCreditCardId = order.creditCardId;
                    session.client.lastUsedShippingAddressId = order.shippingAddressId;
                    session.client.lastUsedBillingAddressId = order.billingAddressId;
                    session.client.lastUsedConsultantId = order.consultantId;

                    $log.debug("sessionService(): create(): session now", session);

                    // remove the items from cart
                    Cart.clear().then(function() {
                        $log.debug("sessionService(): create(): cleared cart");
                        d.resolve(order);
                    }, function(err) {
                        $log.error("sessionService(): create(): failed to clear cart");
                        d.resolve(order);
                    });
                }, function(response) {
                    $log.error("sessionService(): create(): failed to create order", response.data);
                    d.reject(response.data);
                });
            } catch (ex) {
                $translate('ORDER-PROBLEM').then(function (message) {
                    d.reject({
                        errorCode: 500,
                        message: message
                    });
                });
            }

            return d.promise;
        }

        orderService.getHistory = function() {
            var d = $q.defer();
            $log.debug("Order(): getHistory(): attempting to get order history");
            try {
                var a = $http.get(API_URL + '/orderHistory', {}).success(function(orderHistory, status, headers, config) {
                    $log.debug("Order(): getHistory(): done");
                    d.resolve(orderHistory);
                }).error(function(data, status, headers, config) {
                    $log.error("Order(): getHistory(): error", status, data);
                    d.reject(data);
                });
            } catch (ex) {
                $translate('ORDER-HISTORY-PROBLEM').then(function (message) {
                    d.reject({
                        errorCode: 500,
                        message: message
                    });
                });
            }

            return d.promise;
        }

        return orderService;
    })
    .factory('Addresses', function ($resource, $http, $log, $q, $translate, Session, Geocodes, API_URL, $modal, $document) {
        var addressService = $resource(API_URL + '/clients/:clientId/addresses/:addressId', {addressId: '@id'}, {
            'update': { method:'PUT' }
        });

        addressService.validateAddress = function(address) {
            var d = $q.defer();

            if (address.state != "PR" && address.state != "VI") {
                $log.debug("Address(): validateAddress(): validating", address);
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
                    a.id = address.id;
                    a.businessCO = address.businessCO;

                    d.resolve(a);
                }).error(function(data, status, headers, config) {
                    $log.error("Address(): validateAddress(): error", status, data);
                    d.reject(data);
                });
            } else {
                $log.debug("Address(): validateAddress(): skipping validation for PR/VI");
                d.resolve(address);
            }

            return d.promise;
        }

        addressService.addAddress = function(address) {
            $log.debug("Address(): addAddress(): saving", address);
            var d = $q.defer();

            Session.get().then(function(session) {
                if (session.client == null) {
                    d.reject("Can't add address, client not authenticated");
                    return;
                }

                var clientId = session.client.id;

                // save the address
                addressService.save({clientId: clientId}, address).$promise.then(function(a) {
                    $log.debug("adjustedAddressService(): addAddress(): saved address", a);

                    // preserve this
                    a.businessCO = address.businessCO;

                    if (session.client.addresses == null) {
                        session.client.addresses = [];
                    }

                    session.client.addresses.push(a);
                    $log.debug("adjustedAddressService(): addAddress(): adding address to client address", session.client.addresses);
                    d.resolve(a);
                }, function(response) {
                    $log.error("adjustedAddressService(): addAddress(): failed to save address", response.data);
                    $translate('ERROR-SAVING-ADDRESS').then(function (message) {
                        d.reject(message);
                    });
                });
            }, function(error) {
                $log.error("adjustedAddressService(): addAddress(): failed to save address", error);
                $translate('ERROR-SAVING-ADDRESS').then(function (message) {
                    d.reject(message);
                });
            });

            return d.promise;
        }

        addressService.updateAddress = function(address) {
            $log.debug("Address(): updateAddress(): saving", address);
            var d = $q.defer();

            Session.get().then(function(session) {
                if (session.client == null) {
                    d.reject("Can't update address, client not authenticated");
                    return;
                }

                var clientId = session.client.id;

                // save the address
                addressService.update({clientId: clientId, addressId: address.id}, address).$promise.then(function() {
                    $log.debug("adjustedAddressService(): updateAddress(): updated address");

                    if (session.client.addresses == null) {
                        session.client.addresses = [];
                    }

                    // update the session address
                    for (var i=0; i < session.client.addresses.length; i++) {
                        if (session.client.addresses[i].id == address.id) {
                            session.client.addresses[i] = address;
                            break;
                        }
                    }

                    $log.debug("adjustedAddressService(): updateAddress(): updated address to client address", session.client.addresses);
                    d.resolve(address);
                }, function(response) {
                    $log.error("adjustedAddressService(): updateAddress(): failed to update address", response.data);
                    $translate('ERROR-SAVING-ADDRESS').then(function (message) {
                        d.reject(message);
                    });
                });
            }, function(error) {
                $log.error("adjustedAddressService(): updateAddress(): failed to update address", error);
                $translate('ERROR-SAVING-ADDRESS').then(function (message) {
                    d.reject(message);
                });
            });

            return d.promise;
        }
        
        addressService.removeAddress = function(addressId) {
            $log.debug("Address(): removeAddress(): removing", addressId);
            var d = $q.defer();

            var session = Session.get().then(function(session) {
                addressService.remove({clientId: session.client.id, addressId: addressId}).$promise.then(function(response) {
                    // remove the address from the client data
                    for (var i=0; i < session.client.addresses.length; i++) {
                        if (session.client.addresses[i].id == addressId) {
                            session.client.addresses.splice(i, 1);
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
                    $translate('ERROR-REMOVING-ADDRESS').then(function (message) {
                        d.reject(message);
                    });
                });
            }, function(error) {
                $log.error("addressService(): removeAddress(): failed to removed address from client addresses", error);
                $translate('ERROR-REMOVING-ADDRESS').then(function (message) {
                    d.reject(message);
                });
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

        function addressesEqual(a, b) {
            if (!addressFieldsEqual(a.address1, b.address1) ||
                !addressFieldsEqual(a.address2, b.address2) ||
                !addressFieldsEqual(a.city, b.city) ||
                !addressFieldsEqual(a.state, b.state) ||
                !addressFieldsEqual(a.zip, b.zip))
            {
                $log.debug("addressService(): addressesEqual(): false", a, b);
                return false;
            }

            $log.debug("addressService(): addressesEqual(): true", a, b);
            return true;
        }

        function showAddressCorrectionModal(address) {
            var dd = $q.defer();
            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "addressCorrectionModal",
                templateUrl: '/partials/checkout/address-correction-modal.html',
                controller: 'AddressCorrectionModalController',
                resolve: {
                    address: function() {
                        return angular.copy(address);
                    }
                }
            });
            var body = $document.find('html, body');
            d.result.then(function(result) {
                $log.debug("addressService(): showAddressCorrectionModal(): address correction modal closed");
                body.css("overflow-y", "auto");
                dd.resolve(result);
            });
            $("html, body").css("overflow-y", "hidden");
            return dd.promise;
        }

        function selectGeocodeModal(geocodes) {
            var dd = $q.defer();

            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "selectGeocodeModal",
                templateUrl: '/partials/checkout/tax-selection-modal.html',
                controller: 'TaxSelectionModalController',
                resolve: {
                    geocodes: function() {
                        return geocodes;
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(result) {
                $log.debug("addressService(): selectGeocodeModal(): select geocode modal closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                dd.resolve(result);
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");

            return dd.promise;
        }

        addressService.selectGeocodeAndAdd = function(a, dontSave) {
            $log.debug("addressService(): selectGeocodeAndAdd()", a);
            var d = $q.defer();

            // check the zip for geocode for taxes
            Geocodes.query({zipCode: a.zip}).$promise.then(function(geocodes) {
                $log.debug("addressService(): selectGeocodeAndAdd(): got geocodes", geocodes);
                // close any previous modals (e.g. address edit from review page)
                angular.element('.modal').modal('hide');
                // see if we have any exact matches
                var matchedGeocode = null;
                for (var i=0; i < geocodes.length; i++) {
                    var zip = geocodes[i].ZIPCODE;
                    var city = geocodes[i].CITYDES;

                    if (a.zip == zip && a.city != null && a.city.toUpperCase() == city) {
                        matchedGeocode = geocodes[i];
                    }
                }
                if (geocodes.length == 1) {
                    $log.debug("addressService(): selectGeocodeAndAdd(): selecting only geocode returned");
                    a.geocode = geocodes[0].GEOCODE;
                    if (dontSave) {
                        d.resolve(a);
                    } else {
                        addressService.saveOrUpdateAddress(a).then(function(aa) {
                            d.resolve(aa);
                        }, function(error) {
                            d.reject(error);
                        });
                    }
                } else if (matchedGeocode) {
                    $log.debug("addressService(): selectGeocodeAndAdd(): selecting exact match geocode");
                    a.geocode = matchedGeocode.GEOCODE;
                    if (dontSave) {
                        d.resolve(a);
                    } else {
                        addressService.saveOrUpdateAddress(a).then(function(aa) {
                            d.resolve(aa);
                        }, function(error) {
                            d.reject(error);
                        });
                    }
                } else {
                    // display a dialog for the user to choose the correct geocode here
                    selectGeocodeModal(geocodes).then(function(result) {
                        $log.debug("addressService(): selectGeocodeAndAdd(): geocode selection dialog closed", result);

                        var geocode = result.geocode;
                        var canceled = result.canceled;

                        if (canceled) {
                            $log.error("addressService(): selectGeocodeAndAdd(): geocode selection dialog canceled");
                            $translate('MUST-SELECT-ADDRESS').then(function (message) {
                                d.reject(message);
                            });
                        } else if (geocode) {
                            a.geocode = geocode.GEOCODE;

                            if (a.city.toUpperCase() != geocode.CITYDES && geocode.CITYDES) {
                                a.city = geocode.CITYDES;
                            }

                            if (dontSave) {
                                d.resolve(a);
                            } else {
                                addressService.saveOrUpdateAddress(a).then(function(aa) {
                                    d.resolve(aa);
                                }, function(error) {
                                    d.reject(error);
                                });
                            }
                        } else {
                            $log.error("addressService(): selectGeocodeAndAdd(): empty geocode");
                            $translate('UNABLE-TO-VERIFY-ADDRESS').then(function (message) {
                                d.reject(message);
                            });
                        }
                    }, function(err) {
                        $log.error("addressService(): selectGeocodeAndAdd(): failed to select geocode", err);
                        $translate('UNABLE-TO-VERIFY-ADDRESS').then(function (message) {
                            d.reject(message);
                        });
                    });
                }
            }, function (r) {
                $log.error("addressService(): selectGeocodeAndAdd(): error looking up geocode", r);
                $translate('UNABLE-TO-VERIFY-ADDRESS').then(function (message) {
                    d.reject(message);
                });
            });

            return d.promise;
        }

        function addressFieldsEqual(field1, field2) {
            var f1 = field1 == null ? "" : field1.trim().toUpperCase();
            var f2 = field2 == null ? "" : field2.trim().toUpperCase();

            $log.debug("addressService(): addressFieldsEqual(): comparing", f1, f2);
            if (f1 == f2) {
                return true;
            }
            return false;
        }

        addressService.saveOrUpdateAddress = function(a) {
            $log.debug("addressService(): addAddressToBackend()", a);
            var d = $q.defer();

            $log.debug("addressService(): addAddressToBackend(): adding address", a);
            // client direct, we add it
            if (a.id) {
                addressService.updateAddress(a).then(function(a) {
                    $log.debug("addressService(): addAddressToBackend(): address updated", a);
                    d.resolve(a);
                }, function(error) {
                    $log.error("addressService(): addAddressToBackend(): failed to update address", error);
                    d.reject(error);
                });
            } else {
                addressService.addAddress(a).then(function(a) {
                    $log.debug("addressService(): addAddressToBackend(): address added", a);
                    d.resolve(a);
                }, function(error) {
                    $log.error("addressService(): addAddressToBackend(): failed to add address", error);
                    d.reject(error);
                });
            }
            return d.promise;
        }

        addressService.addAddressWithChecks = function(address, dontSave) {
            var d = $q.defer();
            $log.debug("addressService(): addAddressWithChecks()", address);

            addressService.validateAddress(address).then(function(a) {
                $log.debug("addressService(): addAddressWithChecks(): validated address", a);
                // if this address was validated and corrected, then we need to inform the user
                if (!addressesEqual(address, a)) {
                    showAddressCorrectionModal(a).then(function(result) {
                        var address = result.address;
                        var canceled = result.canceled;
                        $log.debug("addressService(): addAddressWithChecks(): address correction modal closed", address);
                        if (canceled) {
                            $log.debug("addressService(): addAddressWithChecks(): address correction canceled");
                            d.reject("Address correction canceled");
                            d.reject({
                                message: error,
                                errorCode: 'addressCorrectionCanceled'
                            });
                            return;
                        }

                        addressService.selectGeocodeAndAdd(address, dontSave).then(function(aa) {
                            $log.debug("addressService(): addAddressWithChecks(): selected geocode and added address", aa);
                            d.resolve(aa);
                        }, function(error) {
                            $log.error("addressService(): addAddressWithChecks(): select geocode and add failed", error);
                            d.reject({
                                message: error,
                                errorCode: 'geocodeSelectionFailed'
                            });
                        });
                    }, function(error) {
                        $log.error("addressService(): addAddressWithChecks(): address not corrected");
                        d.reject({
                            message: error,
                            errorCode: 'addressCorrectionFailed'
                        });
                    });
                } else {
                    addressService.selectGeocodeAndAdd(a, dontSave).then(function(aa) {
                        $log.debug("addressService(): addAddressWithChecks(): selected geocode and added address", aa);
                        d.resolve(aa);
                    }, function(err) {
                        $log.debug("addressService(): addAddressWithChecks(): select geocode and add failed", err);
                        d.reject({
                            message: err,
                            errorCode: 'geocodeSelectionFailed'
                        });
                    });
                }
            }, function(r) {
                $log.error("addressService(): addAddressWithChecks(): error validating address", r);
                d.reject(r); // validateAddressFailed
            });
            return d.promise;
        }

        return addressService;
    })
    .factory('PGP', function ($resource, $http, $log, $q, BASE_URL) {
        var pgpService = {};
        var pgpKey = null;

        pgpService.getKey = function() {
            return pgp_key;
        }

        return pgpService;
    })
    
    .factory('CreditCards', function ($resource, $http, $log, $q, Session, PGP, API_URL) {
        var creditCardService = $resource(API_URL + '/clients/:clientId/creditCards/:creditCardId', {creditCardId: '@_id'}, {
            'update': { method:'PUT' }
        });

        var key = PGP.getKey();

        creditCardService.addCreditCard = function(creditCard) {
            $log.debug("addressService(): addCreditCard()");
            var d = $q.defer();
            
            creditCard = angular.copy(creditCard);
            creditCard.cvv = parseInt(creditCard.cvv);

            var session = Session.get().then(function(session) {
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
                        // update local session, server will update the server session
                        session.client.creditCards.push(cc);
                        $log.debug("addressService(): addCreditCard(): adding credit card to client credit cards", session.client.creditCards);
                        d.resolve(cc);
                    }, function(response) {
                        $log.error("addressService(): addCreditCard(): failed adding credit card to client credit cards", response.data);
                        d.reject('Failed to save creditCard');
                    });
                });
            }, function(error) {
                $log.error("addressService(): addCreditCard(): failed adding credit card to client credit cards", error);
                d.reject('Failed to save creditCard');
            });

            return d.promise;
        }

        creditCardService.removeCreditCard = function(creditCardId) {
            $log.debug("CreditCards(): removeCreditCard(): removing", creditCardId);
            var d = $q.defer();

            Session.get().then(function(session) {
                creditCardService.remove({clientId: session.client.id, creditCardId: creditCardId}).$promise.then(function(response) {
                    $log.debug("CreditCards(): removeCreditCard(): removed credit card");

                    // remove the creditCard from the client data
                    for (var i=0; i < session.client.creditCards.length; i++) {
                        if (session.client.creditCards[i].id == creditCardId) {
                            $log.debug("CreditCards(): removeCreditCard(): removing credit card from browser session");
                            session.client.creditCards.splice(i, 1);
                            break;
                        }
                    }

                    $log.debug("creditCardService(): removeCreditCard(): removed creditCard from client creditCards", session.client.creditCards);
                    d.resolve();

                }, function(response) {
                    $log.error("creditCardService(): removeCreditCard(): failed to removed creditCard from client creditCards", response.data);
                    d.reject('Failed to remove creditCard');
                });
            }, function(error) {
                $log.error("creditCardService(): removeCreditCard(): failed to removed creditCard from client creditCards", error);
                d.reject('Failed to remove creditCard');
            });

            return d.promise;
        }

        creditCardService.saveCreditCard = function(creditCard) {
            $log.debug("CreditCards(): saveCreditCard(): saving", creditCard);
            var d = $q.defer();

            creditCard = angular.copy(creditCard);
            $log.debug('CREDIT CARD:', creditCard.cvv, typeof(creditCard.cvv));
            creditCard.cvv = parseInt(creditCard.cvv);
            $log.debug('CREDIT CARD:', creditCard.cvv, typeof(creditCard.cvv));

            Session.get().then(function(session) {

                // do PGP encryption here
                require(["/lib/openpgp.min.js"], function(openpgp) {
                    var publicKey = openpgp.key.readArmored(key.join("\n"));
                    var cardData = JSON.stringify(creditCard);
                    var encrypted = openpgp.encryptMessage(publicKey.keys, cardData);
                    encrypted = encrypted.trim();
                    //console.log("credit card data", cardData);
                    console.log("encrypted credit card data", encrypted);

                    creditCardService.update({
                        clientId: session.client.id, creditCardId: creditCard.id
                    }, {
                        encrypted: encrypted
                    }).$promise.then(function (cc) {
                        $log.debug("CreditCards(): saveCreditCard(): saved credit card");

                        // update the creditCard in the client data
                        for (var i=0; i < session.client.creditCards.length; i++) {
                            if (session.client.creditCards[i].id == cc.id) {
                                $log.debug("CreditCards(): removeCreditCard(): updating credit card in browser session");
                                session.client.creditCards[i] = cc;
                                break;
                            }
                        }

                        $log.debug("creditCardService(): saveCreditCard(): saved creditCard from client creditCards", session.client.creditCards);
                        d.resolve(cc);

                    }, function (response) {
                        $log.error("creditCardService(): saveCreditCard(): failed to saved creditCard from client creditCards", response.data);
                        d.reject('Failed to save creditCard');
                    });
                });
            }, function(error) {
                $log.error("creditCardService(): saveCreditCard(): failed to saved creditCard from client creditCards", error);
                d.reject('Failed to save creditCard');
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
    .factory('Categories', function ($rootScope, $resource, $http, $log, API_URL) {
        var categoriesService = {};

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

        categoriesService.getTranslated = function(category) {
            if (category == null) {
                return {
                    name: null,
                    description: null
                };
            }
            return {
                name: category[$rootScope.session.language=='en_US'?'name':'name_'+$rootScope.session.language],
                description: category[$rootScope.session.language=='en_US'?'description':'description_'+$rootScope.session.language]
            };
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
    .factory('BreadcrumbsHelper', function($rootScope, $log, $q, $translate, Product, Categories) {
        var breadcrumbService       = {};

        var currentCategory = null;
        var currentProduct = null;
        var lastLanguage = $rootScope.session.language;

        if ($rootScope.breadcrumbs == null) {
            $rootScope.breadcrumbs = [];
        }

        var buildPath = function(category, product, list) {
            if (list == null && product != null) {
                list = new Array();
                $log.debug("breadcrumbService.buildPath(): setting path to product name", Product.getTranslated(product).name);
                list.unshift({
                    type: 'product',
                    name: Product.getTranslated(product).name,
                    id: product.id,
                    url: '/shop/products/' + product.id,
                    item: product
                });
            } else if (list == null) {
                list = new Array();
            }
            if (category != null) {
                $log.debug("breadcrumbService.buildPath(): prepending category name", category.name);
                list.unshift({
                    type: 'category',
                    name: Categories.getTranslated(category).name,
                    id: category.id,
                    url: '/shop/products?category=' + category.id,
                    item: category
                });
                return buildPath(category.parentcategory, product, list);
            } else {
                $log.debug("breadcrumbService.buildPath(): returning current path", list);
            }
            return list;
        }

        // make sure to update the breadcrumbs on language change
        $rootScope.$on('$translateChangeSuccess', function () {
            if ($rootScope.session.language != null) {
                $log.debug("language changed", $rootScope.session.language);
                breadcrumbService.setPath(currentCategory, currentProduct);
            }
        });

        breadcrumbService.setPath = function(category, product) {
            var d = $q.defer();

            $log.debug("breadcrumbService.setPath()", category, product, $rootScope.session.language);

            // set last language, so we can see if we have to recalculate
            lastLanguage = $rootScope.session.language;
            currentCategory = category;
            currentProduct = product;

            if (category == null) {
                $log.debug("breadcrumbService.setPath(): removing breadcrumbs");
                $rootScope.breadcrumbs = new Array();
                d.resolve($rootScope.breadcrumbs);
            }

            var list = buildPath(category, product, null);

            $log.debug("breadcrumbService.setPath(): setting breadcrumbs", list);

            var newCrumbs = new Array();
            // always push home first
            var rootCrumb = {
                type: 'none',
                path: '/'
            };
            $translate('OUR-PRODUCTS').then(function (message) {
                $log.debug("breadcrumbService.setPath(): translated first breadcrumb", message, $rootScope.session.language);
                rootCrumb["label"] = message;
                newCrumbs.push(rootCrumb);

                angular.forEach(list, function(crumb) {
                    var newCrumb = {
                        id: crumb.id,
                        type: crumb.type
                    };
                    newCrumb.label = crumb.name;
                    if (crumb.type == 'category') {
                        newCrumb.path = '/shop/products?category=' + crumb.id;
                    } else if (crumb.type == 'product') {
                        newCrumb.path = '/shop/products/' + crumb.id;
                    }
                    newCrumbs.push(newCrumb);
                });
                $log.debug("breadcrumbService.setPath(): setting new breadcrumbs", newCrumbs);
                $rootScope.breadcrumbs = newCrumbs;

                d.resolve(newCrumbs);
            });

            return d.promise;
        }

        breadcrumbService.getBreadCrumbs = function() {
            //$log.debug("breadcrumbService().getBreadCrumbs(): got breadcrumbs", $rootScope.breadcrumbs);
            return $rootScope.breadcrumbs;
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
          if (item.product==null || item.product.currentPrice==null) {
            // there is a problem, we don't have prices
            $log.error("there are no prices listed for this item", item.product, item.product.currentPrice);
          } else {
            // use the first price in the list
            total += parseInt(item.quantity) * item.product.currentPrice.price;
          }
        })

        return total;
      }

      return orderHelper;
    })
    .factory('PasswordResetHelper', function ($rootScope, $log, $http, $q, API_URL) {
        var resetHelper = {};

        // get the total for a list of products
        resetHelper.requestReset = function(email) {
            $log.debug("PasswordResetHelper(): requestReset()", email);
            var d = $q.defer();

            $http.get(API_URL + '/clients/passwordReset', { params : {
                email: email,
                language: $rootScope.session.language
            }}, {}).success(function(data, status, headers, config) {
                $log.debug("PasswordResetHelper(): requestReset()");

                d.resolve();
            }).error(function(data, status, headers, config) {
                //failure(data, status, headers, config);
                $log.error("PasswordResetHelper(): requestReset(): error resetting password", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        // get the total for a list of products
        resetHelper.reset = function(email, password, token) {
            var d = $q.defer();

            $http.post(API_URL + '/clients/passwordReset', {
                email: email,
                token: token,
                password: password
            }, {}).success(function(data, status, headers, config) {
                $log.debug("PasswordResetHelper(): reset()");

                d.resolve();
            }).error(function(data, status, headers, config) {
                //failure(data, status, headers, config);
                $log.error("PasswordResetHelper(): reset(): error resetting password", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        return resetHelper;
    })
    .factory('Inventory', function ($resource, $http, $log, $q, $translate, Session, API_URL) {
        var inventoryService = $resource(API_URL + '/inventory', {}, {
            'update': { method:'PUT' }
        });

        inventoryService.query = function() {
            var d = $q.defer();

            $log.debug("Inventory(): getAll()");
            // validate the inventory first
            var inventory = $http.get(API_URL + '/inventory', {}).success(function(data, status, headers, config) {
                $log.debug("Inventory(): getAll()", data);

                d.resolve(data);
            }).error(function(data, status, headers, config) {
                $log.error("Inventory(): getAll(): error", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        inventoryService.get = function(id) {
            var d = $q.defer();

            $log.debug("Inventory(): get()");
            // validate the inventory first
            var inventory = $http.get(API_URL + '/inventory/' + id, {}).success(function(data, status, headers, config) {
                $log.debug("Inventory(): get()", data);

                d.resolve(data);
            }).error(function(data, status, headers, config) {
                $log.error("Inventory(): get(): error", status, data);
                d.reject(data);
            });

            return d.promise;
        }

        return inventoryService;
    })

    // sponsors (consults that can sponsor)
    .factory('Sponsor', function ($resource, $http, $log, $q, $translate, API_URL) {
        // configure empty factory object
        var sponsorService = {};
        // search for sponsors either based on zip code or first/last name
        sponsorService.search = function(query) {
            var defer = $q.defer();
            $http.post(API_URL + '/sponsors/search', query).success(function(data, status, headers, config) {
                defer.resolve(data);
            }).error(function(data, status, headers, config) {
                if (status == 404) {
                    defer.resolve(data);
                } else {
                    defer.reject(false);
                }
            });
            return defer.promise;
        };
        // object complete, return as factory
        return sponsorService;
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
    .constant('API_URL', '/api')
    .constant('CDN_URL', CDN_URL); // pulled dynamically from config.js, served by node
