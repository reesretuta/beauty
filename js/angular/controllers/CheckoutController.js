
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
        $scope.sku = sku; //rees
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
        }

        // in memory on client only
        $scope.profile = {
            sponsorId: '',
            source: "web",
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
            billSame: true,
            agree: true,
            newCard: {},
            card: {}
        };

        // set current step
        $scope.currentStep = 'Start';

        if (urlStep == null || urlStep == "") {
            $location.search("step", 'Start');
            urlStep = "Start";
        }

        $scope.shippingAddressError = null;
        $scope.billingAddressError = null;

        $scope.setCustomerStatus = function(status) {
            $scope.profile.customerStatus = status;
        }

        $scope.invalidDOB = false;
        $scope.invalidSponsorId = false;

        $scope.processingOrder = false;

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
                // do focuses here
                // if (S(urlStep).trim() == "Shipping") {
                //     $("#shippingAddress1").onAvailable(function () {
                //         if (!$scope.isOnlineSponsoring) {
                //             var accountName = ($rootScope.session.client.firstName + ' ' + $rootScope.session.client.lastName);
                //             $log.debug('CheckoutController(): NOT Online Sponsoring: setting shipping name (default):', accountName);
                //             $scope.profile.newShippingAddress.name = accountName;
                //             $rootScope.namePlaceholder = accountName;
                //         }
                //         $log.debug("CheckoutController(): focusing address1 field");
                //         focus('shipping-address1-focus');
                //     });
                // } else {
                //     $log.debug("CheckoutController(): new step is not shipping", newVal);
                // }

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
                                    // make modal appear on start
                                    // $log.debug("CheckoutController(): Show myPromoModal");
                                    // $('#myPromoModal').modal('show');
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
                        } else {
                            $timeout(function() {
                                $log.debug("CheckoutController(): online sponsoring: loading Start step after delay");
                                WizardHandler.wizard('checkoutWizard').goTo('Start');
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
                            } else {
                                $timeout(function() {
                                    $log.debug("CheckoutController(): skipping to Start step after delay");
                                    //$location.search('step', 'Shipping');
                                    WizardHandler.wizard('checkoutWizard').goTo('Start');
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
                $log.debug("CheckoutController(): selectGeocodeModal(): select geocode modal closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                dd.resolve(result);
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");

            return dd.promise;
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
                        return address;
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(result) {
                $log.debug("CheckoutController(): showAddressCorrectionModal(): address correction modal closed");

                // move to next step
                // WizardHandler.wizard('checkoutWizard').goTo('Profile');

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                dd.resolve(result);
            }, function(r) {
                $log.debug("CheckoutController(): validated email");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                dd.resolve(result);
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");

            return dd.promise;
        }

        function addressFieldsEqual (field1, field2) {
            var f1 = field1 == null ? "" : field1.trim().toUpperCase();
            var f2 = field2 == null ? "" : field2.trim().toUpperCase();

            $log.debug("CheckoutController(): addressesEqual(): comparing", f1, f2);
            if (f1 == f2) {
                return true;
            }
            return false;
        }

        function addressesEqual(a, b) {
            if (!addressFieldsEqual(a.address1, b.address1) ||
                !addressFieldsEqual(a.address2, b.address2) ||
                !addressFieldsEqual(a.city, b.city) ||
                !addressFieldsEqual(a.state, b.state) ||
                !addressFieldsEqual(a.zip, b.zip))
            {
                $log.debug("CheckoutController(): addressesEqual(): false", a, b);
                return false;
            }

            $log.debug("CheckoutController(): addressesEqual(): true", a, b);
            return true;
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

            // check the zip for geocode for taxes
            Geocodes.query({zipCode: a.zip}).$promise.then(function(geocodes) {
                $log.debug("CheckoutController(): selectGeocodeAndAdd(): got geocodes", geocodes);
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
                    $log.debug("CheckoutController(): selectGeocodeAndAdd(): selecting only geocode returned");
                    a.geocode = geocodes[0].GEOCODE;
                    $scope.checkoutUpdated();

                    addAddressToBackend(a).then(function(aa) {
                        d.resolve(aa);
                    }, function(error) {
                        d.reject(error);
                    });
                } else if (matchedGeocode) {
                    $log.debug("CheckoutController(): selectGeocodeAndAdd(): selecting exact match geocode");
                    a.geocode = matchedGeocode.GEOCODE;
                    $scope.checkoutUpdated();

                    addAddressToBackend(a).then(function(aa) {
                        d.resolve(aa);
                    }, function(error) {
                        d.reject(error);
                    });
                } else {
                    // display a dialog for the user to choose the correct geocode here
                    selectGeocodeModal(geocodes).then(function(result) {
                        $log.debug("CheckoutController(): selectGeocodeAndAdd(): geocode selection dialog closed", result);

                        var geocode = result.geocode;
                        var canceled = result.canceled;

                        if (canceled) {
                            $log.error("CheckoutController(): selectGeocodeAndAdd(): geocode selection dialog canceled");
                            $translate('MUST-SELECT-ADDRESS').then(function (message) {
                                $scope.shippingAddressError = message;
                            });

                            d.reject('Must select an address');
                            return;
                        }

                        if (geocode) {
                            a.geocode = geocode.GEOCODE;

                            if (a.city.toUpperCase() != geocode.CITYDES && geocode.CITYDES) {
                                a.city = geocode.CITYDES;
                            }
                            $scope.checkoutUpdated();

                            addAddressToBackend(a).then(function(aa) {
                                d.resolve(aa);
                            }, function(error) {
                                d.reject(error);
                            });
                        } else {
                            $log.error("CheckoutController(): selectGeocodeAndAdd(): empty geocode");
                            $translate('UNABLE-TO-VERIFY-ADDRESS').then(function (message) {
                                $scope.shippingAddressError = message;
                            });
                            d.reject('Unable to verify address');
                        }
                    }, function(err) {
                        $log.error("CheckoutController(): selectGeocodeAndAdd(): failed to select geocode", err);
                        $translate('UNABLE-TO-VERIFY-ADDRESS').then(function (message) {
                            $scope.shippingAddressError = message;
                        });
                        d.reject(err);
                    });
                }
            }, function (r) {
                $log.error("CheckoutController(): selectGeocodeAndAdd(): error looking up geocode", r);
                $translate('UNABLE-TO-VERIFY-ADDRESS').then(function (message) {
                    $scope.shippingAddressError = message;
                });
                d.reject(r.errorMessage);
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
                // client direct, we add it
                if (a.id) {
                    Addresses.updateAddress(a).then(function(a) {
                        $log.debug("CheckoutController(): addAddressToBackend(): address updated", a);
                        d.resolve(a);
                    }, function(error) {
                        $log.error("CheckoutController(): addAddressToBackend(): failed to update address", error);
                        $scope.shippingAddressError = error;
                        d.reject(error);
                    });
                } else {
                    Addresses.addAddress(a).then(function(a) {
                        $log.debug("CheckoutController(): addAddressToBackend(): address added", a);
                        d.resolve(a);
                    }, function(error) {
                        $log.error("CheckoutController(): addAddressToBackend(): failed to add address", error);
                        $scope.shippingAddressError = error;
                        d.reject(error);
                    });
                }
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
                    // WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                    // $scope.selectShippingAddressAndContinue();
                    $scope.addShippingAddressAndContinue($scope.profile.newShippingAddress);
                    $scope.processing = false;
                } else {
                    // profile error
                    $log.debug("CheckoutController(): validateProfileAndContinue(): error with SSN");
                    $scope.processing = false;
                    $scope.profileSSNError = true;
                }
            }, function(error) {
               $log.error("CheckoutController(): validateProfileAndContinue()", error);
                $scope.processing = false;
               $scope.profileSSNError = true;
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
            $log.debug('CheckoutController(): editAddress: got address:', address, addressType);
            var d, body, dd = $q.defer();
            d = $modal.open({
                backdrop: true,
                keyboard: true,
                windowClass: 'editAddressModal',
                templateUrl: '/partials/checkout/modals/shipping-edit.html',
                controller: 'AddressEditModalController',
                resolve: {
                    address: function() {
                        return address;
                    },
                    addAddress: function() {
                        return addAddress;
                    },
                    namePlaceholder: function () {
                        return $scope.namePlaceholder;
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
                    language: $scope.profile.language
                }).then(function(session) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): created client, moving to next step", session.client);

                    // set the name on the shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                    $rootScope.namePlaceholder = $scope.profile.firstName + " " + $scope.profile.lastName;
                    
                    $scope.profile.customerStatus = 'existing';
                    $scope.checkoutUpdated();
                    // jump to Shipping
                    // WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                    $scope.validateProfileAndContinue();
                    $scope.processing = false;
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to create client", error);
                    $scope.loginError = "Error creating client";
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
            $log.debug("CheckoutController(): selectCardAndContinue(): profile now", $scope.profile);
            $scope.checkoutUpdated();
            //do nothing but highlight the selected credit card 
            // WizardHandler.wizard('checkoutWizard').goTo('Review');
        }

        $scope.showNewShipping = function(){
            $scope.profile.shipping = null;
        }
        
        $scope.showNewPayment = function(){
            $scope.profile.card = null;
        }
        
        
        function addOrSelectShipping() {
            var d = $q.defer();
            if ($scope.profile.shipping == null) {
                //new shipping
                $log.debug("CheckoutController(): singlePageValidate(): new shipping");
                $scope.addShippingAddressAndContinue($scope.profile.newShippingAddress).then(function(a) {
                    $log.debug("CheckoutController(): singlePageValidate(): new shipping", $scope.profile.newShippingAddress);
                    d.resolve(a);
                }, function(err) {
                    $log.err("CheckoutController(): singlePageValidate(): error", err);
                    d.reject(err);
                });
            } else {
                d.resolve();
            }
            return d.promise;
        }
        
        $scope.updateSku = function(sku){
            
            
            $scope.selectProduct(sku).then(function(){
                $log.debug("CheckoutController(): updateSku(): ", $scope.cart[0].sku);
            });
        }


        // FIXME - verify we have either billSame or billing address selected/entered

        function addOrSelectPayment(){ //responding back to continue button click
            
            var d = $q.defer();
            $log.debug("CheckoutController(): addOrSelectPayment(): $scope.profile.card: ", $scope.profile.card);
            if ($scope.profile.card == null) {
                $log.debug("CheckoutController(): addOrSelectPayment(): new card");
                // assume we have card in form, so add it
                $scope.addPaymentMethod().then(function() { //assumes NEW card, checks for profile.billSame
                    d.resolve();
                }, function(err) {
                    $log.err("CheckoutController(): addOrSelectPayment(): error adding payment", err)
                    d.reject(err);
                });
            } else {
                $log.debug("CheckoutController(): addOrSelectPayment(): existing card selected ");
                if ($scope.profile.billSame) {
                    $scope.addBillingAddress($scope.profile.shipping).then(function(){
                        d.resolve();
                    });
                }else{
                    $log.debug("CheckoutController(): addOrSelectPayment(): new card", $scope.profile.newBillingAddress);
                    $scope.addBillingAddress($scope.profile.newBillingAddress).then(function(){
                        d.resolve();
                    });
                }
            }
            return d.promise;
        }
        
        
        
        $scope.singlePageValidate = function() {
            $log.debug("CheckoutController(): singlePageValidate()");

            addOrSelectShipping().then(function() {
                addOrSelectPayment().then(function() {
                    WizardHandler.wizard('checkoutWizard').goTo('Review');
                }, function(err) {
                    // FIXME - display error message here
                    $log.err("CheckoutController(): singlePageValidate(): error adding/selecting payment", err)
                });
            }, function(err) {
               // FIXME - display error message here
                $log.err("CheckoutController(): singlePageValidate(): error adding/selecting shipment", err)
            });
        }
        
        
        // $scope.singlePageValidate = function() {
//             $log.debug("CheckoutController(): singlePageValidate()");
//             $scope.validateEmailAndContinue($scope.profile.loginEmail).then(function() {
//                 $log.debug("CheckoutController(): validateEmailAndContinue()");
//                 if ($scope.profile.shipping == null) {
//                     //new shipping
//                     $log.debug("CheckoutController(): singlePageValidate(): new shipping");
//                     $scope.addShippingAddressAndContinue($scope.profile.newShippingAddress).then(function() { //return promise
//
//                         $log.debug("CheckoutController(): singlePageValidate(): new shipping", $scope.profile.newShippingAddress);
//                         addOrSelectPayment(); //return promise
//
//                     });
//                 }else{
//                     //selected existing shipping
//                     $log.debug("CheckoutController(): singlePageValidate(): existing shipping");
//                     $scope.addShippingAddressAndContinue($scope.profile.shipping).then(function() { //
//                         $log.debug("CheckoutController(): singlePageValidate(): select Shipping Address()");
//                         addOrSelectPayment();
//                     })
//
//                 }
//
//             }, function (err) {
//
//             })
//         }
        
        
        
        
        $scope.addPaymentMethod = function() {
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


                var d = $q.defer();

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
                            //$log.debug('CheckoutController(): addPaymentMethod(): profile:', $scope.profile);
                            $scope.profile.billing = angular.copy(a);
                            // $scope.profile.newBillingAddress = null;
                            $scope.checkoutUpdated();
                            $log.debug('CheckoutController(): addPaymentMethod()');


                            $scope.processing = false;
                            d.resolve();
                        }, function(err) {
                            $scope.billingAddressError = err;
                            $scope.processing = false;
                            d.reject(err);
                        });
                    } else {
                        $scope.checkoutUpdated();
                        d.resolve();
                        $scope.processing = false;
                    }
                }, function(err) {
                    $log.error("CheckoutController(): addPaymentMethod(): error");
                    alert('error adding card: ' + err);
                    $scope.processing = false;
                    d.reject(err);
                });

                return d.promise;
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
                        WizardHandler.wizard('checkoutWizard').goTo('Review');
                        $scope.processing = false;
                    }, function(r) {
                        $log.error("CheckoutController(): addPaymentMethod(): error validating address", r);
                        // FIXME - failed to add, show error
                        $scope.processing = false;
                        $scope.billingAddressError = r.message;
                    });
                } else {
                    // copy, in case we need to re-copy from a back button from review page
                    $scope.profile.billing = angular.copy($scope.profile.shipping);

                    $scope.checkoutUpdated();
                    WizardHandler.wizard('checkoutWizard').goTo('Review');
                    $scope.processing = false;
                }
            }
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
            }, function(err) {
                $log.error("CheckoutController(): removePaymentMethod()", err);
                d.reject(err);
                $scope.processing = false;
            });

            return d.promise;
        }

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
                $log.debug("CheckoutController(): fetchSalesTax(): fetching sales tax for item", $scope.cart, $scope.profile.shipping.geocode);

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
                    SalesTax.calculate($rootScope.session.client.id, getConsultantId(), $scope.profile.shipping.geocode, 1510, "Y", products).then(function(info) {
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

                // generate the components
                var components = [];
                var productComponentMap = {
                    "20494": [{"sku":"25192","qty":1},{"sku":"25195","qty":1},{"sku":"25193","qty":1},{"sku":"25194","qty":1},{"sku":"25628","qty":1},{"sku":"25625","qty":1},{"sku":"25627","qty":1},{"sku":"25629","qty":1},{"sku":"12032","qty":1},{"sku":"25620","qty":1},{"sku":"15522","qty":1},{"sku":"25063","qty":1},{"sku":"12253","qty":1},{"sku":"9289","qty":1},{"sku":"2062","qty":1},{"sku":"11286","qty":1},{"sku":"124","qty":1},{"sku":"19862","qty":1},{"sku":"16725","qty":1},{"sku":"19038","qty":1},{"sku":"19496","qty":1},{"sku":"17865","qty":1},{"sku":"20402","qty":1},{"sku":"19975","qty":1},{"sku":"19865","qty":1},{"sku":"19980","qty":1},{"sku":"20378","qty":1},{"sku":"20456","qty":1},{"sku":"19952","qty":1},{"sku":"20385","qty":1},{"sku":"20381","qty":1},{"sku":"20383","qty":1},{"sku":"20401","qty":1},{"sku":"19536","qty":1}],
                    "20495": [{"sku":"25192","qty":1},{"sku":"25195","qty":1},{"sku":"25193","qty":1},{"sku":"25194","qty":1},{"sku":"25628","qty":1},{"sku":"25625","qty":1},{"sku":"25627","qty":1},{"sku":"25629","qty":1},{"sku":"12032","qty":1},{"sku":"25620","qty":1},{"sku":"15522","qty":1},{"sku":"25542","qty":1},{"sku":"12253","qty":1},{"sku":"9289","qty":1},{"sku":"2062","qty":1},{"sku":"11286","qty":1},{"sku":"124","qty":1},{"sku":"19862","qty":1},{"sku":"16725","qty":1},{"sku":"19039","qty":1},{"sku":"19061","qty":1},{"sku":"20403","qty":1},{"sku":"19976","qty":1},{"sku":"19867","qty":1},{"sku":"18996","qty":1},{"sku":"19244","qty":1},{"sku":"18373","qty":1},{"sku":"20382","qty":1},{"sku":"19953","qty":1},{"sku":"20386","qty":1},{"sku":"20384","qty":1},{"sku":"20401","qty":1},{"sku":"19537","qty":1}],
                    "20498": [{"sku":"25192","qty":1},{"sku":"25195","qty":1},{"sku":"25193","qty":1},{"sku":"25194","qty":1},{"sku":"15522","qty":1},{"sku":"25625","qty":1},{"sku":"19861","qty":1},{"sku":"19038","qty":1},{"sku":"19496","qty":1},{"sku":"20402","qty":1},{"sku":"19975","qty":1},{"sku":"19865","qty":1},{"sku":"19980","qty":1},{"sku":"20378","qty":1},{"sku":"20456","qty":1},{"sku":"20385","qty":1},{"sku":"20381","qty":1},{"sku":"20383","qty":1},{"sku":"20401","qty":1},{"sku":"19952","qty":1},{"sku":"19536","qty":1}],
                    "20499": [{"sku":"25192","qty":1},{"sku":"25195","qty":1},{"sku":"25193","qty":1},{"sku":"25194","qty":1},{"sku":"15522","qty":1},{"sku":"25625","qty":1},{"sku":"19861","qty":1},{"sku":"19039","qty":1},{"sku":"19035","qty":1},{"sku":"20403","qty":1},{"sku":"19976","qty":1},{"sku":"19867","qty":1},{"sku":"18991","qty":1},{"sku":"19244","qty":1},{"sku":"18373","qty":1},{"sku":"20382","qty":1},{"sku":"19953","qty":1},{"sku":"20386","qty":1},{"sku":"20384","qty":1},{"sku":"20401","qty":1},{"sku":"19953","qty":1},{"sku":"19537","qty":1}]
                };
                // 25214, 25208, 25212, and 25210 - qty 3
                
                // var productComponents = productComponentMap[$scope.cart[0].product.sku];
                //$scope.cart[0].product.sku is not part of productCompnentMap? 
                var productComponents = productComponentMap[sku];
                $log.debug("CheckoutController(): processOrder(): cart item", $scope.cart[0].product.sku, $scope.cart[0], "components", productComponents);

                for (var i=0; i < productComponents.length; i++) {
                    components.push({
                        sku: productComponents[i].sku,
                        qty: productComponents[i].qty
                    });
                }

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

                var sponsorId = $scope.profile.sponsorId ? $scope.profile.sponsorId : 66556;

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
                    products: [
                        {
                            "sku": $scope.cart[0].product.sku,
                            "qty": 1,
                            "kitSelections": {},
                            "components": components
                        }
                    ]
                }

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
                    products: products
                }

                $log.debug("CheckoutController(): processOrder(): creating order", order);

                if (!debug) {
                    Order.create(order).then(function(result) {
                        $log.debug("CheckoutController(): loginOrCreateUser(): created order, moving to next step", result);

                        // jump to Shipping
                        $scope.confirmation = {
                            orderId: result.orderId,
                            consultantId: consultantId
                        };

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
            var consultantId = $rootScope.session.consultantId;
            if (!consultantId) {
                // FIXME - handle multiple consultant IDs - dialog?
                if ($rootScope.session.client.consultantIds && $rootScope.session.client.consultantIds.length > 0) {
                    consultantId = $rootScope.session.client.consultantIds[0];
                }
            }
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
            if (address.name === $rootScope.namePlaceholder) {
                delete address.name;
            }
            $scope.addShippingAddress(address).then(function() {
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
                    
                    $scope.addPaymentMethod().then(function(){
                        d.resolve();
                    }); //progressing to next step
                    
                    //if CD do nothing but create CC on backend do not progress
                    
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
                        $scope.profile.newBillingAddress = angular.copy(a);
                    }
                    $scope.processing = false;
                    d.resolve(a);
                } else {
                    $log.debug("CheckoutController(): addShippingAddress(): setting client shipping address", a);
                    $scope.profile.shipping = angular.copy(a);
                    if ($scope.profile.billSame) {
                        $log.debug("CheckoutController(): addShippingAddress(): setting client billing address", a);
                        $scope.profile.billing = angular.copy(a);
                        $scope.profile.newBillingAddress = null;
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
                    $scope.profile.newBillingAddress = null;

                    $scope.processing = false;
                    d.resolve(a);
                }
            }, function(err) {
                $scope.processing = false;
                d.reject(err);
            });

            return d.promise;
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
                $log.debug("CheckoutController(): showAddressCorrectionModal(): address correction modal closed");
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
                $log.debug("CheckoutController(): selectGeocodeModal(): select geocode modal closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                dd.resolve(result);
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");

            return dd.promise;
        }

        function addressFieldsEqual(field1, field2) {
            var f1 = field1 == null ? "" : field1.trim().toUpperCase();
            var f2 = field2 == null ? "" : field2.trim().toUpperCase();

            $log.debug("CheckoutController(): addressesEqual(): comparing", f1, f2);
            if (f1 == f2) {
                return true;
            }
            return false;
        }

        function addressesEqual(a, b) {
            if (!addressFieldsEqual(a.address1, b.address1) ||
                !addressFieldsEqual(a.address2, b.address2) ||
                !addressFieldsEqual(a.city, b.city) ||
                !addressFieldsEqual(a.state, b.state) ||
                !addressFieldsEqual(a.zip, b.zip))
            {
                $log.debug("CheckoutController(): addressesEqual(): false", a, b);
                return false;
            }

            $log.debug("CheckoutController(): addressesEqual(): true", a, b);
            return true;
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

            Addresses.validateAddress(address).then(function(a) {
                $log.debug("CheckoutController(): addAddress(): validated address", a);
                // if this address was validated and corrected, then we need to inform the user
                if (!addressesEqual(address, a)) {
                    showAddressCorrectionModal(a).then(function(result) {
                        var address = result.address;
                        var canceled = result.canceled;
                        $log.debug("CheckoutController(): addAddress(): address correction modal closed", address);
                        if (canceled) {
                            $log.debug("CheckoutController(): addAddress(): address correction canceled");
                            d.reject("Address correction canceled");
                            return;
                        }
                        selectGeocodeAndAdd(address).then(function(aa) {
                            $log.debug("CheckoutController(): addAddress(): selected geocode and added address", aa);
                            d.resolve(aa);
                        }, function(error) {
                            $log.error("CheckoutController(): addAddress(): select geocode and add failed", error);
                            $scope.shippingAddressError = error;
                            $scope.addressError = error;
                            d.reject(error);
                        });
                    }, function(error) {
                        $log.error("CheckoutController(): addAddress(): address not corrected");
                        $scope.shippingAddressError = error;
                        d.reject(error);
                    });
                } else {
                    selectGeocodeAndAdd(a).then(function(aa) {
                        $log.debug("CheckoutController(): addAddress(): selected geocode and added address", aa);
                        d.resolve(aa);
                    }, function(error) {
                        $log.debug("CheckoutController(): addAddress(): select geocode and add failed", error);
                        $scope.shippingAddressError = error;
                        d.reject(error);
                    });
                }
            }, function(r) {
                $log.error("CheckoutController(): addAddress(): error validating address", r);
                $scope.shippingAddressError = r.message;
                d.reject(r.errorMessage);
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
                    sku: "19634",
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
