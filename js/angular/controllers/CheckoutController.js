angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($location, $scope, $document, $timeout, $rootScope, $anchorScroll, $routeParams, $modal, $log, $q, STORE_BASE_URL, JOIN_BASE_URL, Session, OrderHelper, Checkout, Cart, Products, Addresses, CreditCards, HashKeyCopier, WizardHandler) {

        $log.debug("CheckoutController()");

        $scope.cartLoaded = false;
        $rootScope.inCheckout = true;

        var params = $location.search();
        var urlStep = S(params.step != null ? params.step : "Start").toString();

        //change page title
        $rootScope.title = "Checkout";
        $rootScope.section = "checkout";

        $scope.client = {};

        // persisted to session
        $scope.checkout = {
            billSame: true,
            shipping: null,
            billing: null,
            card: {} // NOTE!!! only encrypted card data should go here
        }

        // in memory on client only
        $scope.profile = {
            customerStatus: 'new',
            firstName: '',
            lastName: '',
            loginEmail: '',
            loginPassword: '',
            phoneNumber: '',
            newShippingAddress: {},
            newBillingAddress: {},
            newCard: {}
        };

        // set current step
        $scope.currentStep = 'Start';

        $log.debug("CheckoutController(): urlStep", urlStep);
        var onlineSponsorChecksCompleteDefer = $q.defer();

        $scope.setCustomerStatus = function(status) {
            $scope.profile.customerStatus = status;
        }

        // watch current step for changes
        $scope.$watch('currentStep', function(newVal, oldVal) {
            if (newVal != oldVal && newVal != '' && newVal != null) {
                $log.debug("CheckoutController(): step changed from", oldVal, "to", newVal, 'profile.customerStatus', $scope.profile.customerStatus);
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

        // FIXME - ensure that if loading a step, all previous steps were completed

        var path = $location.path();
        $log.debug("CheckoutController(): path", path);

        Session.get().then(function(session) {
            $log.debug("CheckoutController(): session initialized", session);


            if (session.client && session.client.id) {
                $log.debug("CheckoutController(): user is logged in");
                $scope.profile.customerStatus = 'existing';
            } else {
                $log.debug("CheckoutController(): user is NOT logged in");
                $scope.profile.customerStatus = 'new';
            }

            $scope.isOnlineSponsoring = false;
            if (path && path.match(JOIN_BASE_URL)) {
                $scope.isOnlineSponsoring = true;
                $scope.APP_BASE_URL = JOIN_BASE_URL;
                $log.debug("CheckoutController(): online sponsoring");

                // lock profile to new, since we're in online sponsoring
                $scope.profile.customerStatus = 'new';

                // get the sku, add the product to cart
                var sku = S($routeParams.sku != null ? $routeParams.sku : "").toString();
                var name = S($routeParams.name != null ? $routeParams.name : "").toString();
                $log.debug("CheckoutController(): online sponsoring: sku=", sku, "name=", name);

                if (urlStep == 'Finish') {
                    $log.debug("CheckoutController(): finished wizard, redirecting to landing page?");
                    $location.path(JOIN_BASE_URL).search('');
                    return;
                } else if (sku == null) {
                    $log.error("CheckoutController(): failed to load sku for online sponsoring");
                    $location.path(JOIN_BASE_URL).search('');
                    return;
                } else {
                    if (WizardHandler.wizard('checkoutWizard') != null) {
                        $log.debug("CheckoutController(): loading Start step");
                        WizardHandler.wizard('checkoutWizard').goTo('Start');
                        $location.search("step", 'Start');
                    } else {
                        $timeout(function() {
                            $log.debug("CheckoutController(): loading Start step after delay");
                            WizardHandler.wizard('checkoutWizard').goTo('Start');
                            $location.search("step", 'Start');
                        }, 0);
                    }
                }

                // FIXME - verify all previous steps data is available, else restart process

                $log.debug("CheckoutController(): clearing cart and restarting checkout");

                Cart.clear().then(function(cart) {
                    $log.debug("CheckoutController(): previous cart cleared");

                    Cart.addToCart({
                        name: name,
                        sku: sku,
                        kitSelections: {},
                        quantity: 1
                    }).then(function(cart) {
                        $log.debug("CheckoutController(): online sponsoring SKU loaded & added to cart");
                        onlineSponsorChecksCompleteDefer.resolve();
                    }, function(error) {
                        $log.error("CheckoutController(): failed to update cart");
                    });
                }, function(error) {
                    $log.error("CheckoutController(): failed to update cart");
                });
            } else {
                // nothing to load, done
                $log.debug("CheckoutController(): in store");
                $scope.APP_BASE_URL = STORE_BASE_URL;
                onlineSponsorChecksCompleteDefer.resolve();
            }
        });

        // ensure everything is valid to where we are, else load the proper step
        function checkSteps() {
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

                    Session.get().then(function(session) {
                        $log.debug("CheckoutController(): user is logged in. step", urlStep, session.client);
                        $scope.client = session.client;

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
                    }, function(error) {
                        $log.error("CheckoutController(): error loading session", error);
                    });
                }
            }
        }

        // load the checkout data from the session
        function loadCheckout() {
            $log.debug("CheckoutController(): loadCheckout()");

            // load checkout data
            $log.debug("CheckoutController(): loadCheckout(): checkout data");

            Checkout.getCheckout().then(function(checkout) {
                $log.debug("CheckoutController(): loadCheckout(): success", checkout);
                $scope.checkout = checkout;
            }, function(error) {
                $log.error("CheckoutController(): loadCheckout(): checkout error", error);
            });

            // load cart data
            Cart.getItems().then(function(items) {
                $scope.items = items;

                $scope.cartLoaded = true;
                $log.debug("CheckoutController(): loadCheckout(): loaded cart products into items", items);

                if (items.length == 0) {
                    $log.debug("CheckoutController(): loadCheckout(): no items in cart, redirecting to products / landing");
                    $location.path($scope.isOnlineSponsoring ? JOIN_BASE_URL : STORE_BASE_URL);
                } else if (Session.isLoggedIn() && !$scope.isOnlineSponsoring) {
                    // send the user past login page
                    if (urlStep != 'Start') {
                        $log.debug("CheckoutController(): loadCheckout(): sending logged in user to", urlStep);
                        WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                    } else {
                        $log.debug("CheckoutController(): loadCheckout(): sending logged in user to Shipping, skipping login/create");
                        WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                    }
                } else {
                    $log.debug("CheckoutController(): loadCheckout(): sending non-logged in user to Start");
                    WizardHandler.wizard('checkoutWizard').goTo('Start');
                }

                // no that we're loaded, create out change listener to track changes
                createChangeListener();
            }, function(error) {
                $log.error("CheckoutController(): loadCheckout(): cart error", error);
                $location.path(STORE_BASE_URL);
            });
        }

        // wait until the online sponsoring checks are complete including adding SKU to cart, then
        // handle step validation, checkout process loading
        onlineSponsorChecksCompleteDefer.promise.then(function() {
            $log.debug("CheckoutController(): loadCheckout(): sponsor checks complete");
            checkSteps();
            loadCheckout();
        }, function (error) {
            $log.error("CheckoutController(): loadCheckout(): sponsor checks failed", error);
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
                            WizardHandler.wizard('checkoutWizard').goTo('Start');
                            $location.search("step", 'Start');
                        }
                    } else {
                        WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                    }
                } else {
                    $log.debug("CheckoutController(): changeListener(): ignoring");
                }
            });
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

        $scope.loginOrCreateUser = function() {
            $log.debug("CheckoutController(): loginOrCreateUser()");

            $scope.loginError = false;

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
                    $scope.client = session.client;
                    $scope.profile.customerStatus = 'existing';
                    // jump to Shipping
                    WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to create client");
                    $scope.loginError = true;
                    // FIXME - show error here!!!!!
                });
            } else {
                $log.debug("CheckoutController(): loginOrCreateUser(): trying to login with username=", $scope.profile.loginEmail);

                // do the auth check and store the session id in the root scope
                Session.login($scope.profile.loginEmail, $scope.profile.loginPassword).then(function(session) {
                    $log.debug("CheckoutController(): loginOrCreateUser(): authenticated, moving to next step", session.client);
                    $scope.client = session.client;
                    $scope.profile.customerStatus = 'existing';
                    // jump to Shipping
                    WizardHandler.wizard('checkoutWizard').goTo($scope.isOnlineSponsoring ? 'Profile' : 'Shipping');
                }, function(error) {
                    $log.error("CheckoutController(): loginOrCreateUser(): failed to authenticate");
                    $scope.loginError = true;
                });
            }

            $scope.checkoutUpdated();
        }

        $scope.completeProfile = function() {
            $log.debug("CheckoutController(): completeProfile(): profile complete", $scope.checkout);
            $scope.checkoutUpdated();
        }


        $scope.checkoutUpdated = function() {
            $log.debug("CheckoutController(): checkoutUpdated(): checkout updated", $scope.checkout);
            Checkout.setCheckout($scope.checkout);
        }
        
        $scope.confirmAlert = function(message) {
            var confirmAction = confirm(message);   

           if (confirmAction) {
             $location.path(STORE_BASE_URL);
           }

        }

        $scope.addPaymentMethod = function() {
            if (!$scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): addPaymentMethod(): adding card to account", $scope.profile.newCard);
                // we need to create a card and add to the account for client direct
                $scope.addCard($scope.profile.newCard, function() {
                    $log.debug("CheckoutController(): addPaymentMethod(): continuing to review");
                    WizardHandler.wizard('checkoutWizard').goTo('Review');
                }, function() {
                    $log.error("CheckoutController(): addPaymentMethod(): error");
                    // FIXME - show an error here, stay on the step
                });
            } else {
                // we just add to checkout for online sponsoring
                // FIXME - need to encrypt this first!!!
                $log.debug("CheckoutController(): addPaymentMethod(): saving the card to the checkout and continuing on", $scope.profile.newCard);
                $scope.checkout.card = $scope.profile.newCard;
                WizardHandler.wizard('checkoutWizard').goTo('Review');
            }

            if (!$scope.checkout.billSame) {
                $log.debug("CheckoutController(): addPaymentMethod(): setting billing address", $scope.profile.newBillingAddress);

                if (!$scope.isOnlineSponsoring) {
                    // we need to create an address to add to the account for client direct
                    $scope.setBillingAddress($scope.profile.newBillingAddress, true);
                } else {
                    // we just add to checkout for online sponsoring
                    $scope.checkout.billing = $scope.profile.newBillingAddress;
                }
            }

            $scope.checkoutUpdated();
        }

        $scope.addCard = function(card, success, failure) {
            $log.debug('CheckoutController(): addCard(): card data', card);

            CreditCards.addCreditCard(card).then(function(card) {
                $log.debug("CheckoutController(): addCard(): card added", card);
                // FIXME - this should be encrypted first!!!
                $scope.checkout.card = card;
                success();
            }, function(err) {
                $log.error("CheckoutController(): addCard(): failed to add card", err);
                failure();
            });

            $scope.checkoutUpdated();
        }

        $scope.selectAddressAndContinue = function(address) {
            $log.debug("CheckoutController(): selectAddressAndContinue(): shipping and billing set to", address);
            $scope.checkout.shipping = address;
            $scope.checkout.billing = address;
            $scope.shippingSpeed();
        }

        $scope.addAddressAndContinue = function(address) {
            $log.debug("CheckoutController(): addAddressAndContinue()", address);

            if ($scope.isOnlineSponsoring) {
                $log.debug("CheckoutController(): addAddressAndContinue(): setting consultant shipping/billing address", address);
                $scope.checkout.shipping = address;
                $scope.checkout.billing = address;
                WizardHandler.wizard('checkoutWizard').goTo('Payment');
            } else {
                $log.debug("CheckoutController(): addAddressAndContinue(): adding address");
                $scope.addAddress(address).then(function() {
                    $log.debug("CheckoutController(): addAddressAndContinue(): added address, showing shipping speed");
                    $scope.shippingSpeed();
                }, function(error) {
                    $log.error("CheckoutController(): addAddressAndContinue(): error adding address", error);
                });
            }
            $scope.checkoutUpdated();
        }

        $scope.addAddress = function(address) {
            var d = $q.defer();

            $log.debug('CheckoutController(): addAddress(): address data', address);

            Addresses.addAddress(address).then(function(address) {
                $log.debug("CheckoutController(): addAddress(): address added", address);
                $scope.checkout.shipping = address;
                $scope.checkout.billing = address;
                d.resolve(address);
            }, function(err) {
                $log.error("CheckoutController(): addAddress(): failed to add address", err);
                d.reject(err);
            });

            return d.promise;
        }

        $scope.removeAddress = function(addressId) {
            var d = $q.defer();

            $log.debug('CheckoutController(): removeAddress(): address data', addressId);

            Addresses.removeAddress(addressId).then(function() {
                $log.debug("CheckoutController(): removeAddress(): address removed", addressId);
                if ($scope.checkout.shipping != null && $scope.checkout.shipping.id == addressId) {
                    $scope.checkout.shipping = null;
                }
                if ($scope.checkout.billing != null && $scope.checkout.billing.id == addressId) {
                    $scope.checkout.billing = null;
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
            $log.debug('CheckoutController(): setBillingAddress(): billing address data', address);

            if (isNew) {
                Addresses.addAddress(address).then(function(a) {
                    $log.debug("CheckoutController(): addAddress(): address added", a);
                    $scope.checkout.billing = a;
                    $scope.checkoutUpdated();
                }, function(err) {
                    $log.error("CheckoutController(): addAddress(): failed to add address", err);
                });
            } else {
                $log.debug("CheckoutController(): addAddress(): setting address to existing address", address);
                $scope.checkout.billing = address;
                $scope.checkoutUpdated();
            }
        }

        $scope.substr = function(string, start, charNo) {
            if (string == null) {
                return null;
            }
            $scope.string = string.substr(start, charNo)
            return $scope.result = $scope.string;
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
    });
