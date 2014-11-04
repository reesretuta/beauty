angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($location, $scope, $document, $timeout, $rootScope, $anchorScroll, $routeParams, $modal, $log, $q, STORE_BASE_URL, JOIN_BASE_URL, focus, Geocodes, Session, Addresses, OrderHelper, Checkout, Cart, Products, SalesTax, CreditCards, HashKeyCopier, WizardHandler) {

        $log.debug("CheckoutController()");

        $scope.cartLoaded = false;
        $rootScope.inCheckout = true;

        var params = $location.search();
        $log.debug("CheckoutController(): params", params);

        var urlStep = S(params.step != null ? params.step : "Start").toString();
        var debug = params.debug;
        $scope.debug = debug;
        $log.debug("CheckoutController(): urlStep", urlStep);

        var onlineSponsorChecksCompleteDefer = $q.defer();
        var path = $location.path();
        $log.debug("CheckoutController(): path", path);

        // get the sku, add the product to cart
        var sku = S($routeParams.sku != null ? $routeParams.sku : "").toString();
        $log.debug("CheckoutController(): loading sku=", sku);

        //change page title
        $rootScope.title = "Checkout";
        $rootScope.section = "checkout";

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

        $scope.shippingAddressError = null;
        $scope.billingAddressError = null;

        $scope.setCustomerStatus = function(status) {
            $scope.profile.customerStatus = status;
        }

        $scope.invalidDOB = false;
        $scope.invalidSponsorId = false;

        // initially verify
        verifyAge();
        verifySponsorId();

        $scope.$watch('profile.dob', function(newVal, oldVal) {
            if (newVal != oldVal) {
                // verify age when dob is exactly 8 characters long
                verifyAge();
            }
        });

        $scope.$watch('profile.sponsorId', function(newVal, oldVal) {
            if (newVal != oldVal) {
                verifySponsorId();
            }
        });

        // watch current step for changes
        $scope.$watch('currentStep', function(newVal, oldVal) {
            if (newVal != oldVal && newVal != '' && newVal != null) {
                $log.debug("CheckoutController(): step changed from", oldVal, "to", newVal, 'profile.customerStatus', $scope.profile.customerStatus);

                urlStep = newVal;

                // do focuses here
                if (S(urlStep).trim() == "Shipping") {
                    $("#shippingAddress1").onAvailable(function(){
                        $log.debug("CheckoutController(): focusing address1 field");
                        focus('shipping-address1-focus');
                    });
                } else {
                    $log.debug("CheckoutController(): new step is not shipping", newVal);
                }

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

            if (debug) {
                $scope.isOnlineSponsoring = true;
                $scope.APP_BASE_URL = JOIN_BASE_URL;
                $log.debug("CheckoutController(): online sponsoring");

                populateDebugData();
            } else if (path && path.match(JOIN_BASE_URL)) {
                $scope.isOnlineSponsoring = true;
                $scope.APP_BASE_URL = JOIN_BASE_URL;
                $log.debug("CheckoutController(): online sponsoring");

                // lock profile to new, since we're in online sponsoring
                $scope.profile.customerStatus = 'new';

                // redirect back home if there is no sku
                if (S(sku).isEmpty()) {
                    if ($scope.isOnlineSponsoring) {
                        $log.debug("CheckoutController(): no SKU, redirecting back to join page");
                        $location.path(JOIN_BASE_URL);
                    }
                }

                $scope.$watch(Cart.getFirstProductSku(), function(newVal, oldVal) {
                    if (newVal != null) {
                        var language = selectConsultantLanguage(newVal);
                        $log.debug("CheckoutController(): online sponsoring: setting consultant language for", sku, "to", language);
                    }
                });

                $scope.selectProduct(sku).then(function(product) {
                    if (!debug) {
                        if (Session.isLoggedIn() && !$scope.isOnlineSponsoring) {
                            // send the user past the login page if they are in client direct & logged in
                            if (urlStep != 'Start') {
                                $log.debug("CheckoutController(): online sponsoring: sending logged in user to", urlStep);
                                WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                            } else {
                                $log.debug("CheckoutController(): online sponsoring: sending logged in user to Shipping, skipping login/create");
                                WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                            }
                        } else {
                            $log.debug("CheckoutController(): online sponsoring: sending non-logged in user to Start");
                            WizardHandler.wizard('checkoutWizard').goTo('Start');
                        }
                    }

                    onlineSponsorChecksCompleteDefer.resolve();
                }, function() {
                    $log.error("CheckoutController(): online sponsoring: failed to select product, redirecting user");
                    $location.path($scope.isOnlineSponsoring ? JOIN_BASE_URL : STORE_BASE_URL);
                });

                // redirect to different steps as needed on load
                if (urlStep == 'Finish') {
                    $log.debug("CheckoutController(): online sponsoring: finished wizard, redirecting to landing page?");
                    $location.path(JOIN_BASE_URL).search('');
                    return;
                } else if (sku == null) {
                    $log.error("CheckoutController(): online sponsoring: failed to load sku for online sponsoring");
                    $location.path(JOIN_BASE_URL).search('');
                    return;
                } else {
                    if (WizardHandler.wizard('checkoutWizard') != null) {
                        $log.debug("CheckoutController(): online sponsoring: loading Start step");
                        WizardHandler.wizard('checkoutWizard').goTo('Start');
                        //$location.search("step", 'Start');
                    } else {
                        $timeout(function() {
                            $log.debug("CheckoutController(): online sponsoring: loading Start step after delay");
                            WizardHandler.wizard('checkoutWizard').goTo('Start');
                            //$location.search("step", 'Start');
                        }, 0);
                    }
                }
            } else {
                // nothing to load, done
                $log.debug("CheckoutController(): in store");
                $scope.APP_BASE_URL = STORE_BASE_URL;
                onlineSponsorChecksCompleteDefer.resolve();


            }
        });

        // select language based on product
        function selectConsultantLanguage(sku) {
            switch (sku) {
                case "19634":
                case "19636":
                    $scope.profile.language = "en_US";
                    break;
                case "19635":
                case "19637":
                    $scope.profile.language = "es_US";
                    break;
            }
            return $scope.profile.language;
        }

        $scope.selectProduct = function(sku) {
            var d = $q.defer();

            selectConsultantLanguage(sku);
            $scope.orderError = null;

            $log.debug("CheckoutController(): selectProduct(): loading product with sku=", sku);

            // load the product
            Products.get({productId: sku}).then(function(product) {
                $log.debug("CheckoutController(): selectProduct(): loaded sku", product.sku, "product", product);

                // FIXME - verify all previous steps data is available, else restart process

                $log.debug("CheckoutController(): selectProduct(): clearing cart and restarting checkout");

                Cart.clear().then(function(cart) {
                    $log.debug("CheckoutController(): selectProduct(): previous cart cleared");

                    Cart.addToCart(product).then(function(cart) {
                        $log.debug("CheckoutController(): selectProduct(): SKU loaded & added to cart", cart);

                        $scope.cart = cart;

                        Cart.loadProducts($scope.cart).then(function(items) {
                            $log.debug("CheckoutController(): selectProduct(): loaded items from cart & populated products", items);

                            // filter out invalid cart items
                            var list = [];
                            for (var i=0; i < items.length; i++) {
                                var item = items[i];
                                if (item.sku) {
                                    list.push(item);
                                } else {
                                    $log.error("CheckoutController(): selectProduct(): removing bad item from cart");
                                }
                            }

                            $scope.items = list;
                            $scope.cartLoaded = true;

                            if (items.length == 0) {
                                d.reject('CheckoutController(): selectProduct(): failed to load items');
                                return;
                            }

                            // no that we're loaded, create out change listener to track changes
                            if (cancelChangeListener == null) {
                                createChangeListener();
                            }

                            // only fetch sales tax info if we have a shipping address
                            if ($scope.profile.shipping) {
                                // fetch sales tax information here
                                $scope.fetchSalesTax().then(function(salesTaxInfo) {
                                    $log.debug("CheckoutController(): selectProduct(): got sales tax info", salesTaxInfo);

                                    $scope.salesTaxInfo = salesTaxInfo;

                                    $scope.checkoutUpdated();
                                    d.resolve(product);
                                }, function(error) {
                                    $log.error("CheckoutController(): selectProduct(): failed to get sales tax info, redirecting", error);
                                    $scope.orderError = "Failed to load sales tax";
                                    $scope.salesTaxInfo = null;

                                    if ($scope.isOnlineSponsoring) {
                                        $location.path(JOIN_BASE_URL);
                                    } else {
                                        $location.path(STORE_BASE_URL);
                                    }
                                    d.reject(error);
                                });
                            } else {
                                d.resolve(product);
                            }
                        }, function(error) {
                            $log.error("CheckoutController(): selectProduct(): failed to populated products, redirecting", error);
                            $scope.orderError = "Failed to load cart";
                            $scope.salesTaxInfo = null;

                            if ($scope.isOnlineSponsoring) {
                                $location.path(JOIN_BASE_URL);
                            } else {
                                $location.path(STORE_BASE_URL);
                            }
                            d.reject(error);
                        })
                    }, function(error) {
                        $log.error("CheckoutController(): selectProduct(): failed to add to cart, redirecting", error);
                        $scope.orderError = "Failed to add product to cart";
                        $scope.salesTaxInfo = null;

                        if ($scope.isOnlineSponsoring) {
                            $location.path(JOIN_BASE_URL);
                        } else {
                            $location.path(STORE_BASE_URL);
                        }
                        d.reject(error);
                    });
                }, function(error) {
                    $log.error("CheckoutController(): selectProduct(): failed to clear the cart, redirecting", error);
                    $scope.orderError = "Failed to clear cart";
                    $scope.salesTaxInfo = null;

                    if ($scope.isOnlineSponsoring) {
                        $location.path(JOIN_BASE_URL);
                    } else {
                        $location.path(STORE_BASE_URL);
                    }
                    d.reject(error);
                });
            }, function(error) {
                $log.error("CheckoutController(): selectProduct(): failed to load product, redirecting", error);
                $scope.orderError = "Failed to load product";
                $scope.salesTaxInfo = null;

                if ($scope.isOnlineSponsoring) {
                    $location.path(JOIN_BASE_URL);
                } else {
                    $location.path(STORE_BASE_URL);
                }
                d.reject(error);
            });

            return d.promise;
        }

        // ensure everything is valid to where we are, else load the proper step
        function checkSteps() {
            if (debug) {
                WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                return;
            }

            // CLIENT DIRECT
            if (!$scope.isOnlineSponsoring) {
                // on a reload, ensure we've loaded session & moved to the correct step
                if (urlStep != null && urlStep != 'Start' && !Session.isLoggedIn()) {
                    if (urlStep == 'Finish') {
                        $log.debug("CheckoutController(): finished wizard, redirecting to products");
                        $location.path(STORE_BASE_URL).search('');
                        $location.replace();
                        return;
                    } else {
                        $log.debug("CheckoutController(): sending user to beginning of wizard.  not logged in");
                        // changing url to reflect beginning of checkout
                        //$location.search('step', null);
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
                } else if (Session.isLoggedIn()) {
                    $log.debug("CheckoutController(): user is logged in, determining checkout step", urlStep);

                    if (WizardHandler.wizard('checkoutWizard') != null && urlStep == 'Start') {
                        $log.debug("CheckoutController(): skipping to shipping step");
                        //$location.search('step', 'Shipping');
                        WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                    } else if (urlStep == 'Start') {
                        $timeout(function() {
                            $log.debug("CheckoutController(): skipping to shipping step after delay");
                            //$location.search('step', 'Shipping');
                            WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                        }, 0);
                    }
                }
            }
        }

        // load the checkout data from the session
        function loadCheckout() {
            var d = $q.defer();

            $log.debug("CheckoutController(): loadCheckout()");

            Checkout.getCheckout().then(function(checkout) {
                $log.debug("CheckoutController(): loadCheckout(): success", checkout);
                $scope.checkout = checkout;
                d.resolve($scope.checkout);
            }, function(error) {
                $log.error("CheckoutController(): loadCheckout(): checkout error", error);
            });

            return d.promise;
        }

        // wait until the online sponsoring checks are complete including adding SKU to cart, then
        // handle step validation, checkout process loading
        onlineSponsorChecksCompleteDefer.promise.then(function() {
            $log.debug("CheckoutController(): sponsor checks complete");
            checkSteps();
        }, function (error) {
            $log.error("CheckoutController(): sponsor checks failed", error);
        });

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

                //$log.debug("CheckoutController(): changeListener(): url search", urlStep, "local step", localStep);

                // if we have a composition and run, and the current scope doesn't already have the same run
                if (path == STORE_BASE_URL + "/checkout" || path == JOIN_BASE_URL + "/checkout" && (urlStep != localStep)) {
                    $log.debug("CheckoutController(): changeListener():  updating step in response to location change");
                    // NOT SURE IF WE WANT TO KEEP THIS BUT THOUGHT WE SHOULDN'T ALLOW USER TO GO TO LOGIN PAGE AGAIN ONCE THEY PASSED THIS STEP
                    if (urlStep=='') {
                        if (Session.isLoggedIn()) {
                            $log.debug("CheckoutController(): changeListener(): user is logged in, skipping to shipping");
                            WizardHandler.wizard('checkoutWizard').goTo('Shipping');

                            // if the URL step is empty, then change it to shipping
                            $location.search("step", 'Shipping');

                            return;
                        } else {
                            $log.debug("CheckoutController(): changeListener(): going to start");
                            WizardHandler.wizard('checkoutWizard').goTo('Start');
                            $location.search("step", 'Start');
                        }
                    } else {
                        $log.debug("CheckoutController(): changeListener(): going to", urlStep);
                        WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                    }
                } else {
                    $log.debug("CheckoutController(): changeListener(): ignoring");
                }
            });
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

        function verifySponsorId() {
            $log.debug("CheckoutController(): verifySponsorId(): ", $scope.profile.sponsorId)
            if ($scope.profile.sponsorId == '' || $scope.profile.sponsorId == null) {
                $scope.invalidSponsorId = false;
            } else if (!$scope.profile.sponsorId.match(/^[0-9]+$/)) {
                $scope.invalidSponsorId = true;
            }
        }

        $scope.validateProfileAndContinue = function() {
            $log.debug("CheckoutController(): validateProfileAndContinue()", $scope.profile);
            $scope.profileSSNError = false;

            if (debug) {
                $log.debug("CheckoutController(): validateProfileAndContinue(): in debug, skipping to shipping");
                WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                return;
            }
            var ssn = $scope.profile.ssn.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');

            Session.lookupConsultant(ssn).then(function(data) {
                $log.debug("CheckoutController(): validateProfileAndContinue()", data);
                if (!data.exists) {
                    // set the name on the shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;

                    // do the sales tax calculations before moving to the next page
                    WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                } else {
                    // profile error
                    $log.debug("CheckoutController(): validateProfileAndContinue(): error with SSN");
                    $scope.profileSSNError = true;
                }
            }, function(error) {
               $log.error("CheckoutController(): validateProfileAndContinue()", error);
               $scope.profileSSNError = true;
            });
        }

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
            if ($scope.cartLoaded) {
              return OrderHelper.getTotal($scope.items);
            }

            return 0;
        }
        
        $scope.shippingSpeed = function() {
            $log.debug('CheckoutController(): shippingSpeed');

            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "shippingSpeedModal",
                templateUrl: '/partials/checkout/shipping-speed-modal.html',
                controller: 'ShippingSpeedModalController',
                resolve: {
                    checkout: function() {
                        return $scope.checkout;
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(shippingSpeed) {
                if (shippingSpeed) {
                    $log.debug("shipping speed selected");
                    $scope.shippingSpeed = shippingSpeed;
                    WizardHandler.wizard('checkoutWizard').goTo('Payment');

                    $scope.checkoutUpdated();
                } else {
                    $log.error("shipping speed not selected!!!");
                }

                // re-enable scrolling on body
                body.css("overflow-y", "auto");
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");
        }

        $scope.validateEmailAndContinue = function(email) {
            $scope.emailError = false;
            $log.debug("CheckoutController(): validateEmailAndContinue()");

            if (debug) {
                $log.debug("CheckoutController(): in debug, skipping validating email");

                // move to next step
                WizardHandler.wizard('checkoutWizard').goTo('Profile');
            } else {
                Addresses.validateEmail(email).then(function(r) {
                    $log.debug("CheckoutController(): validated email");

                    // set the user name on shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;
                    $scope.profile.newBillingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;

                    // move to next step
                    WizardHandler.wizard('checkoutWizard').goTo('Profile');
                }, function(r) {
                    $log.debug("CheckoutController(): validated email");

                    $scope.emailError = true;
                })
            }
        }

        $scope.loginOrCreateUser = function() {
            $log.debug("CheckoutController(): loginOrCreateUser()");

            $scope.loginError = null;

            if ($scope.profile.customerStatus == 'new') {
                $log.debug("CheckoutController(): loginOrCreateUser(): trying to create client with username=", $scope.profile.loginEmail);

                Session.createClient({
                    email: $scope.profile.loginEmail,
                    password: $scope.profile.loginPassword,
                    firstName: $scope.profile.firstName,
                    lastName: $scope.profile.lastName,
                    dateOfBirth: $scope.profile.dateOfBirth,
                    consultantId: $scope.profile.consultantId,
                    language: $scope.profile.language
                }).then(function(session) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): created client, moving to next step", session.client);

                    // set the name on the shipping address
                    $scope.profile.newShippingAddress.name = $scope.profile.firstName + " " + $scope.profile.lastName;

                    $scope.profile.customerStatus = 'existing';
                    $scope.checkoutUpdated();
                    // jump to Shipping
                    WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to create client", error);
                    $scope.loginError = error.message;
                });
            } else {
                $log.debug("CheckoutController(): loginOrCreateUser(): trying to login with username=", $scope.profile.loginEmail);

                // do the auth check and store the session id in the root scope
                Session.login($scope.profile.loginEmail, $scope.profile.loginPassword).then(function(session) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): authenticated, moving to next step", session.client);
                    $scope.profile.customerStatus = 'existing';
                    $scope.checkoutUpdated();
                    // jump to Shipping
                    WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to authenticate");
                    $scope.loginError = error.message;
                });
            }
        }

        $scope.completeProfile = function() {
            $log.debug("CheckoutController(): completeProfile(): profile complete", $scope.checkout);
            $scope.checkoutUpdated();
        }

        $scope.checkoutUpdated = function() {
            $log.debug("CheckoutController(): checkoutUpdated(): checkout updated", $scope.checkout);

            var checkout = angular.copy($scope.checkout);
            delete checkout.ssn;
            delete checkout.card;

            Checkout.setCheckout(checkout);
        }

        $scope.confirmAlert = function(message) {
            var confirmAction = confirm(message);   

            if (confirmAction && $scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): confirmAlert(): redirecting back to join page");
                $location.path(JOIN_BASE_URL);
            }
            else if (confirmAction && !$scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): confirmAlert(): redirecting back to store page");
                $location.path(STORE_BASE_URL);
            }
        }

        $scope.resetCard = function() {
            $log.debug("CheckoutController(): resetCard()");
            $scope.profile.newCard = angular.copy($scope.profile.card);
        }

        $scope.addPaymentMethod = function() {
            if (debug) {
                $log.debug("CheckoutController(): addPaymentMethod(): debug, adding card to checkout", $scope.profile.newCard);
                $scope.profile.card = angular.copy($scope.profile.newCard);
                WizardHandler.wizard('checkoutWizard').goTo('Review');
                return;
            }

            if (!$scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): addPaymentMethod(): adding card to account", $scope.profile.newCard);
                // we need to create a card and add to the account for client direct
                CreditCards.addCreditCard($scope.profile.newCard).then(function(card) {
                    $log.debug("CheckoutController(): addPaymentMethod(): continuing to review after adding card", card);
                    $scope.checkout.card = angular.copy(card);
                    $scope.profile.newCard = null;

                    // FIXME
                    // put the products into the checkout
                    //$scope.checkout.products = $scope.profile.

                    $scope.checkoutUpdated();
                    WizardHandler.wizard('checkoutWizard').goTo('Review');
                }, function(err) {
                    $log.error("CheckoutController(): addPaymentMethod(): error");
                    alert('error adding card: ' + err);
                });

                if (!$scope.profile.billSame) {
                    $log.debug("CheckoutController(): addPaymentMethod(): setting billing address", $scope.profile.newBillingAddress);
                    // we need to create an address to add to the account for client direct
                    $scope.setBillingAddress($scope.profile.newBillingAddress, true).then(function() {
                        // only do the clear
                        $scope.profile.newBillingAddress = null;
                        $scope.checkoutUpdated();
                        WizardHandler.wizard('checkoutWizard').goTo('Review');
                    }, function(err) {
                        $scope.billingAddressError = err;
                    });
                } else {
                    $scope.checkoutUpdated();
                    WizardHandler.wizard('checkoutWizard').goTo('Review');
                }
            } else {
                // we just add to checkout for online sponsoring
                $scope.profile.newCard.lastFour = $scope.profile.newCard.card.substr($scope.profile.newCard.card.length - 4);
                $log.debug("CheckoutController(): addPaymentMethod(): saving the card to the checkout and continuing on", $scope.profile.newCard);
                $scope.profile.card = angular.copy($scope.profile.newCard);

                if (!$scope.profile.billSame) {
                    $log.debug("CheckoutController(): addPaymentMethod(): setting billing address", $scope.profile.newBillingAddress);

                    // we just add to checkout for online sponsoring
                    Addresses.validateAddress($scope.profile.newBillingAddress).then(function(a) {
                        $log.debug("CheckoutController(): addPaymentMethod(): validated address", a);

                        $log.debug("CheckoutController(): addPaymentMethod(): setting consultant billing address", a);
                        $scope.profile.billing = angular.copy(a);

                        // fetch sales tax information here
                        $scope.fetchSalesTax().then(function(salesTaxInfo) {
                            $log.debug("CheckoutController(): addPaymentMethod(): got sales tax info", salesTaxInfo);

                            $scope.salesTaxInfo = salesTaxInfo;

                            $scope.checkoutUpdated();
                            WizardHandler.wizard('checkoutWizard').goTo('Review');
                        }, function(err) {
                            $scope.billingAddressError = "Error while processing cart";
                        });

                        $scope.checkoutUpdated();
                        WizardHandler.wizard('checkoutWizard').goTo('Review');
                    }, function(r) {
                        $log.error("CheckoutController(): addPaymentMethod(): error validating address", r);
                        // FIXME - failed to add, show error
                        $scope.billingAddressError = r.message;
                    });
                } else {
                    // copy, in case we need to re-copy from a back button from review page
                    $scope.profile.billing = angular.copy($scope.profile.shipping);

                    // fetch sales tax information here
                    $scope.fetchSalesTax().then(function(salesTaxInfo) {
                        $log.debug("CheckoutController(): addPaymentMethod(): got sales tax info", salesTaxInfo);

                        /*
                        {
                            SH: "12.00",
                            SubTotal: "99.00",
                            TaxAmount: "9.71",
                            TaxRate: "8.75",
                            Total: "120.71",
                            TotalBeforeTax: "111.00"
                        }
                        */

                        $scope.salesTaxInfo = salesTaxInfo;

                        $scope.checkoutUpdated();
                        WizardHandler.wizard('checkoutWizard').goTo('Review');
                    }, function(err) {
                        $scope.billingAddressError = "Error while processing cart";
                    });
                }
            }
        }

        // FIXME - only supports Online Sponsoring currently
        $scope.updatePaymentMethod = function() {
            if (debug) {
                $log.debug("CheckoutController(): updatePaymentMethod(): debug, adding card to checkout", $scope.profile.newCard);
                $scope.profile.card = angular.copy($scope.profile.newCard);

                // close any modals
                angular.element('.modal').modal('hide');

                return;
            }

            if ($scope.isOnlineSponsoring) {
                // we just add to checkout for online sponsoring
                $scope.profile.newCard.lastFour = $scope.profile.newCard.card.substr($scope.profile.newCard.card.length - 4);
                $log.debug("CheckoutController(): updatePaymentMethod(): saving the card to the checkout and continuing on", $scope.profile.newCard);
                $scope.profile.card = angular.copy($scope.profile.newCard);

                // no need to update sales tax, because we just updated the card, not the address
                $scope.checkoutUpdated();

                // close any modals
                angular.element('.modal').modal('hide');
            }
        }

        $scope.fetchSalesTax = function() {
            var defer = $q.defer();

            if ($scope.profile.shipping) {
                $log.debug("CheckoutController(): fetchSalesTax(): fetching sales tax for item", $scope.items[0], $scope.profile.shipping.geocode);

                SalesTax.calculate(0, 0, $scope.profile.shipping.geocode, 1414, "P", [
                    {
                        "sku": $scope.items[0].product.sku,
                        "qty": 1
                    }
                ]).then(function(info) {
                    $log.debug("CheckoutController(): fetchSalesTax()", info);
                    defer.resolve(info);
                }, function(err) {
                    $log.error("CheckoutController(): fetchSalesTax()", err);
                    defer.reject(err);
                });
            } else {
                defer.reject('Unable to lookup address');
            }

            return defer.promise;
        }

        $scope.isValidCard = function(card) {
            if (card == null || S(card).isEmpty()) {
                //$log.debug("empty", card);
                return false;
            }
            var res = CreditCards.validateCard(card);
            //$log.debug("valid", res.valid, card);
            return res.valid;
        }

        function cardChanged() {
            $log.debug("CheckoutController(): cardChanged()", $scope.profile.newCard);
            var res = CreditCards.validateCard($scope.profile.newCard.card);
            $scope.profile.newCard.cardType = res.type;
        }

        $scope.$watch('profile.newCard.card', function(newVal, oldVal) {
            cardChanged();
        });

        function cardExpirationChanged() {
            $scope.invalidExpiration = false;

            var expiration = moment($scope.profile.newCard.expMonth + $scope.profile.newCard.expYear, "MMYYYY", true).endOf("month");
            var now = moment();

            if (!expiration.isValid() || now.diff(expiration,'days') > 0) {
                $log.debug("CheckoutController(): cardExpirationChanged(): expired");
                $scope.invalidExpiration = true;
            } else {
                $log.debug("CheckoutController(): cardExpirationChanged(): not expired");
            }
        }

        $scope.$watch('profile.newCard.expMonth', function(newVal, oldVal) {
            cardExpirationChanged();
        });
        $scope.$watch('profile.newCard.expYear', function(newVal, oldVal) {
            cardExpirationChanged();
        });

        $scope.processOrder = function() {
            $log.debug("CheckoutController(): placeOrder(): checkout", $scope.checkout);
            $log.debug("CheckoutController(): placeOrder(): profile", $scope.profile);

            $scope.orderError = null;

            if ($scope.isOnlineSponsoring) {
                if (debug) {
                    // need to add
                    $log.debug("CheckoutController(): processOrder(): debug, adding card to checkout", $scope.profile.newCard);
                    $scope.profile.card = angular.copy($scope.profile.newCard);
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
                for (var i=0; i < $scope.items[0].product.contains.length; i++) {
                    var component = $scope.items[0].product.contains[i];
                    if (component.product) {
                        components.push({
                            sku: component.product.sku,
                            qty: component.quantity
                        });
                    }
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
                $log.debug("CheckoutController(): loginOrCreateUser(): businessCO", shipping);

                // strip first name if necessary
                if (shipping.businessCO && !S(shipping.businessCO).isEmpty()) {
                    shipping.businessCO.replace(new RegExp("^"+fullName), "");
                }

                // handle c/o & business name, etc.
                if (shipping.businessCO && !S(shipping.businessCO).isEmpty()) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): found business/co, shuffling fields");

                    // we have changed something and need to modify address1 to be this and address2 to be everything else
                    var add1 = shipping.address1;
                    var add2 = shipping.address2;

                    shipping.address2 = add1;
                    if (!S(add2).isEmpty()) {
                        shipping.address2 += " " + add2;
                    }
                    shipping.address1 = shipping.businessCO.toUpperCase();
                }

                var consultant = {
                    ssn: ssn,
                    email: $scope.profile.loginEmail,
                    firstName: $scope.profile.firstName.toUpperCase(),
                    lastName: $scope.profile.lastName.toUpperCase(),
                    dateOfBirth: dob,
                    sponsorId: $scope.profile.sponsorId,
                    language: $scope.profile.language,
                    source: $scope.profile.source,
                    phone: phone,
                    billingAddress: billing,
                    shippingAddress: shipping,
                    creditCard: $scope.profile.card,
                    agreementAccepted: $scope.profile.agree+"",
                    total: parseFloat($scope.salesTaxInfo.Total),
                    products: [
                        {
                            "sku": $scope.items[0].product.sku,
                            "qty": 1,
                            "kitSelections": {},
                            "components": components
                        }
                    ]
                }

                $log.debug("CheckoutController(): loginOrCreateUser(): creating consultant", consultant);

                if (!debug) {
                    Session.createConsultant(consultant).then(function(data) {
                        $log.debug("CheckoutController(): loginOrCreateUser(): created consultant, moving to next step", data);
                        // jump to Shipping
                        $scope.confirmation = {
                            orderId: data.orderId,
                            consultantId: data.consultantId,
                            sponsor: data.sponsor
                        };

                        WizardHandler.wizard('checkoutWizard').goTo('Finish');
                    }, function(error) {
                        $log.error("CheckoutController(): loginOrCreateUser(): failed to create consultant", error);
                        $scope.orderError = error.message;
                        // FIXME - show error here!!!!!
                    });
                } else {
                    WizardHandler.wizard('checkoutWizard').goTo('Finish');
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
            }
        }

        $scope.selectShippingAddress = function(address) {
            $log.debug("CheckoutController(): selectShippingAddress(): shipping and billing set to", address);
            $scope.profile.shipping = angular.copy(address);
            // only set this if billSame is selected
            if ($scope.profile.billSame) {
                $scope.profile.billing = angular.copy(address);
            }
            $scope.checkoutUpdated();
        }

        $scope.selectShippingAddressAndContinue = function(address) {
            $log.debug("CheckoutController(): selectShippingAddressAndContinue(): shipping and billing set to", address);

            $scope.selectShippingAddress();
            WizardHandler.wizard('checkoutWizard').goTo('Payment');
        }

        $scope.addShippingAddressAndContinue = function(address) {
            $log.debug("CheckoutController(): addShippingAddressAndContinue()", address);

            $scope.addShippingAddress(address).then(function() {
                // fetch sales tax information here
                $scope.fetchSalesTax().then(function(salesTaxInfo) {
                    $log.debug("CheckoutController(): addShippingAddressAndContinue(): got sales tax info", salesTaxInfo);

                    $scope.salesTaxInfo = salesTaxInfo;

                    $scope.checkoutUpdated();
                }, function(err) {
                    $log.error("CheckoutController(): addShippingAddressAndContinue(): failed to get sales tax info", err);
                    $scope.orderError = "Failed to load sales tax";
                    $scope.salesTaxInfo = null;
                });

                WizardHandler.wizard('checkoutWizard').goTo('Payment');
            });
        }

        $scope.addShippingAddress = function(address) {
            var d = $q.defer();

            addAddress(address).then(function(a) {
                if ($scope.isOnlineSponsoring) {
                    $log.debug("CheckoutController(): addShippingAddress(): setting consultant shipping address", a);

                    $scope.profile.shipping = angular.copy(a);
                    // set the addresses
                    $scope.profile.newShippingAddress = angular.copy(a);

                    if ($scope.profile.billSame) {
                        $log.debug("CheckoutController(): addShippingAddress(): setting consultant billing address", a);
                        $scope.profile.billing = angular.copy(a);
                        $scope.profile.newBillingAddress = angular.copy(a);
                    }

                    d.resolve(a);
                } else {
                    $log.debug("CheckoutController(): addShippingAddress(): setting client shipping address", a);

                    $scope.profile.shipping = angular.copy(a);
                    // clear the form versions
                    $scope.profile.newShippingAddress = null;

                    if ($scope.profile.billSame) {
                        $log.debug("CheckoutController(): addShippingAddress(): setting client billing address", a);
                        $scope.profile.billing = angular.copy(a);
                        $scope.profile.newBillingAddress = null;
                    }

                    d.resolve(a);
                }
            }, function(err) {
                d.reject(err);
            });

            return d.promise;
        }

        $scope.addBillingAddress = function(address) {
            $log.debug("CheckoutController(): addBillingAddress()", address);
            var d = $q.defer();

            addAddress(address).then(function(a) {
                if ($scope.isOnlineSponsoring) {
                    $log.debug("CheckoutController(): addBillingAddress(): setting consultant billing address", a);
                    $scope.profile.billSame = false;
                    $scope.profile.billing = angular.copy(a);

                    // set the addresses
                    $scope.profile.newBillingAddress = angular.copy(a);

                    d.resolve(a);
                } else {
                    $scope.profile.billSame = false;
                    $scope.profile.billing = angular.copy(a);

                    // clear the form versions
                    $scope.profile.newBillingAddress = null;

                    d.resolve(a);
                }
            }, function(err) {
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
                        return address;
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(result) {
                $log.debug("CheckoutController(): showAddressCorrectionModal(): address correction modal closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                dd.resolve(result);
            });

            // prevent page content from scrolling while modal is up
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
                WizardHandler.wizard('checkoutWizard').goTo('Payment');
                d.resolve();
                return d.promise;
            }

            $log.debug("CheckoutController(): addAddress(): validating address", address);

            Addresses.validateAddress(address).then(function(a) {
                $log.debug("CheckoutController(): addAddress(): validated address", a);

                // if this address was validated and corrected, then we need to inform the user
                if (!addressesEqual(address, a)) {
                    showAddressCorrectionModal(a).then(function(result) {
                        $log.debug("CheckoutController(): addAddress(): address correction modal closed");

                        var address = result.address;
                        var canceled = result.canceled;

                        if (canceled) {
                            $log.debug("CheckoutController(): addAddress(): address correction canceled");
                            d.reject("Address correction canceled");
                            return;
                        }

                        selectGeocodeAndAdd(a).then(function(a) {
                            $log.debug("CheckoutController(): addAddress(): selected geocode and added address", a);
                            d.resolve(a);
                        }, function(error) {
                            $log.error("CheckoutController(): addAddress(): select geocode and add failed", error);
                            $scope.shippingAddressError = error;
                            d.reject(error);
                        });
                    }, function(error) {
                        $log.error("CheckoutController(): addAddress(): address not corrected");
                        $scope.shippingAddressError = error;
                        d.reject(error);
                    });
                } else {
                    selectGeocodeAndAdd(a).then(function(a) {
                        $log.debug("CheckoutController(): addAddress(): selected geocode and added address", a);
                        d.resolve(a);
                    }, function(error) {
                        $log.debug("CheckoutController(): addAddress(): select geocode and add failed", error);
                        $scope.shippingAddressError = error;
                        d.reject(error);
                    });
                }


            }, function(r) {
                $log.error("CheckoutController(): addAddress(): error validating address", r);
                // FIXME - failed to add, show error
                $scope.shippingAddressError = r.message;
                d.reject(r.errorMessage);
            });

            return d.promise;
        }

        function selectGeocodeAndAdd(a) {
            var d = $q.defer();

            // add name here since we're not allowing user to input a name for shipping address manually;
            a.name = $scope.profile.firstName + " " + $scope.profile.lastName;
            a.phone = $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');;

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
                    d.resolve(a);
                } else if (matchedGeocode) {
                    $log.debug("CheckoutController(): selectGeocodeAndAdd(): selecting exact match geocode");
                    a.geocode = matchedGeocode.GEOCODE;
                    $scope.checkoutUpdated();
                    d.resolve(a);
                } else {
                    // display a dialog for the user to choose the correct geocode here
                    selectGeocodeModal(geocodes).then(function(result) {
                        $log.debug("CheckoutController(): selectGeocodeAndAdd(): geocode selection dialog closed", result);

                        var geocode = result.geocode;
                        var canceled = result.canceled;

                        if (canceled) {
                            $log.error("CheckoutController(): selectGeocodeAndAdd(): geocode selection dialog canceled");
                            $scope.shippingAddressError = "Must select an address";
                            d.reject('Must select an address');
                            return;
                        }

                        if (geocode) {
                            a.geocode = geocode.GEOCODE;
                            $scope.checkoutUpdated();

                            if ($scope.isOnlineSponsoring) {
                                // online sponsoring, we have it in mem
                                d.resolve(a);
                            } else {
                                // client direct, we add it
                                Addresses.addAddress(a).then(function(address) {
                                    $log.debug("CheckoutController(): selectGeocodeAndAdd(): address added", address);
                                    $scope.profile.shipping = angular.copy(address);
                                    $scope.profile.billing = angular.copy(address);
                                    d.resolve(address);
                                }, function(err) {
                                    $log.error("CheckoutController(): selectGeocodeAndAdd(): failed to add address", err);
                                    $scope.shippingAddressError = error;
                                    d.reject(err);
                                });
                            }
                        } else {
                            $log.error("CheckoutController(): selectGeocodeAndAdd(): empty geocode");
                            $scope.shippingAddressError = "Unable to verify address";
                            d.reject('Unable to verify address');
                        }
                    }, function(err) {
                        $log.error("CheckoutController(): selectGeocodeAndAdd(): failed to select geocode", err);
                        $scope.shippingAddressError = "Unable to verify address";
                        d.reject(err);
                    });
                }
            }, function (r) {
                $log.error("CheckoutController(): selectGeocodeAndAdd(): error looking up geocode", r);
                $scope.shippingAddressError = "Unable to verify address";
                d.reject(r.errorMessage);
            });

            return d.promise;
        }

        $scope.removeAddress = function(addressId) {
            var d = $q.defer();

            $log.debug('CheckoutController(): removeAddress(): address data', addressId);

            Addresses.removeAddress(addressId).then(function() {
                $log.debug("CheckoutController(): removeAddress(): address removed", addressId);
                if ($scope.profile.shipping != null && $scope.profile.shipping.id == addressId) {
                    $scope.profile.shipping = null;
                }
                if ($scope.profile.billing != null && $scope.profile.billing.id == addressId) {
                    $scope.profile.billing = null;
                }

                d.resolve();
                $scope.checkoutUpdated();
            }, function(err) {
                $log.error("CheckoutController(): removeAddress()", err);
                d.reject(err);
            });

            return d.promise;
        }

        $scope.setBillingAddress = function(address, isNew) {
            var d = $q.defer();
            $log.debug('CheckoutController(): setBillingAddress(): billing address data', address);

            if (isNew) {
                Addresses.addAddress(address).then(function(a) {
                    $log.debug("CheckoutController(): addAddress(): address added", a);
                    $scope.profile.billing = angular.copy(a);
                    $scope.checkoutUpdated();
                    d.resolve(a);
                }, function(err) {
                    $log.error("CheckoutController(): addAddress(): failed to add address", err);
                    d.reject(err);
                });
            } else {
                $log.debug("CheckoutController(): addAddress(): setting address to existing address", address);
                $scope.profile.billing = angular.copy(address);
                $scope.checkoutUpdated();
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
                $location.path(STORE_BASE_URL);
                $location.replace();
            }
        }

        function cleanup() {
            if (cancelChangeListener) {
                $log.debug("CheckoutController(): cleanup(): canceling change listener");
                cancelChangeListener();
            }
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });

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
                    cvv: 987
                },
                card: {
                    name: "Test Name",
                    card: "4111111111111111",
                    expMonth: "12",
                    expYear: "2020",
                    cvv: 987
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
                    onlineSponsorChecksCompleteDefer.resolve();
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
            address.phone = $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');;

            $log.debug("CheckoutController(): populateDebugShippingData(): setting consultant shipping/billing address", address);
            $scope.profile.shipping = angular.copy(address);
            $scope.profile.billing = angular.copy(address);

            // set the addresses
            $scope.profile.newShippingAddress = angular.copy(address);

            $scope.checkoutUpdated();
        }
    });
