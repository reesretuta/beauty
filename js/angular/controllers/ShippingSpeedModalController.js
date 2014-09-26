angular.module('app.controllers.checkout')
    .controller('ShippingSpeedModalController', function ($modalInstance, $scope, $rootScope, $routeParams, $log, checkout) {

        $scope.checkout = angular.copy(checkout);

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("closing shipping speed", $scope.checkout.shippingSpeed);
            $modalInstance.close($scope.checkout.shippingSpeed);
        };

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
