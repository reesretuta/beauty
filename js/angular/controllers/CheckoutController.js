angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($scope, $document, $rootScope, $routeParams, $log, Cart, Products, HashKeyCopier, WizardHandler) {

        //change page title
        $rootScope.page = "Checkout";
        $rootScope.section = "checkout";

        $scope.currentStep;

        $scope.checkout = {
            customerStatus: 'existing'
        }

        $scope.checkoutUpdated = function() {
            $log.debug("checkout updated", $scope.checkout);
        }

        // customer data
        $scope.existingCustomerData = {
            info: {
                    emailAddress: 'dain@lavisual.com',
                    password: 'item',
                    name: 'Dain Kennison'
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
                    type: 'shipping',
                    notes: ''
                },
                {
                    address1: '123 Eastman Ave',
                    address2: '',
                    city: 'Simi Valley',
                    state: 'CA',
                    zip: '93065',
                    country: 'United States',
                    phone: '805-558-1097',
                    type: 'billing',
                    notes: ''
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
        
        $scope.newCustomerData = {};
        
        $scope.addCard = function(cardData) {
            
            var creditCard = {
                    name: cardData.cardName,
                    cardNumber: cardData.cardNumber,
                    expMonth: cardData.expMonth,
                    expYear: cardData.expYear,
                    securityCode: cardData.securityCode
            }
            if(cardData.customerStatus=='existing') {
                $scope.existingCustomerData.creditCards.push(angular.copy(creditCard));
            } else {
                var creditCards = {creditCards: []};
                $scope.newCustomerData = creditCards;                
                $scope.newCustomerData.creditCards.push(angular.copy(creditCard));
            }
                $log.debug('card data', $scope.newCustomerData); $log.debug('existing card data', $scope.existingCustomerData)
        }
        
        $scope.substr = function(string, start, charNo) {
            $scope.string = string.substr(start, charNo)
            return $scope.result = $scope.string;
        }

        $scope.logStep = function() {
            console.log("Step continued");
        }
        
        $scope.finished = function() {
            alert("Wizard finished :)");
        }
    });
