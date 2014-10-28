angular.module('app.controllers.checkout')
    .controller('AddressCorrectionModalController', function ($sce, $timeout, $document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, address) {
        $log.debug("AddressCorrectionModalController");

        $log.debug("AddressCorrectionModalController(): corrected address", address);

        $scope.address = address;

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("AddressCorrectionModalController(): canceling address correction");
            $modalInstance.close({
                address: null,
                canceled: true
            });
        };

        $scope.save = function () {
            $log.debug("AddressCorrectionModalController(): saving address correction");

            $modalInstance.close({
                address: address,
                canceled: false
            });
        };

        function cleanup() {
            $log.debug("AddressCorrectionModalController(): cleaning up");
            var body = $document.find('html, body');
            body.css("overflow-y", "auto");
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
