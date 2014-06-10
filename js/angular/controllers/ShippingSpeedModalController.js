angular.module('app.controllers.checkout')
    .controller('ShippingSpeedModalController', function ($modalInstance, $scope, $rootScope, $routeParams, $log, checkout, wizardFunc) {
    

        $scope.wizardFunc = wizardFunc;

        $scope.checkout = angular.copy(checkout);

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("closing shipping speed");
            $modalInstance.close();
        };

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
