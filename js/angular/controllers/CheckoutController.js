angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($location, $scope, $document, $timeout, $rootScope, $routeParams, $log, Session, Checkout, Cart, Products, HashKeyCopier, WizardHandler) {

        $log.debug("CheckoutController()");



        var loadCart = function() {
            $scope.products = Cart.getItems();
            $log.debug("loaded cart products", $scope.products);
        }
        loadCart();
        if ($scope.products.length == 0) {
            $location.path("/products");
        }
        
        $scope.total = function() {
            var total = 0;
            angular.forEach($scope.products, function(item) {
                
                var pricing = item.pricing.detailprice;                
                if (!(Array.isArray(pricing))) {
                    total += item.quantity * item.pricing.detailprice.price;
                } else {
                    angular.forEach(pricing, function(price) {
                        if(price.pricetype=='sale') {
                            total += item.quantity * price.price;
                        }
                    })
                }
                
//                total += item.quantity * item.pricing.detailprice.price;
            })

            return total;
        }


        //change page title
        $rootScope.page = "Checkout";
        $rootScope.section = "checkout";


        $scope.checkout = {
            currentStep: '',
            customerStatus: 'new',
            billDif: true
        }
        $scope.loginEmail = '';
        $scope.loginPassword = '';

        var step = $routeParams.step;
        if (step != null && !Session.isLoggedIn()) {
            // changing url to reflect beginning of checkout
            $location.search('step', null);
            $location.replace();

        }

        $scope.loginOrCreateUser = function(loginEmail, loginPassword) {
            $scope.loginError = false;

            $log.debug("trying to login with username=", loginEmail, "password=", loginPassword);
            var success = false;
            if(checkout.customerStatus=='new') {
                success = Session.createUser(loginEmail);
            } else {
                success = Session.login(loginEmail, loginPassword);
            }
            
            // do the auth check and store the session id in the root scope
            
            if (success) {
                $log.debug("CheckoutController(): authenticated, moving to next step");
                // jump to Shipping
                WizardHandler.wizard('checkoutWizard').goTo('Shipping');
            } else {
                $log.debug("CheckoutController(): failed to authenticate");
                $scope.loginError = true;
            }
        }

        var checkout = Checkout.getCheckout();

        if (Session.isLoggedIn()) {
            $log.debug("CheckoutController(): user is logged in, skipping to shipping");
            if (WizardHandler.wizard('checkoutWizard') != null) {
                WizardHandler.wizard('checkoutWizard').goTo('Shipping');
            } else {
                $timeout(function() {
                    WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                }, 0);
            }
        }

        if (checkout.customerStatus == null) {
            checkout.customerStatus = 'new';
        }
        if (checkout.currentStep == null) {
            checkout.currentStep = '';
        }
        if (checkout.billDif == null) {
            checkout.billDif = true;
        }

        $scope.checkout = checkout;

        // change the wizard steps when folks hit the back/forward browser buttons
        var cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
            var url = $location.url(),
                path = $location.path(),
                params = $location.search();

            //$log.debug("CheckoutController(): changeListener(): location change event in checkout page", url, params);

            var urlStep = S(params.step != null ? params.step : "").toString();
            var localStep = $scope.checkout.currentStep;

            //$log.debug("CheckoutController(): changeListener(): url search", urlStep, "local step", localStep);

            // if we have a composition and run, and the current scope doesn't already have the same run
            if (path == "/checkout" && (urlStep != localStep)) {
                $log.debug("changeListener(): updating step in response to location change");
                // NOT SURE IF WE WANT TO KEEP THIS BUT THOUGHT WE SHOULDN'T ALLOW USER TO GO TO LOGIN PAGE AGAIN ONCE THEY PASSED THIS STEP
                if(urlStep=='') {
                    if (Session.isLoggedIn()) {
                        $log.debug("CheckoutController(): user is logged in, skipping to shipping");
                        WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                        return;
                    } else {
                        WizardHandler.wizard('checkoutWizard').goTo('Start');
                    }
                } else {
                    WizardHandler.wizard('checkoutWizard').goTo(urlStep);
                }
            } else {
                $log.debug("CheckoutController(): changeListener(): ignoring");
            }
        });

        $scope.$watch('checkout.currentStep', function(newVal, oldVal) {
            if (newVal != oldVal && newVal != '' && newVal != null) {
                $log.debug("CheckoutController(): step changed from", oldVal, "to", newVal);
                if (newVal != 'Start') {
                    $location.search("step", newVal);
                }
                if (newVal == 'Finish') {
                    $log.debug("triggering finished");
                    $scope.finished();
                }
            }
        });

        $scope.checkoutUpdated = function() {
            $log.debug("checkout updated", $scope.checkout);
            Checkout.setCheckout($scope.checkout);
        }
        
        $scope.confirmAlert = function(message) {
            var confirmAction = confirm(message);   

           if (confirmAction) {
             $location.path("/");
           }

        }

        // customer data
        $scope.existingCustomerData = {
            info: {
                    emailAddress: 'dain@lavisual.com',
                    password: 'item'
            },
            addresses: [
                {
                    address1: '123 Eastman Ave',
                    address2: '',
                    city: 'Simi Valley',
                    state: 'CA',
                    zip: '93065',
                    country: 'United States',
                    phone: '805-558-1097',
                    type: 'House',
                    notes: '',
                    name: 'Dain Kennison'
                },
                {
                    address1: '8585 Lake Road',
                    address2: '',
                    city: 'Simi Valley',
                    state: 'CA',
                    zip: '93063',
                    country: 'United States',
                    phone: '805-558-1097',
                    type: 'House',
                    notes: '',
                    name: 'Dain Kennison'
                }
            ],
            creditCards: [
                {
                    name: 'Dain Michael Kennison',
                    cardNumber: '4321123443211234',
                    expMonth: '02',
                    expYear: '2016',
                    securityCode: '123'
                },
                {
                    name: 'Dain Michael Kennison',
                    cardNumber: '4111111111111111',
                    expMonth: '04',
                    expYear: '2015',
                    securityCode: '123'
                }
            ]

        }
        
        
        
        // create order object
        $scope.orderObject = {creditCard:[], shipping:[], billing:[]};
        
        $scope.addToOrderObject = function(object, data) {
            $log.debug('order object before', $scope.orderObject);
            $scope.orderObject[object] = data;
            $log.debug('order object after', $scope.orderObject);
//            $scope.orderObject.object.push(angular.copy(data));
        }
        
        $scope.newCustomerData = {};
        
        
        $scope.addCard = function(cardData) { 
            $log.debug('card data', cardData);
            var creditCard = {
                name: cardData.cardName,
                cardNumber: cardData.cardNumber,
                expMonth: cardData.expMonth,
                expYear: cardData.expYear,
                securityCode: cardData.securityCode
            }
            
            // add card to order object
            $scope.orderObject.creditCard = creditCard;
            $log.debug('order object', $scope.orderObject);
            
            if(cardData.customerStatus=='existing') {
                $scope.existingCustomerData.creditCards.push(angular.copy(creditCard));
            } else {
                $scope.newCustomerData = {creditCards: []};                
                $scope.newCustomerData.creditCards.push(angular.copy(creditCard));
            }
            
            
//                $log.debug('card data', $scope.newCustomerData); $log.debug('existing card data', $scope.existingCustomerData)
        }
        
        $scope.addAddress = function(data, addressType) { 
            $log.debug('address data', data);
            var address = {
                address1: data.address1,
                address2: data.address2,
                city: data.city,
                state: data.stateProvinceRegion,
                zip: data.zipPostalCode,
                country: data.country,
                phone: data.phone,
                type: data.addressType,
                notes: data.securityAccessCode,
                name: data.fullName
            }
            
            // add address to order object
            $scope.orderObject[addressType] = address;
//            $log.debug('order object', $scope.orderObject);
            
            if(data.customerStatus=='existing') {
                $scope.existingCustomerData.addresses.push(angular.copy(address));
            } else {
                $scope.newCustomerData = {addresses: []};                
                $scope.newCustomerData.addresses.push(angular.copy(address));
            }
            
            
//                $log.debug('card data', $scope.newCustomerData); $log.debug('existing card data', $scope.existingCustomerData)
        }
        
        
        $scope.substr = function(string, start, charNo) {
            $scope.string = string.substr(start, charNo)
            return $scope.result = $scope.string;
        }

        $scope.logStep = function() {
            $log.debug("CheckoutController(): Step continued");
        }
        
        $scope.finished = function() {
            $log.debug("Checkout finished :)");
            $scope.checkout.currentStep = '';
            Checkout.clear();
            Cart.clear();
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
