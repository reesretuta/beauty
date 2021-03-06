
angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($location, $scope, $document, $timeout, $rootScope, $anchorScroll, $routeParams, $modal, $log, $q, $translate, $analytics, STORE_BASE_URL, JOIN_BASE_URL, focus, Geocodes, Session, Consultant, Addresses, Order, OrderHelper, Checkout, Cart, Product, SalesTax, CreditCards, Leads, PasswordResetHelper, HashKeyCopier, WizardHandler) {

        $scope.forms = {};

        $log.debug("CheckoutController()");
        $rootScope.inCheckout = true;
        
        var params = $location.search();
        $log.debug("CheckoutController(): params", params);

        var urlStep = S(params.step != null ? params.step : "").toString();
        $log.debug("CheckoutController(): urlStep", urlStep);

        var debug = params.debug;
        $scope.debug = debug;

        var isGuest = params.guest == 'true' ? true : false;
        $scope.debug = isGuest;

        var ignoreExists = params.ignoreExists == 'true' ? true : false;
        $scope.ignoreExists = ignoreExists;

        // tracking review (back button fix)
        $scope.orderCompleted = false;

        var path = $location.path();
        $log.debug("CheckoutController(): path", path);

        // get the sku, add the product to cart
        var sku = S($routeParams.sku != null ? $routeParams.sku : "").toString();
        
        $log.debug("CheckoutController(): loading sku=", sku);
        
        //change page title
        $rootScope.title = "Checkout";
        $rootScope.section = "checkout";

        $scope.processing = false;
        $scope.removingAddress = false;
        $scope.removingAddressId = null;

        // persisted to session
        $scope.checkout = {
            shipping: null,
            billing: null,
            card: null
        };

        // orderBy function for ordering address data
        $scope.filterAddresses = function (obj) {
            console.log('obj:', obj);
            return true;
        };

        // in memory on client only
        $scope.profile = {
            sponsorId: '',
            source: 'web',
            customerStatus: 'new',
            language: 'en_US',
            firstName: '',
            lastName: '',
            loginEmail: '',
            loginPassword: '',
            dob: '',
            phoneNumber: '',
            billing: null,
            shipping: null,
            newShippingAddress: {},
            newBillingAddress: {},
            // default, on
            notificationPreferences: {
                email : 1,
                sms   : 1
            },
            billSame: true,
            agree: true,
            newCard: {},
            card: {},
            qnc: false
        };
        
        $scope.qncProductsSkus = ['19982','19985'];
        $scope.qncProducts = null;
        
        $scope.starterKitsSkus = ['20494','20495','20498','20499'];
        $scope.starterKits = null;
        
        $scope.qncTotalPrice = 0;
        
        
        // set current step
        $scope.currentStep = 'Start';

        if ($rootScope.session && $rootScope.session.client && $rootScope.session.client.consultantIds && $rootScope.session.client.consultantIds.length > 0) {
            $scope.consultantIdSelection = $rootScope.session.client.consultantIds[$rootScope.session.client.consultantIds.length - 1].id;
        }

        if (urlStep == null || urlStep == "") {
            $location.search("step", 'Start');
            urlStep = "Start";
        }

        // on blur of name field focus address line 1
        $scope.blurCompanyField = function ($evt) {
            $evt.preventDefault();
            angular.element('#shippingAddress1').trigger('focus');
        };

        Array.prototype.move = function(from, to) {
            this.splice(to, 0, this.splice(from, 1)[0]);
        };

        function setDefaultPreviousCheckoutInfo () {
            // set default shipping address
            if ($rootScope.session.client && $rootScope.session.client.lastUsedShippingAddressId) {
                $.each($rootScope.session.client.addresses, function(index, address) {
                    if (address.id === $rootScope.session.client.lastUsedShippingAddressId) {
                        $log.debug("CheckoutController(): setting shipping/billing address", address);
                        $rootScope.session.client.addresses.move(index, 0);
                        $scope.profile.shipping = address;
                        $scope.profile.billing = address;
                    }
                });
            }
            // set default payment method
            if ($rootScope.session.client && $rootScope.session.client.lastUsedCreditCardId) {
                $.each($rootScope.session.client.creditCards, function(index, creditCard) {
                    if (creditCard.id == $rootScope.session.client.lastUsedCreditCardId) {
                        $log.debug("CheckoutController(): setting card", creditCard);
                        $rootScope.session.client.creditCards.move(index, 0);
                        $scope.profile.card = creditCard;
                    }
                });
            }
        }
        // call on init
        setDefaultPreviousCheckoutInfo();

        $scope.shippingAddressError = null;
        $scope.billingAddressError = null;

        $scope.setCustomerStatus = function(status) {
            $scope.profile.customerStatus = status;
        }

        $scope.invalidDOB = false;
        $scope.invalidSponsorId = false;

        $scope.processingOrder = false;

        // join addition params
        $scope.profile.firstName = params.firstName;
        $scope.profile.lastName = params.lastName;
        $scope.profile.loginEmail = params.loginEmail;
        $scope.profile.phoneNumber = params.phoneNumber;

        $scope.fromModal = (params.firstName) ? true:false;

        delete $location.$$search.firstName;
        delete $location.$$search.lastName;
        delete $location.$$search.loginEmail;
        delete $location.$$search.phoneNumber;
        $location.$$compose();

        // initially verify
        verifyAge();

        $scope.$watch('profile.dob', function(newVal, oldVal) {
            if (newVal != oldVal) {
                // verify age when dob is exactly 8 characters long
                verifyAge();
            }
        });

        // watch current step for changes
        $scope.$watch('currentStep', function(newVal, oldVal) {
            if (newVal != oldVal && newVal != '' && newVal != null) {

                $log.debug("CheckoutController(): step changed from", oldVal, "to", newVal, 'profile.customerStatus', $scope.profile.customerStatus);

                urlStep = newVal;

                // check if consultant is on final confirmation, if back redirect to initial
                if (S(oldVal).trim() == 'Finish') {

                    $log.debug('CheckoutController(): has already completed purchase, redirect');
                    $location.path(JOIN_BASE_URL);
                    return;
                }
                
                    $("#shippingAddress1").onAvailable(function () {
                        if (!$scope.isOnlineSponsoring) {
                            var accountName = ($rootScope.session.client.firstName + ' ' + $rootScope.session.client.lastName);
                            $log.debug('CheckoutController(): NOT Online Sponsoring: setting shipping name (default):', accountName);
                            $scope.profile.newShippingAddress.name = accountName;
                            $rootScope.namePlaceholder = accountName;
                        }
                        $log.debug("CheckoutController(): focusing address1 field");
                        focus('shipping-address1-focus');
                    });
                    
                if (newVal != 'Start') {
                    $location.search("step", newVal);
                } else if (newVal == 'Finish') {
                    $log.debug("CheckoutController(): triggering finished");
                    $scope.finished();
                } else {
                    $log.debug("CheckoutController(): current step is", urlStep, "newVal", newVal);
                }
                // scroll back to top for each new step
                $location.hash("top");
                $anchorScroll();
            }
        });

        /*==== WATCHER FOR AVAILABLE ELEMENTS IN DOM (NEEDED FOR DYNAMIC CONTENT) ====*/

        $.fn.onAvailable = function(fn){
            var sel = this.selector;
            var timer;
            var self = this;
            if (this.length > 0) {
                fn.call(this);
            } else {
                timer = setInterval(function(){
                    if ($(sel).length > 0) {
                        fn.call($(sel));
                        clearInterval(timer);
                    }
                },100);
            }
            return timer;
        };

        // FIXME - Client Direct Only, ensure that if loading a step, all previous steps were completed

        Session.get().then(function(session) {
            
            $log.debug("CheckoutController(): session initialized", session);

            $scope.session = session;

            $scope.profile.sponsorId = session.consultantId == null ? '' : session.consultantId;
            $log.debug("CheckoutController(): loaded consultantId from session", $scope.profile.sponsorId);

            if (session.source) {
                $scope.profile.source = session.source;
            }
            if (session.language) {
                $scope.profile.language = session.language;
            }

            if (session.client && session.client.id) {
                $log.debug("CheckoutController(): user is logged in");
                $scope.profile.customerStatus = 'existing';
            } else {
                $log.debug("CheckoutController(): user is NOT logged in");
                $scope.profile.customerStatus = 'new';
            }

            $scope.isOnlineSponsoring = false;

            // session copying if needed
            var sessionCopy = $q.defer();
            if (params.session && session.consultantId == null) {
                // request a session clone here
                Session.copy(params.session).then(function() {
                    $log.debug("CheckoutController(): copying session");
                    if ($location.$$search.session) {
                        delete $location.$$search.session;
                        $location.$$compose();
                    }

                    Session.get().then(function(s) {
                        $log.debug("CheckoutController(): reloaded session");
                       $scope.session = session;
                        sessionCopy.resolve(session);
                    }, function(err) {
                        $translate('INVALID_SES').then(function (message) {
                            sessionCopy.reject(message);
                        });
                    });
                }, function(err) {
                    $translate('INVALID_SES').then(function (message) {
                        sessionCopy.reject(message);
                    });
                });
            } else {
                if (params.session && $location.$$search.session) {
                    delete $location.$$search.session;
                    $location.$$compose();
                }
                sessionCopy.resolve(session);
            }

            // wait for any session copying that may be required
            sessionCopy.promise.then(function(session) {

                // for debugging only
                if (debug) {
                    if (path && path.match(JOIN_BASE_URL)) {
                        $log.debug("CheckoutController(): online sponsoring");
                        $scope.isOnlineSponsoring = true;
                        $scope.APP_BASE_URL = JOIN_BASE_URL;
                    } else {
                        $log.debug("CheckoutController(): client direct");
                        $scope.APP_BASE_URL = STORE_BASE_URL;
                    }
                    
                    $scope.getQncProducts();
                    $scope.getKits();
                    populateDebugData();
                    
                    
                    $timeout(function() {
                        WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                    }, 0);
                    return;
                }

                
                // Online Sponsoring
                if (path && path.match(JOIN_BASE_URL)) {

                    
                    $scope.isOnlineSponsoring = true;
                    $scope.APP_BASE_URL = JOIN_BASE_URL;
                    $log.debug("CheckoutController(): online sponsoring");
                    
                    $scope.getQncProducts();
                    $scope.getKits();
                    // lock profile to new, since we're in online sponsoring
                    $scope.profile.customerStatus = 'new';

                    // redirect back home if there is no sku
                    if (S(sku).isEmpty()) {
                        if ($scope.isOnlineSponsoring) {
                            $log.debug("CheckoutController(): no SKU, redirecting back to join page");
                            $scope.alert("There was an error selecting a starter kit");
                        }
                    }
                    
                    $scope.selectProduct(sku).then(function(product) {
                        if (!debug) {
                            //NOT FUNCTIONAL
                            if (Session.isLoggedIn() && !$scope.isOnlineSponsoring) {
                                // // send the user past the login page if they are in client direct & logged in
                                // if (urlStep != 'Start') {
                                //     $log.debug("CheckoutController(): online sponsoring: sending logged in user to", urlStep);
                                //     $timeout(function() {
                                //         WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                                //     }, 0);
                                // } else {
                                //     $log.debug("CheckoutController(): online sponsoring: sending logged in user to Shipping, skipping login/create");
                                //     $timeout(function() {
                                //         WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                                //     }, 0);
                                // }
                            } else {
                                //THIS IS FUNCTIONAL
                                $log.debug("CheckoutController(): online sponsoring: sending non-logged in user to Start");
                                $timeout(function() {
                                    WizardHandler.wizard('checkoutWizard').goTo('Start');
                                    
                                    if ($scope.session.language == 'en_US') {
                                        $scope.kitSelectorLanguage = 'english';
                                    }else{
                                        $scope.kitSelectorLanguage = 'spanish';
                                    }
                                }, 0);
                            }
                        }
                    }, function() {
                        $log.error("CheckoutController(): online sponsoring: failed to select product");
                    });

                    $scope.$watch(Cart.getFirstProductSku(), function(newVal, oldVal) {
                        if (newVal != null) {
                            var language = setConsultantLanguage(newVal);
                            $log.debug("CheckoutController(): online sponsoring: setting consultant language for", sku, "to", language);
                        }
                    });

                    // redirect to different steps as needed on load
                    if (urlStep == 'Finish') {
                        $log.debug("CheckoutController(): online sponsoring: finished wizard, redirecting to landing page?");
                        $location.path(JOIN_BASE_URL).search('');
                        return;
                    } else if (sku == null) {
                        $log.error("CheckoutController(): online sponsoring: failed to load sku for online sponsoring");
                        $scope.alert("There was an error selecting a starter kit");
                        return;
                    } else {
                        if (WizardHandler.wizard('checkoutWizard') != null) {
                            $log.debug("CheckoutController(): online sponsoring: loading Start step");
                            WizardHandler.wizard('checkoutWizard').goTo('Start');
                            params["step"] = "Start";
                            $location.$$search = params;
                            $location.$$compose();
                        } else {
                            $timeout(function() {
                                $log.debug("CheckoutController(): online sponsoring: loading Start step after delay");
                                WizardHandler.wizard('checkoutWizard').goTo('Start');
                                params["step"] = "Start";
                                $location.$$search = params;
                                $location.$$compose();
                            }, 0);
                        }
                    }
                    // Client Direct
                } else {
                    // nothing to load, done
                    $log.debug("CheckoutController(): in store");
                    $scope.APP_BASE_URL = STORE_BASE_URL;

                    // check for items in the cart, if there are none redirect
                    if (session.cart == null || session.cart.length == 0) {
                        $log.debug("CheckoutController(): no items in cart, redirecting");
                        $scope.alert("No items in cart, redirecting");
                        return;
                    }
                    
                    //remove all starter kits from cart if in CD
                    // var kits = ['20494', '20495', '20498','20499'];
                    // for (var i = 0; i < session.cart.length; i++) {
                    //     if (kits.indexOf(session.cart[i].sku) > -1) {
                    //         var item = {sku : session.cart[i].sku};
                    //         Cart.removeFromCart(item).then(function(cart){
                    //             // $scope.cart = cart;
                    //         });
                    //     }
                    // }

                    // on a reload, ensure we've loaded session & moved to the correct step
                    // if (urlStep != null && urlStep != 'Start' && !Session.isLoggedIn()) {
                    if (urlStep != null && urlStep != 'Start') {
                        if (urlStep == 'Finish') {
                            $log.debug("CheckoutController(): finished wizard, redirecting to products");
                            $location.path(STORE_BASE_URL).search('');
                            $location.replace();
                            return;
                        } else {
                            $log.debug("CheckoutController(): sending user to beginning of wizard.  not logged in");
                            // changing url to reflect beginning of checkout
                            if (WizardHandler.wizard('checkoutWizard') != null) {
                                WizardHandler.wizard('checkoutWizard').goTo('Start');
                                params["step"] = "Start";
                                $location.$$search = params;
                                $location.$$compose();
                            } else {
                                $timeout(function() {
                                    $log.debug("CheckoutController(): skipping to Start step after delay");
                                    //$location.search('step', 'Shipping');
                                    WizardHandler.wizard('checkoutWizard').goTo('Start');
                                    params["step"] = "Start";
                                    $location.$$search = params;
                                    $location.$$compose();
                                }, 0);
                            }
                        }
                    } else if (urlStep == 'Finish') {
                        $log.debug("CheckoutController(): finished wizard, redirecting to products");
                        $location.path(STORE_BASE_URL).search('');
                        $location.replace();
                        return;
                    } // else if (Session.isLoggedIn()) {
//                         $log.debug("CheckoutController(): user is logged in, determining checkout step", urlStep);
//                         //NOT NEEDED
//                         // WizardHandler.wizard('checkoutWizard').goTo('Start');
//                         // if (WizardHandler.wizard('checkoutWizard') != null) {
// //                             $log.debug("CheckoutController(): skipping to shipping step");
// //
// //                             // WizardHandler.wizard('checkoutWizard').goTo('Shipping');
// //                             WizardHandler.wizard('checkoutWizard').goTo('Start');
// //                         } else {
// //                             $timeout(function() {
// //                                 $log.debug("CheckoutController(): skipping to shipping step after delay");
// //                                 //$location.search('step', 'Shipping');
// //                                 // WizardHandler.wizard('checkoutWizard').goTo('Shipping');
// //
// //
// //                                 WizardHandler.wizard('checkoutWizard').goTo('Start');
// //                             }, 0);
// //                         }
//                     }

                    loadCheckout();
                }
            }, function(err) {
                $log.debug("CheckoutController(): sessionCopy(): error", err);

            })
        });

        // select language based on product
        function setConsultantLanguage(sku) {
            switch (sku) {
                case "19634":
                case "19636":
                case "20494":
                case "20498":
                    $scope.profile.language = "en_US";
                    break;
                case "19635":
                case "19637":
                case "20495":
                case "20499":
                    $scope.profile.language = "es_US";
                    break;
            }
            return $scope.profile.language;
        }

        $scope.selectProduct = function(sku) {
            var d = $q.defer();

            setConsultantLanguage(sku);
            $scope.orderError = null;

            $log.debug("CheckoutController(): selectProduct(): loading product with sku=", sku);

            // load the product
            Product.get({productId: sku, loadStarterKitOnly: true}).then(function(product) {
                $log.debug("CheckoutController(): selectProduct(): loaded sku", product.sku, "product", product);

                // FIXME - verify all previous steps data is available, else restart process

                $log.debug("CheckoutController(): selectProduct(): clearing cart and restarting checkout");

                Cart.clear().then(function(cart) {
                    $log.debug("CheckoutController(): selectProduct(): previous cart cleared");

                    Cart.addToCart({
                        name: product.name,
                        name_es_US: product.name_es_US,
                        sku: product.sku,
                        kitSelections: product.kitSelections,
                        quantity: 1
                    }).then(function(cart) {
                        $log.debug("CheckoutController(): selectProduct(): SKU loaded & added to cart", cart);

                        $scope.cart = cart;

                        loadCheckout().then(function() {
                            d.resolve(product);
                        });
                    }, function(error) {
                        $log.error("CheckoutController(): selectProduct(): failed to add to cart, redirecting", error);
                        $scope.orderError = "Failed to add product to cart";
                        $scope.salesTaxInfo = null;

                        $scope.alert("ERR101: Error loading products in cart");
                        d.reject(error);
                    });
                }, function(error) {
                    $log.error("CheckoutController(): selectProduct(): failed to clear the cart, redirecting", error);
                    $scope.orderError = "Failed to clear cart";
                    $scope.salesTaxInfo = null;

                    $scope.alert("ERR102: Error loading products in cart");
                    d.reject(error);
                });
            }, function(error) {
                $log.error("CheckoutController(): selectProduct(): failed to load product, redirecting", error);
                $scope.orderError = "Failed to load product";
                $scope.salesTaxInfo = null;

                $scope.alert("ERR103: Error loading products in cart");
                d.reject(error);
            });

            return d.promise;
        }
        
        $scope.getKits = function(){
            var d = $q.defer();
            
            //loadUnavailable for dev only
            var p = Product.query({productIds: $scope.starterKitsSkus, loadUnavailable: true}).then(function(products) {
                $log.debug("checkoutController(): getKits(): loaded products", products);

                $scope.starterKits = products;
                d.resolve(products);
            }, function(error) {
                $log.debug("checkoutController(): getKits(): error loading products", error);
                d.reject(error);
            });
            
            return d.promise;
        }
        
        
        $scope.getQncProducts = function(){
            var d = $q.defer();
            //fetch scope details assign to $scope.qncProducts.. use $scope.qncProducts in placeOrder() to populate components
            
            //loadUnavailable for dev only
            var p = Product.query({productIds: $scope.qncProductsSkus, loadUnavailable: true}).then(function(products) {
                $log.debug("checkoutController(): getQncProducts(): loaded products", products);
                // $.each(products, function(index, product) {
                //     // merge back in
                //     $.each(items, function(index, item) {
                //         if (item.sku == product.sku) {
                //             item.product = product;
                //         }
                //     });
                // });
                
                $scope.qncProducts = products;
                d.resolve(products);
            }, function(error) {
                $log.debug("checkoutController(): getQncProducts(): error loading products", error);
                d.reject(error);
            });
            
            return d.promise;
        }
        

        
        $scope.selectQncProduct = function(sku) {
            $log.debug("CheckoutController(): selectQncProduct(): $scope.cart", $scope.cart);
            var alreadyInCart = false;
            for (var i = 0; i < $scope.cart.length; i++) {
                if ($scope.cart[i].sku == sku) {
                    alreadyInCart = true;
                }
            }
            //if QNC products already in cart, do nothing
            if (alreadyInCart) {
                return false;
            }else{
                //get QNC product details
                for (var i = 0; i < $scope.qncProducts.length; i++) {
                    if (sku == $scope.qncProducts[i].sku) {
                        var qncProduct = $scope.qncProducts[i];
                    }
                }
                
                addQncProduct(qncProduct);
                
            }
            
            function addQncProduct(qncProduct){
                var d = $q.defer();
            
                $scope.orderError = null;

                $log.debug("CheckoutController(): selectQncProduct(): loading product with sku=", sku);

                Cart.addToCart({
                    name: qncProduct.name,
                    name_es_US: qncProduct.name_es_US, //name_es_US does not get passed back from service
                    sku: qncProduct.sku,
                    kitSelections: qncProduct.kitSelections,
                    quantity: 1
                }).then(function(cart) {
                    $log.debug("CheckoutController(): selectQncProduct(): SKU loaded & added to cart", cart);
                    $scope.cart = cart;
                    //add QNC price
                    updateQncTotalPrice(qncProduct.sku,'add');
                    $log.debug("CheckoutController(): selectQncProduct(): add $scope.qncTotalPrice", $scope.qncTotalPrice);
                    
                    
                    loadCheckout().then(function() { //this also updates new sales tax
                        d.resolve(cart);
                    });
                }, function(error) {
                    $log.error("CheckoutController(): selectQncProduct(): failed to add to cart, redirecting", error);
                    $scope.orderError = "Failed to add product to cart";
                    $scope.salesTaxInfo = null;
                    $scope.alert("ERR101: Error loading products in cart");
                    d.reject(error);
                });

                return d.promise;
            }
            
            
        }
        
        $scope.removeQncProduct = function(sku){
            var d = $q.defer();
            Cart.removeFromCart({sku: sku}).then(function(cart){
                $scope.cart = cart;
                loadCheckout().then(function() { //this also updates new sales tax
                    d.resolve(cart);
                    updateQncTotalPrice(sku,'remove');
                });
            }, function(error){
                $log.error("CheckoutController(): removeQncProduct(): failed to remove to cart, redirecting", error);
                $scope.orderError = "Failed to add product to cart";
                $scope.salesTaxInfo = null;
                $scope.alert("ERR101: Error loading products in cart");
                d.reject(error);
            });
            
            return d.promise;
        }
        
        function updateQncTotalPrice(sku,addOrRemove){
            $log.debug("CheckoutController(): updateQncTotalPrice(): $scope.qncTotalPrice", $scope.qncTotalPrice);
            for (var i = 0; i < $scope.qncProducts.length; i++) {
                if (sku == $scope.qncProducts[i].sku) {
                    var qncProduct = $scope.qncProducts[i];
                }
            }
            if (addOrRemove === 'add') {
                $scope.qncTotalPrice += qncProduct.currentPrice.price;
            }else{
                
                $scope.qncTotalPrice -= qncProduct.currentPrice.price;
            }
            
            $log.debug("CheckoutController(): updateQncTotalPrice(): $scope.qncTotalPrice", $scope.qncTotalPrice);
            
        }
        
        $scope.getQncProgressPercent = function () {
                var percent = $scope.qncTotalPrice/300 * 100;
                return ( percent < 100) ? percent : 100;
        };
        
        $scope.getUntilNextLevel = function () {
            return ((300 - $scope.qncTotalPrice) > 0) ? (300 - $scope.qncTotalPrice) : 0;
        };
        
        $scope.toggleQnc = function (value) {
            if (value === 1) {
                $log.debug("CheckoutController(): toggleQnc(): value",value);
                $scope.profile.qnc = true;
            } else {
                $scope.profile.qnc = false;
            }
        };
        
        // load the checkout data from the session
        function loadCheckout() {
            var d = $q.defer();

            $log.debug("CheckoutController(): loadCheckout()");

            Checkout.getCheckout().then(function(checkout) {
                $log.debug("CheckoutController(): loadCheckout(): success", checkout);
                $scope.checkout = checkout;

                // load the current cart
                Cart.get().then(function(cart) {
                    $log.debug("CheckoutController(): loadCheckout(): cart loaded", cart);

                    $scope.cart = cart;

                    // redirect if cart is empty
                    if (cart == null || cart.length == 0) {
                        $log.debug("CheckoutController(): loadCheckout(): no items, redirecting");
                        $scope.alert("Failed to load cart for checkout");
                        return;
                    }

                    // no that we're loaded, create out change listener to track changes
                    if (cancelChangeListener == null) {
                        createChangeListener();
                    }

                    // only fetch sales tax info if we have a shipping address
                    if ($scope.profile.shipping) {
                        // fetch sales tax information here
                        fetchSalesTax().then(function(salesTaxInfo) {
                            $log.debug("CheckoutController(): loadCheckout(): got sales tax info", salesTaxInfo);
                            
                            $scope.salesTaxInfo = salesTaxInfo;
                            
                            $scope.checkoutUpdated();
                            d.resolve();
                        }, function(error) {
                            $log.error("CheckoutController(): loadCheckout(): failed to get sales tax info, redirecting", error);
                            $scope.orderError = "Failed to load sales tax";
                            $scope.salesTaxInfo = null;

                            $location.path($scope.isOnlineSponsoring ? JOIN_BASE_URL : STORE_BASE_URL).search('');
                            d.reject(error);
                        });
                    } else {
                        d.resolve();
                    }

                }, function(error) {
                    d.reject(error);
                });
            }, function(error) {
                $log.error("CheckoutController(): loadCheckout(): checkout error", error);
            });
            return d.promise;
        }

        var cancelChangeListener;
        function createChangeListener() {
            // change the wizard steps when folks hit the back/forward browser buttons
            cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl) {
                var url = $location.url(),
                    path = $location.path(),
                    params = $location.search();
                //$log.debug("CheckoutController(): changeListener(): location change event in checkout page", url, params);
                var urlStep = S(params.step != null ? params.step : "").toString();
                var localStep = $scope.currentStep;
                $scope.checkoutUpdated();
                $log.debug("CheckoutController(): changeListener(): url search", urlStep, "local step", localStep);

                // if we have a composition and run, and the current scope doesn't already have the same run
                if (path == STORE_BASE_URL + "/checkout" || path == JOIN_BASE_URL + "/checkout" && (urlStep != localStep)) {
                    $log.debug("CheckoutController(): changeListener():  updating step in response to location change");
                    // NOT SURE IF WE WANT TO KEEP THIS BUT THOUGHT WE SHOULDN'T ALLOW USER TO GO TO LOGIN PAGE AGAIN ONCE THEY PASSED THIS STEP
                    if (urlStep=='') {
                        
                        $log.debug("CheckoutController(): changeListener(): going to start");
                        WizardHandler.wizard('checkoutWizard').goTo('Start');
                        $location.search("step", 'Start');
                        // if (Session.isLoggedIn()) {
                        //     $log.debug("CheckoutController(): changeListener(): user is logged in, skipping to shipping");
                        //     WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                        //
                        //     // if the URL step is empty, then change it to shipping
                        //     $location.search("step", 'Shipping');
                        //
                        //     return;
                        // } else {
                        //     $log.debug("CheckoutController(): changeListener(): going to start");
                        //     WizardHandler.wizard('checkoutWizard').goTo('Start');
                        //     $location.search("step", 'Start');
                        // }
                    } else {
                        $log.debug("CheckoutController(): changeListener(): going to", urlStep);
                        WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                    }
                } else {
                    $log.debug("CheckoutController(): changeListener(): ignoring");
                    $analytics.pageTrack($location.url());
                }
            });
        }

        $scope.validateStartAndReview = function(email){
            $log.debug("CheckoutController(): validateStartAndReview(): $scope.profile.consultantIdSelection ",$scope.profile.consultantIdSelection);
            $log.debug("CheckoutController(): validateStartAndReview(): $rootScope.session.client.consultantIds ",$rootScope.session.client.consultantIds);
            
            return false;
            
            if ($scope.isOnlineSponsoring) {
                $scope.validateEmailAndContinue(email); //checks of email already in use
            }else{
                //client direct
                $scope.singlePageValidate();
            }
        }
        
        
        function verifyAge() {
            $log.debug("CheckoutController(): verifyAge(): ", $scope.profile.dob)
            $scope.invalidDOB = false;

            var dob = moment($scope.profile.dob, 'MMDDYYYY', true);
            var now = moment();
            
            if (!dob.isValid() || now.diff(dob,'years') < 18) {
                $scope.invalidDOB = true;
            }
        }

        $scope.selectShippingAddress = function(address) {
            $log.debug("CheckoutController(): selectShippingAddress(): setting shipping to", address);
            $scope.profile.shipping = angular.copy(address);

            // only set this if billSame is selected
            if ($scope.profile.billSame) {
                $log.debug("CheckoutController(): selectShippingAddress(): setting billing to", address);
                $scope.profile.shipping = angular.copy(address);
            }

            //$log.debug("CheckoutController(): selectShippingAddress(): profile now", $scope.profile);
            $log.debug("CheckoutController(): selectShippingAddress(): profile now");
            $scope.checkoutUpdated();
        }
        
        $scope.lookupSponsor = function(){
            $log.debug('CheckoutController(): lookupSponsor()');
            var dd = $q.defer();
            var d = $modal.open({
                backdrop: true,
                keyboard: true,
                windowClass: 'lookupSponsorModal',
                templateUrl: '/partials/checkout/lookupsponsor-modal.html',
                controller:  'LookupSponsorController',
                resolve: {}
            });
            var body = $document.find('html, body');
            d.result.then(function(result) {
                $log.debug('CheckoutController(): lookupSponsor(): lookupSponsor modal closed', result);
                if (!result.canceled) {
                    $scope.profile.sponsorId = result.sponsorId;
                    dd.resolve();
                } else {
                    dd.resolve();
                }
                body.css('overflow-y', 'auto');
            });
            $('html, body').css('overflow-y', 'hidden');
            return dd.promise;
        };

        function cardExpirationChanged() {
            $scope.invalidExpiration = false;

            if ($scope.profile.newCard == null || S($scope.profile.newCard.expMonth).isEmpty() || S($scope.profile.newCard.expYear).isEmpty()) {
                $log.debug("CheckoutController(): cardExpirationChanged(): not fully filled out, unsetting error");
                $scope.invalidExpiration = false;
                return;
            }

            var expiration = moment($scope.profile.newCard.expMonth + $scope.profile.newCard.expYear, "MMYYYY", true).endOf("month");
            var now = moment();

            if (!expiration.isValid() || now.diff(expiration,'days') > 0) {
                $log.debug("CheckoutController(): cardExpirationChanged(): expired");
                $scope.invalidExpiration = true;
            } else {
                $log.debug("CheckoutController(): cardExpirationChanged(): not expired");
            }
        }

        function selectGeocodeAndAdd(a) {
            $log.debug("CheckoutController(): selectGeocodeAndAdd()", a);
            var d = $q.defer();

            // add name here since we're not allowing user to input a name for shipping address manually;
            if ($scope.isOnlineSponsoring) {
                a.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                a.phone = $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
            } else {
                if (a.phone) {
                    a.phone = a.phone.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
                }
            }

            // add geocode through service
            Addresses.selectGeocodeAndAdd(a).then(function(a) {
                d.resolve(a);
                $scope.checkoutUpdated();
            }, function(err) {
                $log.error("CheckoutController(): selectGeocodeAndAdd(): error looking up geocode", r);
                if (err.token) {
                    $translate(err.token).then(function (message) {
                        $scope.shippingAddressError = message;
                    });
                } else {
                    $scope.shippingAddressError = err;
                }
                d.reject(err);
            });

            return d.promise;
        }

        function addAddressToBackend(a) {
            $log.debug("CheckoutController(): addAddressToBackend()", a);
            var d = $q.defer();
            if ($scope.isOnlineSponsoring || isGuest) {
                // online sponsoring, we have it in mem
                d.resolve(a);
            } else {
                $log.debug("CheckoutController(): addAddressToBackend(): adding address", a);

                Addresses.saveOrUpdateAddress(function(a) {
                    $log.debug("CheckoutController(): addAddressToBackend(): address added", a);
                    d.resolve(a);
                }, function(error) {
                    $log.error("CheckoutController(): addAddressToBackend(): failed to add address", error);
                    $scope.shippingAddressError = error;
                    d.reject(error);
                });
            }
            return d.promise;
        }

        $scope.submitStart = function() {
            WizardHandler.wizard('checkoutWizard').goTo('Profile');
        }
        
        $scope.validateProfileAndContinue = function() {
            //$log.debug("CheckoutController(): validateProfileAndContinue()", $scope.profile);
            $log.debug("CheckoutController(): validateProfileAndContinue()");
            $scope.profileSSNError = false;
            $scope.processing = true;
            if (debug) {
                $log.debug("CheckoutController(): validateProfileAndContinue(): in debug, skipping to shipping");
                // WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                $scope.processing = false;
                return;
            }
            
            var ssn = $scope.profile.ssn.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
            $scope.password = $scope.profile.ssn.replace(/(\d{3})(\d{2})(\d{4})/, '$3');
            Consultant.lookup(ssn).then(function(data) {
                $log.debug("CheckoutController(): validateProfileAndContinue()", data);
                if (!data.exists) {
                    // set the name on the shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                    $rootScope.namePlaceholder = $scope.profile.firstName + " " + $scope.profile.lastName;
                    // do the sales tax calculations before moving to the next page
                    $scope.addShippingAddressAndContinue($scope.profile.newShippingAddress).then(function() {
                        $scope.addPaymentMethod().then(function(){
                            if ($scope.isOnlineSponsoring) {
                                $log.debug("CheckoutController(): addShippingAddressAndContinue(): going to review");
                                WizardHandler.wizard('checkoutWizard').goTo('Review');
                            }
                        }); //progressing to next step
                    });
                    $scope.processing = false;
                    $scope.profileSSNError = false;
                    $scope.profileSSNErrorDuplicate = false;
                    $scope.profileSSNErrorInvalid = false;
                } else {
                    // profile error
                    $log.debug("CheckoutController(): validateProfileAndContinue(): error with SSN: duplicate");
                    $scope.processing = false;
                    $scope.profileSSNError = true;
                    $scope.profileSSNErrorDuplicate = true;
                    $scope.profile.ssn = '';
                    $('html, body').animate({ scrollTop: ($('#errors-container').offset().top - 100) }, 750);

                }
            }, function(error) {
               $log.error("CheckoutController(): validateProfileAndContinue(): error with SSN: generic:", error);
                $scope.processing = false;
                $scope.profileSSNError = true;
                $scope.profileSSNErrorInvalid = true;
                $scope.profile.ssn = '';
                $('html, body').animate({ scrollTop: ($('#errors-container').offset().top - 100) }, 750);
            });
        };

        $scope.editContactInfo = function() {
            $log.debug('CheckoutController(): editContactInfo()');
            var dd = $q.defer();
            var d = $modal.open({
                backdrop: true,
                keyboard: true,
                windowClass: 'editContactInfoModal',
                templateUrl: '/partials/checkout/contact-info-edit-modal.html',
                controller:  'ContactEditModalController',
                resolve: {
                    profile: function() {
                        return {
                            firstName   : $scope.profile.firstName,
                            lastName    : $scope.profile.lastName,
                            loginEmail  : $scope.profile.loginEmail,
                            phoneNumber : $scope.profile.phoneNumber
                        }
                    }
                }
            });
            var body = $document.find('html, body');
            d.result.then(function(result) {
                $log.debug("CheckoutController(): editContactInfo(): edit contact info modal closed", result);
                // save the profile information if not canceled
                if (!result.canceled) {
                    // result.profile
                    $scope.profile.firstName = result.profile.firstName;
                    $scope.profile.lastName = result.profile.lastName;
                    $scope.profile.loginEmail = result.profile.loginEmail;
                    $scope.profile.phoneNumber = result.profile.phoneNumber;

                    dd.resolve();
                } else {
                    dd.resolve();
                }
                // re-enable scrolling on body
                body.css("overflow-y", "auto");
            });
            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");
            return dd.promise;
        };

        // edit an address via a standard modal
        $scope.editAddress = function(address, addressType) {
            var d, body, dd = $q.defer();
            d = $modal.open({
                backdrop: true,
                keyboard: true,
                windowClass: 'editAddressModal',
                templateUrl: '/partials/checkout/modals/shipping-edit.html',
                controller: 'AddressEditModalController',
                resolve: {
                    address: function() {
                        return angular.copy(address);
                    },
                    addAddress: function() {
                        return angular.copy(addAddress);
                    },
                    isOnlineSponsoring: function () {
                        return $scope.isOnlineSponsoring;
                    },
                    namePlaceholder: function () {
                        // return $rootScope.session.client.firstName + ' ' + $rootScope.session.client.lastName;
                        return '';
                    }
                }
            });
            body = $document.find('html, body');
            d.result.then(function(result) {
                $log.debug('CheckoutController(): editAddress(): edit address modal: saved');
                $log.debug('CheckoutController(): editAddress(): checking for addressType: (%s)', addressType);
                if (addressType && !result.canceled) {
                    $log.debug('CheckoutController(): editAddress()', addressType);
                    $scope.profile[addressType] = angular.copy(result.address);
                    $log.debug('CheckoutController(): editAddress(): FINISHED');
                }
                dd.resolve();
                body.css('overflow-y', 'auto');
            });
            $('html, body').css('overflow-y', 'hidden');
            return dd.promise;
        };

        $scope.verifyExp = function() {
            $log.debug("CheckoutController(): verifyExp(): ", $scope.profile.exp)
            $scope.invalidExp = false;

            var exp = moment($scope.profile.exp, 'MMYYYY', true);
            var now = moment();
            
            if (!exp.isValid() || now > exp) {
                $scope.invalidExp = true;
            }
        }

        $scope.total = function() {
            if ($scope.cart != null || $scope.cart.length == 0) {
                //$log.debug("CheckoutController(): total(): for items", $scope.cart)
                return OrderHelper.getTotal($scope.cart);
            }
            return 0;
        };

        //TODO
        $scope.forceValidation = function(formObj) {
            angular.forEach(formObj, function(val, key) {
                if (!/\$/.test(key)) {
                    $('input[name=' + key + ']').trigger('blur');
                }
            });
        };
        
        $scope.validateEmailAndContinue = function(email) {
            var d = $q.defer();
            $scope.emailError = false;
            $scope.processing = true;
            $log.debug("CheckoutController(): validateEmailAndContinue()", email);

            if (debug) {
                $log.debug("CheckoutController(): in debug, skipping validating email");

                // move to next step
                WizardHandler.wizard('checkoutWizard').goTo('Review');
                $scope.processing = false;
            } else {
                Addresses.validateEmail(email).then(function(r) {
                    $log.debug("CheckoutController(): validated email");
                    
                    // set the user name on shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                    $scope.profile.newBillingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;

                    $log.debug('CheckoutController(): line 965: $scope.profile:', $scope.profile);

                    if ($scope.isOnlineSponsoring) {
                        Session.consultantEmailAvailable(email, $scope.ignoreExists).then(function (available) {
                            $log.debug('CheckoutController(): Session: $scope.ignoreExists:?????', $scope.ignoreExists);
                            if (available) {
                                $log.debug('CheckoutController(): Session: client available', available);
                                // generate a lead for this account
                                Leads.save({
                                    email: email,
                                    firstName: $scope.profile.firstName,
                                    lastName: $scope.profile.lastName,
                                    phone: $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
                                    language: $scope.profile.language
                                }).$promise.then(function(lead) {
                                        $log.debug("CheckoutController(): validateEmailAndContinue(): lead created");
                                    }, function(error) {
                                        $log.error("CheckoutController(): validateEmailAndContinue(): failed to create lead", error);
                                    });
                                // WizardHandler.wizard('checkoutWizard').goTo('Profile');
                                $scope.validateProfileAndContinue();
                                $scope.processing = false;
                            } else {
                                $translate('INVALID-EMAIL-ADDRESS-IN-USE').then(function (message) {
                                    $scope.emailError = message;
                                });
                                $scope.processing = false;
                            }
                        }, function(error) {
                            $scope.emailError = "Error checking email address";
                            $scope.processing = false;
                        });
                    } else {
                        // move to next step
                        // WizardHandler.wizard('checkoutWizard').goTo('Profile');
                        
                        $log.error("CheckoutController(): resolving promise", r);
                        d.resolve();
                        $scope.processing = false;
                    }
                }, function(r) {
                    d.reject(r);
                    $log.error("CheckoutController(): failed validating email", r);
                    $translate('INVALID-EMAIL').then(function (message) {
                        $scope.emailError = message;
                    });
                    $scope.processing = false;
                })
            }
            return d.promise;
        }

        $scope.loginOrCreateUser = function() {
            $log.debug("CheckoutController(): loginOrCreateUser()");

            $scope.loginError = null;
            $scope.processing = true;

            if ($scope.profile.customerStatus == 'new') {
                $log.debug("CheckoutController(): loginOrCreateUser(): trying to create client with username=", $scope.profile.loginEmail);

                Session.createClient({
                    email: $scope.profile.loginEmail,
                    password: $scope.profile.loginPassword,
                    firstName: $scope.profile.firstName,
                    lastName: $scope.profile.lastName,
                    dateOfBirth: $scope.profile.dateOfBirth,
                    consultantId: $scope.profile.consultantId,
                    source: $scope.profile.source,
                    language: $scope.profile.language,
                    notificationPreferences: $scope.profile.notificationPreferences
                }).then(function(session) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): created client, moving to next step", session.client);

                    // set the name on the shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                    $rootScope.namePlaceholder = $scope.profile.firstName + " " + $scope.profile.lastName;

                    $scope.profile.customerStatus = 'existing';

                    $scope.checkoutUpdated();
                    // jump to Shipping
                    // WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                    
                    if (!$scope.isOnlineSponsoring) {
                        $log.debug("CheckoutController(): loginOrCreateUser(): created client for CD, set status = existing");
                    }else{
                        $scope.validateProfileAndContinue();
                    }
                    $scope.processing = false;
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to create client", error);
                    if (error.statusCode == 409) {
                        $translate('EMAIL-DUPLICATE').then(function (message) {
                            $scope.loginError = message;
                        });
                    } else {
                        $translate('CLIENT-CREATE-ERROR').then(function (message) {
                            $scope.loginError = message;
                        });
                    }
                    $scope.processing = false;
                });
            } else {
                $log.debug("CheckoutController(): loginOrCreateUser(): trying to login with username=", $scope.profile.loginEmail);
                // do the auth check and store the session id in the root scope
                Session.login($scope.profile.loginEmail, $scope.profile.loginPassword).then(function(session) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): authenticated, moving to next step", session.client);
                    $scope.profile.customerStatus = 'existing';
                    $scope.checkoutUpdated();
                    // jump to Shipping
                    // WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                    if (!$scope.isOnlineSponsoring) {
                        $log.debug("CheckoutController(): loginOrCreateUser(): authenticated, $scope.profile.customerStatus:", $scope.profile.customerStatus);
                        //do nothing let user fill out info
                    }else{
                        //existing OS user
                        $scope.validateProfileAndContinue();
                    }
                    
                    $scope.processing = false;
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to authenticate");
                    $translate('LOGIN-ERROR').then(function (message) {
                        $scope.loginError = message;
                    });
                    $scope.processing = false;
                });
            }
        }

        $scope.checkoutUpdated = function() {
            $log.debug("CheckoutController(): checkoutUpdated(): checkout updated", $scope.checkout);
            $log.debug("CheckoutController(): checkoutUpdated(): $scope.profile", $scope.profile);
            var checkout = angular.copy($scope.checkout);

            Checkout.setCheckout(checkout);
        }

        $scope.confirmAlert = function(message) {
            var confirmAction = confirm(message);

            if (confirmAction && $scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): confirmAlert(): redirecting back to join page");
                $location.path(JOIN_BASE_URL).search('');
            }
            else if (confirmAction && !$scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): confirmAlert(): redirecting back to store page");
                $location.path(STORE_BASE_URL).search('');
            }
        }

        $scope.alert = function(message) {
            alert(message);

            if ($scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): alert(): redirecting back to join page");
                $location.path(JOIN_BASE_URL).search('');
            } else if (!$scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): alert(): redirecting back to store page");
                $location.path(STORE_BASE_URL).search('');
            }
        }

        $scope.resetCard = function() {
            $log.debug("CheckoutController(): resetCard()");
            $scope.profile.newCard = angular.copy($scope.profile.card);
        }

        $scope.selectCardAndContinue = function(ccData) {
            //button clicked. sets $scope.profile.card
            $log.debug("CheckoutController(): selectCardAndContinue()", ccData);
            $scope.profile.card = angular.copy(ccData);
            $log.debug("CheckoutController(): DEBUG card", $scope.profile.card);
            $log.debug("CheckoutController(): selectCardAndContinue(): profile now", $scope.profile);
            $scope.checkoutUpdated();
        }
        
        $scope.showNewShipping = function () {
            $scope.profile.shipping = null;
            $scope.profile.newShippingAddress.name = $rootScope.session.client.firstName + ' ' + $rootScope.session.client.lastName;
        };

        $scope.showNewBilling = function(){
            $scope.profile.billing = null;
        };
        
        $scope.showNewPayment = function(){
            $scope.profile.card = {};
            $log.debug("CheckoutController(): DEBUG card", $scope.profile.card);
        };
        
        function addShippingIfNotSelected() {
            $log.debug("CheckoutController(): addShippingIfNotSelected()");
            var d = $q.defer();
            if ($scope.profile.shipping == null) {
                //new shipping
                $log.debug("CheckoutController(): addShippingIfNotSelected(): new shipping");
                $scope.addShippingAddressAndContinue($scope.profile.newShippingAddress).then(function(a) {
                    $log.debug("CheckoutController(): addShippingIfNotSelected(): new shipping", $scope.profile.newShippingAddress);
                    d.resolve(a);
                }, function(err) {
                    $log.error("CheckoutController(): addShippingIfNotSelected(): error", err);
                    d.reject(err);
                });
            } else {
                d.resolve();
            }
            return d.promise;
        }

        function addBillingIfNotSelected() {
            $log.debug("CheckoutController(): addBillingIfNotSelected()");
            var d = $q.defer();
            if ($scope.profile.billing == null) {
                $log.debug("CheckoutController(): addBillingIfNotSelected(): new billing");
                $scope.addBillingAddress($scope.profile.newBillingAddress).then(function(a) {
                    $log.debug("CheckoutController(): addBillingIfNotSelected(): new billing", $scope.profile.newBillingAddress);
                    d.resolve(a);
                }, function(err) {
                    $log.error("CheckoutController(): addBillingIfNotSelected(): error", err);
                    d.reject(err);
                });
            } else {
                d.resolve();
            }
            return d.promise;
        }
        
        $scope.selectBillingAddressAndContinue = function(address){
            $log.debug("CheckoutController(): selectBillingAddressAndContinue(): address: ", address);
            $scope.profile.billing = angular.copy(address);
        }
        
        
        
        $scope.updateSku = function(sku){
            
            var newSku = sku; //for downdown menu clicks
            
            //large red button clicked
            if (sku == 'royal') {
                if ($scope.kitSelectorLanguage == 'english') {
                    newSku = '20494';
                }else{
                    newSku = '20495';
                }
            }
            if (sku == 'special'){
                if ($scope.kitSelectorLanguage == 'english') {
                    newSku = '20498';
                }else{
                    newSku = '20499';
                }
            }
            
            //dropdown menu clicked
            if (newSku == '20494' || newSku == '20498') { //english
                $scope.kitSelectorLanguage = 'english';
            }else{ //spanish
                $scope.kitSelectorLanguage = 'spanish';
            }
            
            $scope.selectProduct(newSku).then(function(){ //sets $scope.cart[0].sku
                $log.debug("CheckoutController(): updateSku(): ", $scope.cart[0].sku);
            });
        }

        $scope.billSameChanged = function(billSame) {
            $log.debug('CheckoutController(): billSameChanged: $scope.profile.newBillingAddress:', $scope.profile.newBillingAddress);
            if (billSame) {
                $log.debug("CheckoutController(): billSameChanged(): setting billing = shipping");
                $scope.profile.billing = angular.copy($scope.profile.shipping);
            } else {
                $log.debug("CheckoutController(): billSameChanged(): setting billing = null");
                $scope.profile.billing = null;
                $scope.profile.newBillingAddress.name = $rootScope.session.client.firstName + ' ' + $rootScope.session.client.lastName;
            }
        }
        
        function addPaymentIfNotSelected(){ //responding back to continue button click
            var d = $q.defer();
            $log.debug("CheckoutController(): addPaymentIfNotSelected(): $scope.profile.card: ", $scope.profile.card);

            $log.debug("CheckoutController(): addPaymentIfNotSelected(): profile now: ", $scope.profile);

            if ($scope.profile.card.id == null) {
                $log.debug("CheckoutController(): addPaymentIfNotSelected(): new card");
                // assume we have card in form, so add it
                $scope.addPaymentMethod().then(function(card) { //assumes NEW card, checks for profile.billSame
                    $log.debug("CheckoutController(): addPaymentIfNotSelected(): added", card);
                    $log.debug("CheckoutController(): addPaymentIfNotSelected(): profile now: ", $scope.profile);
                    d.resolve(card);
                }, function(err) {
                    $log.error("CheckoutController(): addPaymentIfNotSelected(): error adding payment", err)
                    d.reject(err);
                });
            } else {
            //    $log.debug("CheckoutController(): addPaymentIfNotSelected(): card is selected");
            //    $log.debug("CheckoutController(): addPaymentIfNotSelected(): profile now: ", $scope.profile);
            //
            //    if ($scope.profile.billSame) {
            //        $log.debug("CheckoutController(): addPaymentIfNotSelected(): setting billing same");
            //        $scope.billSameChanged(true);
            //    } else{
            //        // set billing to newBilling
            //        $log.debug("CheckoutController(): addPaymentIfNotSelected(): billing not same");
            //    }
            //
                d.resolve();
            }
            return d.promise;
        }
        
        $scope.singlePageValidate = function() {
            $log.debug("CheckoutController(): singlePageValidate()");
            addShippingIfNotSelected().then(function(a) {
                $log.debug("CheckoutController(): singlePageValidate(): added?", a!=null)
                addPaymentIfNotSelected().then(function(card) {
                    $log.debug("CheckoutController(): singlePageValidate(): added payment", card != null);
                    addBillingIfNotSelected().then(function(a) {
                        $log.debug("CheckoutController(): singlePageValidate(): going to review", $scope.profile);
                        WizardHandler.wizard('checkoutWizard').goTo('Review');
                    }, function(err) {
                        $log.error("CheckoutController(): singlePageValidate(): error adding/selecting billing", err)
                    })
                }, function(err) {
                    // FIXME - display error message here
                    $log.error("CheckoutController(): singlePageValidate(): error adding/selecting payment", err)
                });
            }, function(err) {
               // FIXME - display error message here
                $log.error("CheckoutController(): singlePageValidate(): error adding/selecting shipping", err)
            });
        }
        
        $scope.isInCart = function(sku){
            if ($scope.cart) {
                var isInCart = false;
                for (var i = 0; i < $scope.cart.length; i++) {
                    if ($scope.cart[i].sku == sku) {
                        isInCart = true;
                    }
                }  
                return isInCart;
            }
        }
        
        
        $scope.addPaymentMethod = function() {
            var d = $q.defer();
            $scope.processing = true;
            
            if (debug) {
                //$log.debug("CheckoutController(): addPaymentMethod(): debug, adding card to checkout", $scope.profile.newCard);
                $log.debug("CheckoutController(): addPaymentMethod(): debug, adding card to checkout");
                $scope.profile.card = angular.copy($scope.profile.newCard);
                // WizardHandler.wizard('checkoutWizard').goTo('Review');
                $scope.processing = false;
                return;
            }

            if (!$scope.isOnlineSponsoring) {
                //$log.debug("CheckoutController(): addPaymentMethod(): adding card to account", $scope.profile.newCard);
                $log.debug("CheckoutController(): addPaymentMethod(): adding card to account");
                // we need to create a card and add to the account for client direct
                CreditCards.addCreditCard($scope.profile.newCard).then(function(card) {
                    //$log.debug("CheckoutController(): addPaymentMethod(): continuing to review after adding card", card);
                    $log.debug("CheckoutController(): addPaymentMethod(): continuing to review after adding card");
                    $scope.profile.card = angular.copy(card);
                    $scope.profile.newCard = null;

                    if (!$scope.profile.billSame) {
                        $log.debug("CheckoutController(): addPaymentMethod(): setting DIFFERENT billing address", $scope.profile.newBillingAddress);
                        // we need to create an address to add to the account for client direct
                        $scope.addBillingAddress($scope.profile.newBillingAddress).then(function(a) {
                            // only do the clear
                            $log.debug('CheckoutController(): addPaymentMethod(): added billing address, profile', $scope.profile);
                            $scope.profile.billing = angular.copy(a);
                            $scope.profile.newBillingAddress = {};
                            $scope.checkoutUpdated();
                            $scope.processing = false;
                            d.resolve(card);
                        }, function(err) {
                            $scope.billingAddressError = err;
                            $scope.processing = false;
                            d.reject(err);
                        });
                    } else {
                        $log.debug("CheckoutController(): addPaymentMethod(): billSame");
                        $scope.profile.billing = $scope.profile.shipping;
                        $scope.checkoutUpdated();
                        d.resolve(card);
                        $scope.processing = false;
                    }
                }, function(err) {
                    $log.error("CheckoutController(): addPaymentMethod(): error");
                    alert('error adding card: ' + err);
                    $scope.processing = false;
                    d.reject(err);
                });
            } else {
                // we just add to checkout for online sponsoring
                $scope.profile.newCard.lastFour = $scope.profile.newCard.card.substr($scope.profile.newCard.card.length - 4);
                //$log.debug("CheckoutController(): addPaymentMethod(): saving the card to the checkout and continuing on", $scope.profile.newCard);
                $log.debug("CheckoutController(): addPaymentMethod(): saving the card to the checkout and continuing on");
                $scope.profile.card = angular.copy($scope.profile.newCard);

                if (!$scope.profile.billSame) {
                    $log.debug("CheckoutController(): addPaymentMethod(): setting billing address", $scope.profile.newBillingAddress);

                    // we just add to checkout for online sponsoring
                    Addresses.validateAddress($scope.profile.newBillingAddress).then(function(a) {
                        $log.debug("CheckoutController(): addPaymentMethod(): validated address", a);

                        $log.debug("CheckoutController(): addPaymentMethod(): setting consultant billing address", a);
                        $scope.profile.billing = angular.copy(a);

                        $scope.checkoutUpdated();
                        //WizardHandler.wizard('checkoutWizard').goTo('Review');
                        d.resolve();
                        $scope.processing = false;
                    }, function(r) {
                        $log.error("CheckoutController(): addPaymentMethod(): error validating address", r);
                        // FIXME - failed to add, show error
                        d.reject(r);
                        $scope.processing = false;
                        $scope.billingAddressError = r.message;
                    });
                } else {
                    // copy, in case we need to re-copy from a back button from review page
                    $scope.profile.billing = angular.copy($scope.profile.shipping);

                    $scope.checkoutUpdated();
                    //WizardHandler.wizard('checkoutWizard').goTo('Review');
                    d.resolve();
                    $scope.processing = false;
                }
            }

            return d.promise;
        }

        $scope.removeCreditCard = function(creditCardId) {
            var d = $q.defer();
            $log.debug('CheckoutController(): removePaymentMethod(): cc data', creditCardId);
            $scope.processing = true;
            CreditCards.removeCreditCard(creditCardId).then(function() {
                $log.debug("CheckoutController(): removePaymentMethod(): cc removed", creditCardId);
                if ($scope.profile.card && $scope.profile.card.id == creditCardId) {
                    $scope.profile.card = {};
                }
                $scope.processing = false;
                d.resolve();
                $scope.checkoutUpdated();
            }, function(error) {
                $log.error('CheckoutController(): removePaymentMethod()', error);
                d.reject(error);
                $scope.processing = false;
            });
            return d.promise;
        };

        $scope.modifyPayment = function() {
            WizardHandler.wizard('checkoutWizard').goTo('Start');
        }

        $scope.editCreditCard = function(card) {
            var dd = $q.defer();

            //$log.debug("CheckoutController(): editCreditCard()", card);
            $log.debug("CheckoutController(): editCreditCard()");

            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "editCreditCardModal",
                templateUrl: '/partials/checkout/card-edit-modal.html',
                controller: 'EditCreditCardModalController',
                resolve: {
                    creditCard: function() {
                        return card;
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(result) {
                $log.debug("CheckoutController(): editCreditCard(): edit card modal closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                if (result.creditCard) {
                    $scope.profile.card = result.creditCard;
                }

                dd.resolve(result);
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");

            return dd.promise;
        }

        // FIXME - only supports Online Sponsoring currently
        $scope.updatePaymentMethod = function() {
            if (debug) {
                //$log.debug("CheckoutController(): updatePaymentMethod(): debug, adding card to checkout", $scope.profile.newCard);
                $log.debug("CheckoutController(): updatePaymentMethod(): debug, adding card to checkout");
                $scope.profile.card = angular.copy($scope.profile.newCard);

                // close any modals
                angular.element('.modal').modal('hide');

                return;
            }

            if ($scope.isOnlineSponsoring) {
                // we just add to checkout for online sponsoring
                $scope.profile.newCard.lastFour = $scope.profile.newCard.card.substr($scope.profile.newCard.card.length - 4);
                //$log.debug("CheckoutController(): updatePaymentMethod(): saving the card to the checkout and continuing on", $scope.profile.newCard);
                $log.debug("CheckoutController(): updatePaymentMethod(): saving the card to the checkout and continuing on");
                $scope.profile.card = angular.copy($scope.profile.newCard);

                // no need to update sales tax, because we just updated the card, not the address
                $scope.checkoutUpdated();

                // close any modals
                angular.element('.modal').modal('hide');
            }
        }

        function fetchSalesTax() {
            var defer = $q.defer();

            if ($scope.profile.shipping) {
                $log.debug("CheckoutController(): fetchSalesTax(): fetching sales tax for item", $scope.cart, $scope.profile.shipping.geocode, 'profile.qnc?', $scope.profile.qnc);

                // build sales tax calculation
                var products = [];
                for (var i=0; i < $scope.cart.length; i++) {
                    var item = $scope.cart[i];
                    products.push({
                        "sku": item.product.sku,
                        "qty": parseInt(item.quantity)
                    });
                }

                if ($scope.isOnlineSponsoring) {
                    SalesTax.calculate(0, 0, $scope.profile.shipping.geocode, 1414, "P", products).then(function(info) {
                        $log.debug("CheckoutController(): fetchSalesTax()", info);
                        defer.resolve(info);
                    }, function(err) {
                        $log.error("CheckoutController(): fetchSalesTax()", err);
                        defer.reject(err);
                    });
                } else {
                    SalesTax.calculate( $rootScope.session.client.id, getConsultantId(), $scope.profile.shipping.geocode, 1510, "Y", products).then(function(info) {
                        $log.debug("CheckoutController(): fetchSalesTax()", info);
                        defer.resolve(info);
                    }, function(err) {
                        $log.error("CheckoutController(): fetchSalesTax()", err);
                        defer.reject(err);
                    });
                }
            } else {
                defer.reject('Unable to lookup address');
            }
            return defer.promise;
        };

        $scope.isValidCard = function(card) {
            if (card == null || S(card).isEmpty()) {
                //$log.debug("empty", card);
                return false;
            }
            var res = CreditCards.validateCard(card);
            //$log.debug("valid", res.valid, card);
            return res.valid;
        }

        $scope.$watch('profile.newCard.card', function(newVal, oldVal) {
            if (newVal != null) {
                //$log.debug("CheckoutController(): cardChanged()", newVal);
                var res = CreditCards.validateCard($scope.profile.newCard.card);
                $scope.profile.newCard.cardType = res.type;
            } else if ($scope.profile.newCard) {
                //$log.debug("CheckoutController(): cardChanged()", newVal);
                $scope.profile.newCard.cardType = null;
            }
        });

        $scope.$watch('profile.newCard.expMonth', function(newVal, oldVal) {
            cardExpirationChanged();
        });
        $scope.$watch('profile.newCard.expYear', function(newVal, oldVal) {
            cardExpirationChanged();
        });

        $scope.processOrder = function() {
            $log.debug("CheckoutController(): processOrder(): checkout", $scope.checkout);
            //$log.debug("CheckoutController(): processOrder(): profile", $scope.profile);

            $scope.processing = true;
            $scope.orderError = null;

            if ($scope.isOnlineSponsoring) {
                if (debug) {
                    // need to add
                    //$log.debug("CheckoutController(): processOrder(): debug, adding card to checkout", $scope.profile.newCard);
                    $log.debug("CheckoutController(): processOrder(): debug, adding card to checkout");
                    $scope.profile.card = angular.copy($scope.profile.newCard);
                    // WizardHandler.wizard('checkoutWizard').goTo('Finish');
                    // $scope.processing = false;
                    // return;
                }

                var dob = $scope.profile.dob.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3');
                var ssn = $scope.profile.ssn.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
                var phone = $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

                $scope.profile.card.cardType = CreditCards.validateCard($scope.profile.card.card).type;
                $scope.profile.shipping.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                $scope.profile.billing.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                $scope.profile.shipping.phone = phone;
                $scope.profile.billing.phone = phone;

                
                // uppercase everything we need for JCS (names, addresses)
                var billing = angular.copy($scope.profile.billing);
                billing.address1 ? billing.address1 = billing.address1.toUpperCase(): false;
                billing.address2 ? billing.address2 = billing.address2.toUpperCase(): false;
                billing.city ? billing.city = billing.city.toUpperCase(): false;
                billing.county ? billing.county = billing.county.toUpperCase(): false;
                billing.state ? billing.state = billing.state.toUpperCase(): false;
                billing.stateDescription ? billing.stateDescription = billing.stateDescription.toUpperCase(): false;
                billing.name ? billing.name = billing.name.toUpperCase(): false;

                var shipping = angular.copy($scope.profile.shipping);
                shipping.address1 ? shipping.address1 = shipping.address1.toUpperCase(): false;
                shipping.address2 ? shipping.address2 = shipping.address2.toUpperCase(): false;
                shipping.city ? shipping.city = shipping.city.toUpperCase(): false;
                shipping.county ? shipping.county = shipping.county.toUpperCase(): false;
                shipping.state ? shipping.state = shipping.state.toUpperCase(): false;
                shipping.stateDescription ? shipping.stateDescription = shipping.stateDescription.toUpperCase(): false;
                shipping.name ? shipping.name = shipping.name.toUpperCase(): false;

                var fullName = ($scope.profile.firstName + " " + $scope.profile.lastName).toUpperCase();
                $log.debug("CheckoutController(): processOrder(): businessCO", shipping);

                // strip first name if necessary
                if (shipping.businessCO && !S(shipping.businessCO).isEmpty()) {
                    shipping.businessCO.replace(new RegExp("^"+fullName), "");
                }

                // handle c/o & business name, etc.
                if (shipping.businessCO && !S(shipping.businessCO).isEmpty()) {
                    $log.debug("CheckoutController(): processOrder(): found business/co, shuffling fields");

                    // we have changed something and need to modify address1 to be this and address2 to be everything else
                    var add1 = shipping.address1;
                    var add2 = shipping.address2;

                    shipping.address2 = add1;
                    if (!S(add2).isEmpty()) {
                        shipping.address2 += " " + add2;
                    }
                    shipping.address1 = shipping.businessCO.toUpperCase();
                }

                var sponsorId = $scope.profile.sponsorId ? $scope.profile.sponsorId + '' : 0;

                var consultant = {
                    ssn: ssn,
                    email: $scope.profile.loginEmail,
                    firstName: $scope.profile.firstName.toUpperCase(),
                    lastName: $scope.profile.lastName.toUpperCase(),
                    dateOfBirth: dob,
                    sponsorId: sponsorId,
                    language: $scope.profile.language,
                    source: $scope.profile.source,
                    phone: phone,
                    billingAddress: billing,
                    shippingAddress: shipping,
                    creditCard: angular.copy($scope.profile.card),
                    agreementAccepted: $scope.profile.agree+"",
                    total: parseFloat($scope.salesTaxInfo.Total),
                    products: [],
                    notificationPreferences: $scope.profile.notificationPreferences
                }
                
                
                // add starterkit to consultant.products
                var starterKit = _.findWhere($scope.starterKits, {sku: $scope.cart[0].product.sku});
                console.log('starterKit',starterKit);
                var components = [];
                for (var i = 0; i < starterKit.contains.length; i++) {
                    components.push(
                        {sku: starterKit.contains[i].productId, qty: starterKit.contains[i].quantity}
                    );
                }
                consultant.products.push({
                    qty: 1,
                    sku: starterKit.id,
                    kitSelections: {},
                    components: components
                });
                
                
                $log.debug('QNC DEBUG! consultant.products:', consultant.products);
                // add qnc products to consultant.products
                if ($scope.profile.qnc) {
                    $log.debug('QNC: $scope.cart.length',$scope.cart.length);
                    for (var i = 1; i < $scope.cart.length; i++) { //must start at index = 1 first!
                        var qncProduct = _.findWhere($scope.qncProducts, {
                            sku : $scope.cart[i].product.sku
                        });
                        console.log('qncProduct', qncProduct);
                        //create components of the product
                        var components = [];
                        for (var j = 0; j < qncProduct.contains.length; j++) {
                            components.push({
                                sku : qncProduct.contains[j].productId,
                                qty : qncProduct.contains[j].quantity
                            });
                        }
                        consultant.products.push({
                            qty: 1,
                            sku: qncProduct.sku,
                            kitSelections: {},
                            components: components
                        });
                    }
                }
                
                $log.debug("CheckoutController(): processOrder(): consultant.products", consultant.products);

                
                consultant.creditCard.cvv = parseInt(consultant.creditCard.cvv);

                $log.debug("CheckoutController(): processOrder(): creating consultant", consultant);

                if (!debug) {
                    Consultant.create(consultant).then(function(data) {
                        $log.debug("CheckoutController(): loginOrCreateUser(): created consultant, moving to next step", data);

                        // jump to Shipping
                        $scope.confirmation = {
                            orderId: data.orderId,
                            consultantId: data.consultantId,
                            sponsor: data.sponsor
                        };
                        // set quantcast data for order
                        $log.debug('---------------------------');
                        $log.debug('CheckoutController(): processOrder(): setting quant data:', 'orderId:', data.orderId, 'total:', consultant.total, 'consultant:', consultant);
                        $log.debug('---------------------------');
                        if ($scope.isOnlineSponsoring) {
                            qcdata.orderid = data.orderId;
                            qcdata.revenue = data.total;
                        }
                        // go to finish
                        WizardHandler.wizard('checkoutWizard').goTo('Finish');

                        //make modal appear on Finish
                        // $('#myPromoModal').modal('show'); REMOVED PER FEEDBACK BY CLIENT, 2015-01-26
                        
                        // remove the created lead
                        Leads.remove({
                            email: $scope.profile.loginEmail
                        }).$promise.then(function(lead) {
                            $log.debug("CheckoutController(): processOrder(): lead removed");
                            $log.debug("CheckoutController(): processOrder(): denote order completed");
                            $scope.orderCompleted = true;
                        });
                        
                        $scope.processing = false;
                        $log.debug('CheckoutController(): finished creating consultant');
                    }, function(error) {
                        $log.error("CheckoutController(): processOrder(): failed to create consultant", error);

                        if (error.errorCode == "accountAlreadyExists") {
                            $translate('EMAIL_EXISTS').then(function (message) {
                                $scope.orderError = message;
                            });
                        } else if (error.errorCode == "invalidEmailAddress") {
                            $translate('INVALID-EMAIL').then(function (message) {
                                $scope.orderError = message;
                            });
                        } else if (error.errorCode == "invalidPassword") {
                            $translate('INVALID-PASSWORD').then(function (message) {
                                $scope.orderError = message;
                            });
                        } else {
                            $translate('ORDER-PROBLEM').then(function (message) {
                                $scope.orderError = message;
                            });
                        }
                        $scope.processing = false;
                    });
                } else {
                    WizardHandler.wizard('checkoutWizard').goTo('Finish');
                    $scope.processing = false;
                    return;
                }

                /**
                 * {
                 "email" : "arimus5@gmail.com",
                 "firstName": "David",
                 "lastName": "Castro",
                 "language": "en_US",
                 "ssn": "222-11-1116",
                 "dateOfBirth": "12/12/1978",
                 "phone": "555-333-2222",
                 "billingAddress": {
                    "name": "David Castro",
                    "address1": "7661 Indian Canyon Cir",
                    "address2": "",
                    "city": "Corona",
                    "state": "CA",
                    "stateDescription": "CA",
                    "zip": "92880",
                    "county": "Riverside",
                    "country": "US",
                    "geocode": "000000",
                    "phone": "555-333-2222"
                },
                "shippingAddress": {
                    "name": "David Castro",
                    "address1": "7661 Indian Canyon Cir",
                    "address2": "",
                    "city": "Corona",
                    "state": "CA",
                    "stateDescription": "CA",
                    "zip": "92880",
                    "county": "Riverside",
                    "country": "US",
                    "geocode": "000000",
                    "phone": "555-333-2222"
                },
                "creditCard": {
                    "name": "Dave Castro",
                    "card": "4111111111111111",
                    "expMonth": "12",
                    "expYear": "2015",
                    "cvv": "1111"
                },
                 "agreementAccepted": "true",
                 "source": "facebook",
                 "total": 19.50,
                 "products": [
                     {
                         "sku": "25386",
                         "qty": 1
                     }
                 ]
                }
                */
            } else {
                // Client Direct

                $scope.profile.card.cardType = CreditCards.validateCard($scope.profile.card.card).type;

                // generate the components
                var products = [];

                $log.debug("CheckoutController(): processOrder(): creating order from cart", $scope.cart);

                for (var i=0; i < $scope.cart.length; i++) {
                    var item = $scope.cart[i];
                    $log.debug("CheckoutController(): processOrder(): processing cart item", item, "product", item.product, item.product.contains);

                    var components = [];

                    if (item.product.contains) {
                        for (var j=0; j < item.product.contains.length; j++) {
                            var contains = item.product.contains[j];
                            $log.debug("CheckoutController(): processOrder(): contained product", contains);
                            if (contains.product) {
                                components.push({
                                    sku: contains.product.sku,
                                    qty: contains.quantity
                                });
                            }
                        }
                    }
                    $log.debug("CheckoutController(): processOrder(): have components", components);

                    var d = {
                        sku: item.sku,
                        qty: item.quantity
                    };

                    if (item.product.type == 'kit') {
                        d["kitSelections"] = item.kitSelections;
                        d["components"] = components;
                    }

                    products.push(d);
                }

                // FIXME - make sure we have a client ID (aka the user is logged in)

                var consultantId = getConsultantId();

                //{
                //    "firstName": "John",         // required
                //    "lastName": "Smith",         // required
                //    "clientId": 237654,          // required
                //    "consultantId": 11111,       // required
                //    "language": "en_US",         // required
                //    "billingAddressId": 326754,  // required
                //    "shippingAddressId": 326755, // required
                //    "creditCardId": 74545,       // required
                //    "source": "facebook",        // required
                //    "total": 102.67,             // required
                //    "products": [                // required
                //    ]
                //}
                var order = {
                    firstName: $rootScope.session.client.firstName.toUpperCase(),
                    lastName: $rootScope.session.client.lastName.toUpperCase(),
                    clientId: $rootScope.session.client.id,
                    consultantId: consultantId,
                    language: $rootScope.session.client.language,
                    billingAddressId: $scope.profile.billing.id,
                    shippingAddressId: $scope.profile.shipping.id,
                    creditCardId: $scope.profile.card.id,
                    source: $scope.profile.source,
                    total: parseFloat($scope.salesTaxInfo.Total),
                    products: products,
                    notificationPreferences: $scope.profile.notificationPreferences
                };

                $log.debug("CheckoutController(): processOrder(): creating order", order);

                if (!debug) {
                    Order.create(order).then(function(result) {
                        var product;
                        $log.debug("CheckoutController(): loginOrCreateUser(): created order, moving to next step", result);

                        // jump to Shipping
                        $scope.confirmation = {
                            orderId: result.orderId,
                            consultantId: consultantId
                        };

                        $log.debug('CheckoutController(): Google Analaytics: adding transaction...');
                        ga('ecommerce:addTransaction', {
                            id: result.orderId,
                            affiliation: ($scope.isOnlineSponsoring ? 'Online Sponsoring' : 'Client Direct'),
                            revenue: $scope.salesTaxInfo.SubTotal,
                            shipping: $scope.salesTaxInfo.SH,
                            tax: $scope.salesTaxInfo.TaxAmount
                        });

                        // order success, track with ga ecommerce
                        for (var i = 0; i < $scope.cart.length; i++) {
                            product = $scope.cart[i];

                            $log.debug('CheckoutController(): cart product add to analytics:', product);

                            // add item to ga ecommerce
                            ga('ecommerce:addItem', {
                              id: result.orderId,
                              name: product.name,
                              sku: product.sku,
                              price: product.product.currentPrice.price,
                              quantity: product.quantity
                            });
                        }

                        // send & clear ga ecommerce data
                        ga('ecommerce:send');
                        ga('ecommerce:clear');

                        WizardHandler.wizard('checkoutWizard').goTo('Finish');
                        $scope.processing = false;
                    }, function(error) {
                        $log.error("CheckoutController(): processOrder(): failed to create order", error);
                        $scope.orderError = error.message;
                        $scope.processing = false;
                    });
                } else {
                    WizardHandler.wizard('checkoutWizard').goTo('Finish');
                    $scope.processing = false;
                    return;
                }
            }
        }

        function getConsultantId() {
            $log.debug('CheckoutController(): getConsultantId(): $scope.profile:', $scope.profile);
            $log.debug('CheckoutController(): getConsultantId(): $rootScope.session.consultantId:', $rootScope.session.consultantId);
            var consultantId = $rootScope.session.consultantId;
            $log.debug('CheckoutController(): getConsultantId(): consultantId:', consultantId);
            if (!consultantId) {
                // FIXME - handle multiple consultant IDs - dialog?
                $log.debug('CheckoutController(): getConsultantId(): $scope.profile.consultantIdSelection:', $scope.profile.consultantIdSelection);
                if ($scope.profile.consultantIdSelection) {
                    consultantId = $scope.profile.consultantIdSelection;
                    $log.debug('CheckoutController(): getConsultantId(): $scope.consultantIdSelection:', $scope.profile.consultantIdSelection);
                } else if ($rootScope.session.client.consultantIds && $rootScope.session.client.consultantIds.length > 0) {
                    consultantId = $rootScope.session.client.consultantIds[0].id;
                    $log.debug('CheckoutController(): getConsultantId(): consultantId:', consultantId);
                } else if ($rootScope.session.client.lastConsultantId && consultantId == null) {
                    // consultantId = $rootScope.session.client.lastConsultantId; //lastConsultantId not defined!
                    $log.debug('CheckoutController(): getConsultantId(): last else:', consultantId);
                    consultantId = 0;
                }
            }
            $log.debug('CheckoutController(): getConsultantId(): consultantId:', consultantId);
            return consultantId;
        }

        $scope.selectShippingAddressAndContinue = function(address) {
            $log.debug("CheckoutController(): selectShippingAddressAndContinue(): setting shipping to", address);
            $scope.processing = true;
            if (address.name === $rootScope.namePlaceholder) {
                delete address.name;
            }
            $scope.selectShippingAddress(address); //assigns $scope.profile.shipping
            fetchSalesTax().then(function(salesTaxInfo) {
                $log.debug("CheckoutController(): selectShippingAddressAndContinue(): got sales tax info", salesTaxInfo);
                $scope.salesTaxInfo = salesTaxInfo; 
                $scope.checkoutUpdated();

                if ($scope.profile.billSame) {
                    $log.debug("CheckoutController(): selectShippingAddressAndContinue(): setting consultant billing address");
                    $scope.profile.billing = angular.copy(address);
                    $scope.profile.newBillingAddress = {};
                }

                // WizardHandler.wizard('checkoutWizard').goTo('Payment');
                // do nothing but highlight the selected shipping address
                //hide add new shipping view
                $scope.processing = false;
                
                
            }, function(err) {
                $log.error("CheckoutController(): selectShippingAddressAndContinue(): failed to get sales tax info", err);
                $translate('SALES-TAX-ERROR').then(function (message) {
                    $scope.orderError = message;
                    $scope.processing = false;
                    $scope.salesTaxInfo = null;
                });
            });
        };

        $scope.addShippingAddressAndContinue = function(address) {
            var d = $q.defer();
            $log.debug("CheckoutController(): addShippingAddressAndContinue()", address);
            $scope.processing = true;
            
            $scope.addShippingAddress(address).then(function(aa) {

                if ($scope.isOnlineSponsoring) {
                    $scope.profile.shipping = angular.copy(aa);
                    if ($scope.profile.billSame) {
                        $log.debug("CheckoutController(): addShippingAddressAndContinue(): setting billing address", aa);
                        $scope.profile.billing = angular.copy(aa);
                        $scope.profile.newBillingAddress = {};
                    }
                }

                fetchSalesTax().then(function(salesTaxInfo) {
                    $log.debug("CheckoutController(): addShippingAddressAndContinue(): got sales tax info", salesTaxInfo);
                    $scope.salesTaxInfo = salesTaxInfo;
                    $scope.checkoutUpdated();
                    // WizardHandler.wizard('checkoutWizard').goTo('Payment');
                    
                    $scope.processing = false;
                    // save our name, remove everything else
                    // clear address in case of back/forward save action & set pristine
                    // $scope.forms.shippingForm.$setPristine(); //uncomment rees
                    $scope.profile.newShippingAddress = {
                        name : $scope.profile.newShippingAddress.name
                    };

                    d.resolve(address);
                }, function(err) {
                    $log.error("CheckoutController(): addShippingAddressAndContinue(): failed to get sales tax info", err);
                    $translate('SALES-TAX-ERROR').then(function (message) {
                        $scope.processing = false;
                        $scope.orderError = message;
                        $scope.salesTaxInfo = null;
                    });
                });
            });
            return d.promise;
        };

        $scope.addShippingAddress = function(address) {
            $log.debug("CheckoutController(): addShippingAddress()", address);
            var d = $q.defer();
            $scope.processing = true;
            addAddress(address).then(function(a) {
                if ($scope.isOnlineSponsoring) {
                    $log.debug("CheckoutController(): addShippingAddress(): setting consultant shipping address", a);
                    $scope.profile.shipping = angular.copy(a);
                    $scope.profile.newShippingAddress = angular.copy(a);
                    if ($scope.profile.billSame) {
                        $log.debug("CheckoutController(): addShippingAddress(): setting consultant billing address", a);
                        $scope.profile.billing = angular.copy(a);
                        $scope.profile.newBillingAddress = {};
                    }
                    $scope.processing = false;
                    d.resolve(a);
                } else {
                    $log.debug("CheckoutController(): addShippingAddress(): setting client shipping address", a);
                    $scope.profile.shipping = angular.copy(a);
                    if ($scope.profile.billSame) {
                        $log.debug("CheckoutController(): addShippingAddress(): setting client billing address", a);
                        $scope.profile.billing = angular.copy(a);
                        $scope.profile.newBillingAddress = {};
                    }

                    $scope.processing = false;
                    d.resolve(a);
                }
            }, function(err) {
                $scope.processing = false;
                d.reject(err);
            });

            return d.promise;
        }

        $scope.addBillingAddress = function(address) {
            $log.debug("CheckoutController(): addBillingAddress()", address);
            var d = $q.defer();

            $scope.processing = true;

            addAddress(address).then(function(a) {
                if ($scope.isOnlineSponsoring) {
                    $log.debug("CheckoutController(): addBillingAddress(): setting consultant billing address", a);
                    $scope.profile.billSame = false;
                    $scope.profile.billing = angular.copy(a);

                    // set the addresses
                    $scope.profile.newBillingAddress = angular.copy(a);

                    $scope.processing = false;
                    d.resolve(a);
                } else {
                    $scope.profile.billSame = false;
                    $scope.profile.billing = angular.copy(a);

                    // clear the form versions
                    $scope.profile.newBillingAddress = {};

                    $scope.processing = false;
                    d.resolve(a);
                }
            }, function(err) {
                $scope.processing = false;
                d.reject(err);
            });

            return d.promise;
        }

        function addAddress(address) {
            var d = $q.defer();
            $log.debug("CheckoutController(): addAddress()", address);
            $scope.shippingAddressError = "";
            if (debug) {
                populateDebugShippingData(address);
                // WizardHandler.wizard('checkoutWizard').goTo('Payment');
                d.resolve();
                return d.promise;
            }
            $log.debug("CheckoutController(): addAddress(): validating address", address);

            Addresses.addAddressWithChecks(address, $scope.isOnlineSponsoring).then(function(a) {
                $log.debug("CheckoutController(): addAddress(): success", a);
                d.resolve(a);
            }, function(r) {
                $log.error("CheckoutController(): addAddress(): error validating address", r);

                // FIXME - we need to translate the error code into an error message
                // validateAddressFailed - invalid address
                // invalidGeocode, geocodeSelectionFailed, addressCorrectionFailed, addressCorrectionCanceled - problem validating address
                if (r.errorCode == 'validateAddressFailed') {
                    $translate('INVALID_ADDRESS').then(function (message) {
                        $scope.shippingAddressError = message;
                        d.reject(message);
                    });
                }else{
                    $translate('PROBLEM_VALIDATING_ADDRESS').then(function (message) {
                        $scope.shippingAddressError = message;
                        d.reject(message);
                    });
                }
                
            });
            return d.promise;
        }

        $scope.removeAddress = function(addressId) {
            var d = $q.defer();
            $log.debug('CheckoutController(): removeAddress(): address data', addressId);
            $scope.processing = true;
            $scope.removingAddress = true;
            $scope.removingAddressId = addressId;
            Addresses.removeAddress(addressId).then(function() {
                $log.debug("CheckoutController(): removeAddress(): address removed", addressId);
                if ($scope.profile.shipping != null && $scope.profile.shipping.id == addressId) {
                    $scope.profile.shipping = null;
                }
                if ($scope.profile.billing != null && $scope.profile.billing.id == addressId) {
                    $scope.profile.billing = null;
                }
                $scope.processing = false;
                $scope.removingAddress = false;
                $scope.removingAddressId = null;
                d.resolve();
                $scope.checkoutUpdated();
            }, function(err) {
                $log.error("CheckoutController(): removeAddress()", err);
                $scope.processing = false;
                $scope.removingAddress = false;
                $scope.removingAddressId = null;
                d.reject(err);
            });
            return d.promise;
        };

        $scope.setBillingAddress = function(address, isNew) {
            var d = $q.defer();
            $log.debug('CheckoutController(): setBillingAddress(): billing address data', address);

            $scope.processing = true;

            if (isNew) {
                Addresses.addAddress(address).then(function(a) {
                    $log.debug("CheckoutController(): addAddress(): address added", a);
                    $scope.profile.billing = angular.copy(a);
                    $scope.checkoutUpdated();
                    $scope.processing = false;
                    d.resolve(a);
                }, function(err) {
                    $log.error("CheckoutController(): addAddress(): failed to add address", err);
                    $scope.processing = false;
                    d.reject(err);
                });
            } else {
                $log.debug("CheckoutController(): addAddress(): setting address to existing address", address);
                $scope.profile.billing = angular.copy(address);
                $scope.checkoutUpdated();
                $scope.processing = false;
                d.resolve(address);
            }

            return d.promise;
        }

        $scope.logStep = function() {
            $log.debug("CheckoutController(): Step continued");
        }

        $scope.finished = function() {
            $log.debug("CheckoutController(): finished(): Checkout finished :)");
            $scope.currentStep = '';
            Checkout.clear().then(function() {
                $log.debug("CheckoutController(): finished(): Checkout cleared", $scope.checkout);
                $scope.checkoutUpdated();
            });
            Cart.clear().then(function() {
                $log.debug("CheckoutController(): finished(): Cart cleared", $scope.cart);
            });
            if (S($location.path()).startsWith(STORE_BASE_URL)) {
                $log.debug("CheckoutController(): finished(): redirecting back to store page");
                $location.path(STORE_BASE_URL).search('');
                $location.replace();
            }
        }

        $scope.forgotPassword = function() {
            $location.url(STORE_BASE_URL + "/forgotPassword");
        }

        /*==== CLEANUP ====*/
        function cleanup() {
            if (cancelChangeListener) {
                $log.debug("CheckoutController(): cleanup(): canceling change listener");
                cancelChangeListener();
            }
        }

        $scope.$on('$destroy', function() {
            cleanup();
        });

        /*==== DEBUG ====*/
        function populateDebugData() {
            // in debug, we just populate everything for testing
            
            $scope.profile = {
                source: "web",
                customerStatus: 'new',
                language: 'en_US',
                firstName: 'Joe',
                lastName: 'Test',
                loginEmail: 'arimus@gmail.com',
                loginPassword: 'password',
                dob: '01/01/1978',
                ssn: '111111111',
                phoneNumber: '5554448888',
                agree : true,
                newShippingAddress : {
                    "address1" : "7661 Indian Canyon Cir",
                    "address2" : "",
                    "city" : "Eastvale",
                    "county" : "Riverside",
                    "state" : "CA",
                    "stateDescription" : "CA",
                    "zip" : "92880",
                    "country" : "US",
                    "geocode" : "040609",
                    "name" : "David Castro",
                    "phone" : "987-983-7259",
                    "businessCO": "Someone c/o Jafra"
                },
                shipping : {
                    "address1" : "7661 Indian Canyon Cir",
                    "address2" : "",
                    "city" : "Eastvale",
                    "county" : "Riverside",
                    "state" : "CA",
                    "stateDescription" : "CA",
                    "zip" : "92880",
                    "country" : "US",
                    "geocode" : "040609",
                    "name" : "David Castro",
                    "phone" : "987-983-7259",
                    "businessCO": "Someone c/o Jafra"
                },
                newBillingAddress : {
                    "address1" : "7661 Indian Canyon Cir",
                    "address2" : "",
                    "city" : "Eastvale",
                    "county" : "Riverside",
                    "state" : "CA",
                    "stateDescription" : "CA",
                    "zip" : "92880",
                    "country" : "US",
                    "geocode" : "040609",
                    "name" : "David Castro",
                    "phone" : "987-983-7259",
                    "businessCO": "Someone c/o Jafra"
                },
                billing : {
                    "address1" : "7661 Indian Canyon Cir",
                    "address2" : "",
                    "city" : "Eastvale",
                    "county" : "Riverside",
                    "state" : "CA",
                    "stateDescription" : "CA",
                    "zip" : "92880",
                    "country" : "US",
                    "geocode" : "040609",
                    "name" : "David Castro",
                    "phone" : "987-983-7259",
                    "businessCO": "Someone c/o Jafra    "
                },
                "billSame" : true,
                newCard: {
                    name: "Test Name",
                    card: "4111111111111111",
                    expMonth: "12",
                    expYear: "2020",
                    cvv: "987",
                    cardType: "Visa"
                },
                card: {
                    name: "Test Name",
                    card: "4111111111111111",
                    expMonth: "12",
                    expYear: "2020",
                    cvv: "987",
                    cardType: "Visa"
                }
            };

            $scope.checkout = {
            };

            $scope.confirmation = {
                orderId: '123345678',
                consultantId: '11111111',
                "sponsor": {
                   "id": 1,
                   "email": "jsmith@gmail.com",
                   "firstName": "John",
                   "lastName": "Smith"
               }
            }

            $scope.salesTaxInfo = {
                "SubTotal": "99.00",
                "SH": "5.00",
                "TaxRate": "7.75",
                "TotalBeforeTax": "104.00",
                "TaxAmount": "17.00",
                "Total": "121.00"
            }

            // clear & add a product to the cart
            Cart.clear().then(function(cart) {
                $log.debug("CheckoutController(): populateDebugData(): previous cart cleared");

                Cart.addToCart({
                    name: "Royal Starter Kit (English)",
                    name_es_US: "Royal Starter Kit (Ingl&eacute;s)",
                    sku: "20495",
                    quantity: 1,
                    kitSelections: {},
                    components: []
                }).then(function(cart) {
                    $log.debug("CheckoutController(): populateDebugData(): online sponsoring SKU loaded & added to cart", cart);
                    $scope.cart = cart;
                }, function(error) {
                    $log.error("CheckoutController(): populateDebugData(): failed to update cart");
                });
            }, function(error) {
                $log.error("CheckoutController(): populateDebugData(): failed to update cart");
            });
        }

        $scope.debugDumpProfile = function() {
            $log.debug("profile", $scope.profile);
        }

        function populateDebugShippingData(address) {
            // add name here since we're not allowing user to input a name for shipping address manually;
            address.name = $scope.profile.firstName + " " + $scope.profile.lastName;
            address.phone = $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');

            $log.debug("CheckoutController(): populateDebugShippingData(): setting consultant shipping/billing address", address);
            $scope.profile.shipping = angular.copy(address);
            $scope.profile.billing = angular.copy(address);

            // set the addresses
            $scope.profile.newShippingAddress = angular.copy(address);

            $scope.checkoutUpdated();
        }
    });
