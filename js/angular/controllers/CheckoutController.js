angular.module('app.controllers.checkout')
    .controller('CheckoutController', function ($location, $scope, $document, $rootScope, $routeParams, $log, Cart, Products, HashKeyCopier, WizardHandler) {

        $log.debug("CheckoutController()");

        //change page title
        $rootScope.page = "Checkout";
        $rootScope.section = "checkout";

        $scope.checkout = {
            currentStep: '',
            customerStatus: 'existing'
        }

        var cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
            var url = $location.url(),
                path = $location.path(),
                params = $location.search();

            $log.debug("changeListener(): location change event in checkout page", url, params);

            var urlStep = S(params.step != null ? params.step : "").toString();
            var localStep = $scope.checkout.currentStep;

            $log.debug("changeListener(): url search", urlStep, "local step", localStep);

            // if we have a composition and run, and the current scope doesn't already have the same run
            if (path == "/checkout" && (urlStep != localStep)) {
                $log.debug("changeListener(): updating step in response to location change");

                WizardHandler.wizard('checkoutWizard').goTo(urlStep);
            } else {
                $log.debug("changeListener(): ignoring");
            }
        });

        $scope.$watch('checkout.currentStep', function(newVal, oldVal) {
            if (newVal != oldVal && newVal != '' && newVal != null) {
                $log.debug("step changed from", oldVal, "to", newVal);
                $location.search("step", newVal);
            }
        });

        $scope.checkoutUpdated = function() {
            $log.debug("checkout updated", $scope.checkout);
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

        function cleanup() {
            if (cancelChangeListener) {
                $log.debug("cleanup(): canceling change listener");
                cancelChangeListener();
            }
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
