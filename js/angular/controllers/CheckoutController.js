angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($scope, $document, $rootScope, $routeParams, $log, Cart, Products, HashKeyCopier, WizardHandler) {

        //change page title
        $rootScope.page = "Checkout";
        $rootScope.section = "checkout";

        $scope.checkout = {
            customerStatus: 'existing'
        }


        // customer data
        $scope.customerData = {
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
                    cardNumber: 'XXXX-XXXX-XXXX-1234',
                    expMonth: '02',
                    expYear: '2016',
                    securityCode: '123'
                },
                {
                    name: 'Dain Michael Kennison',
                    cardNumber: 'XXXX-XXXX-XXXX-1111',
                    expMonth: '04',
                    expYear: '2015',
                    securityCode: '123'
                }
            ]

        }

        $scope.logStep = function() {
            console.log("Step continued");
        }
        
        $scope.finished = function() {
            alert("Wizard finished :)");
        }
    });
