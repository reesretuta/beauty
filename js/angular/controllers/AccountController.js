
angular.module('app.controllers.account')
    .controller('AccountController', function ($location, $scope, $document, $timeout, $rootScope, $anchorScroll, $routeParams, $modal, $log, $q, $translate, $analytics, STORE_BASE_URL, JOIN_BASE_URL, focus, Geocodes, Session, Consultant, Addresses, Order, OrderHelper, Checkout, Cart, Product, SalesTax, CreditCards, Leads, PasswordResetHelper, HashKeyCopier, WizardHandler, Account) {
            
            if (!Session.isLoggedIn()) {
                $location.path(STORE_BASE_URL);
            }

            //change page title
            $rootScope.title = "Account";
            $rootScope.section = "account";

            var params = $location.search();
            var debug = params.debug;
            $scope.debug = debug;


            $scope.orderHistory = [];
            $scope.profile = {};
            
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
            
            
            
            $scope.profile = $rootScope.session.client; //populates view

            $scope.updateClient = function(){
                Account.updateClient($scope.profile);
            };

            $scope.updatePassword = function (password) {
                $scope.profile.password = password;
                Account.updateClient($scope.profile);
            };
            
            $scope.setDefaultAddress = function(address){
                Account.setDefaultAddress($scope.profile);
            }
            
            $scope.addAddress = function(address){
                Account.setDefaultAddress($scope.profile);
            }
            
            
            
            $scope.editCards = function(profile){
                
                var d, body, dd = $q.defer();
                d = $modal.open({
                    backdrop: true,
                    keyboard: true,
                    windowClass: 'editCreditCardModal',
                    templateUrl: '/partials/checkout/card-edit-modal.html',
                    controller: 'EditCreditCardModalController',
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
                body = $document.find('html, body');
                d.result.then(function(result) {
                    $log.debug('CheckoutController(): editAddress(): edit address modal: saved');
                    dd.resolve();
                    body.css('overflow-y', 'auto');
                });
                $('html, body').css('overflow-y', 'hidden');
                return dd.promise;
            }
            
            
            $scope.editProfile = function (profile) {

                $log.debug('AccountController(): editProfile(): profile:', profile);

                var d, body, dd = $q.defer();
                d = $modal.open({
                    backdrop: true,
                    keyboard: true,
                    windowClass: 'editAddressModal',
                    templateUrl: '/partials/account/modals/profile-edit.html',
                    controller: 'ProfileEditModalController',
                    resolve: {
                        profile: function() {
                            return {
                                firstName   : $scope.profile.firstName,
                                lastName    : $scope.profile.lastName,
                                email       : $scope.profile.email,
                                phoneNumber : $scope.profile.phoneNumber
                            }
                        }
                    }
                });
                body = $document.find('html, body');
                d.result.then(function(result) {
                    $log.debug('CheckoutController(): editAddress(): edit address modal: saved');
                    dd.resolve();
                    body.css('overflow-y', 'auto');
                });
                $('html, body').css('overflow-y', 'hidden');
                return dd.promise;
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
            
            // edit an address via a standard modal
            $scope.editAddress = function(address) {
                $log.debug('CheckoutController(): editAddress: got address:', address);
                var d, body, dd = $q.defer();
                d = $modal.open({
                    backdrop: true,
                    keyboard: true,
                    windowClass: 'editAddressModal',
                    templateUrl: '/partials/account/modals/address-edit.html',
                    controller: 'AddressEditModalController',
                    resolve: {
                        address: function() {
                            return address; //coming from modal view ng-click="editAddress(address)"
                        },
                        addAddress: function() {
                            return addAddress;
                        }
                    }
                });
                body = $document.find('html, body');
                d.result.then(function(result) {
                    $log.debug('CheckoutController(): editAddress(): edit address modal: saved');
                    if (!result.canceled) {
                        $log.debug('CheckoutController(): editAddress()');
                    }
                    dd.resolve();
                    body.css('overflow-y', 'auto');
                });
                $('html, body').css('overflow-y', 'hidden');
                return dd.promise
                ;
            };
            
            var a = '';

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
                $scope.shippingAddressError = r.message;
                d.reject(r.errorMessage);
            });
            return d.promise;
        }
            
            // addAddressToBackend(a).then(function(aa) {
            //     d.resolve(aa);
            // }, function(error) {
            //     d.reject(error);
            // });
            
            // function addAddressToBackend(a) {
//                 $log.debug("CheckoutController(): addAddressToBackend()", a);
//                 var d = $q.defer();
//                 if ($scope.isOnlineSponsoring || isGuest) {
//                     // online sponsoring, we have it in mem
//                     d.resolve(a);
//                 } else {
//                     $log.debug("CheckoutController(): addAddressToBackend(): adding address", a);
//                     // client direct, we add it
//                     if (a.id) {
//                         Addresses.updateAddress(a).then(function(a) {
//                             $log.debug("CheckoutController(): addAddressToBackend(): address updated", a);
//                             d.resolve(a);
//                         }, function(error) {
//                             $log.error("CheckoutController(): addAddressToBackend(): failed to update address", error);
//                             $scope.shippingAddressError = error;
//                             d.reject(error);
//                         });
//                     } else {
//                         Addresses.addAddress(a).then(function(a) {
//                             $log.debug("CheckoutController(): addAddressToBackend(): address added", a);
//                             d.resolve(a);
//                         }, function(error) {
//                             $log.error("CheckoutController(): addAddressToBackend(): failed to add address", error);
//                             $scope.shippingAddressError = error;
//                             d.reject(error);
//                         });
//                     }
//                 }
//                 return d.promise;
//             }

        
        // get order history
        $scope.getOrderHistory = function() {
            $log.debug('CheckoutController(): getOrderHistory()');

            Order.getHistory().then(function(orderHistory) {
                
                $scope.orderHistory = orderHistory;

                $log.debug("CheckoutController(): getOrderHistory(): ", $scope.orderHistory);
            }, function (err) {
                $log.error("CheckoutController(): getOrderHistory(): error loading order history", err);
            })
        };
            
        $scope.getOrderHistory();

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