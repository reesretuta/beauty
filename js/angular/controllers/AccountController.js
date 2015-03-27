angular.module('app.controllers.account')
    .controller('AccountController', function ($location, $scope, $document, $timeout, $rootScope, $anchorScroll, $routeParams, $modal, $log, $q, $translate, $analytics, STORE_BASE_URL, JOIN_BASE_URL, focus, Geocodes, Session, Consultant, Addresses, Order, OrderHelper, Checkout, Cart, Product, SalesTax, CreditCards, Leads, PasswordResetHelper, HashKeyCopier, WizardHandler, Account) {
            
            
            Account.test();
            //change page title
            $rootScope.title = "Account";
            $rootScope.section = "account";
            
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
            
            
            $scope.editProfile = function(profile){

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
            
            // edit an address via a standard modal
            $scope.editAddress = function(address) {
                $log.debug('CheckoutController(): editAddress: got address:', address);
                var d, body, dd = $q.defer();
                d = $modal.open({
                    backdrop: true,
                    keyboard: true,
                    windowClass: 'editAddressModal',
                    templateUrl: '/partials/account/modals/address-edit.html',
                    controller: '',
                    resolve: {
                        // profile: function() {
                        //     return {
                        //         firstName   : $scope.profile.firstName,
                        //         lastName    : $scope.profile.lastName,
                        //         loginEmail  : $scope.profile.loginEmail,
                        //         phoneNumber : $scope.profile.phoneNumber
                        //     }
                        // }
                        address: function() {
                            return address; //coming from modal view ng-click="editAddress(address)"
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
                return dd.promise
                ;
            };
            
            var a = '';
            
            
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
            
            
            
            
            
            
    });