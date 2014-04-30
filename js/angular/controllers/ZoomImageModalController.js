angular.module('app.controllers.products')
    .controller('ZoomImageModalController', function ($modalInstance, $scope, $rootScope, $routeParams, $log, product) {
        $log.debug("ZoomImageModalController");

        $scope.product = angular.copy(product);

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("closing zoom modal");
            $modalInstance.close();
        };

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
