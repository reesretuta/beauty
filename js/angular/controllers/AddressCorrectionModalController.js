
angular.module('app.controllers.checkout').controller('AddressCorrectionModalController', function ($sce, $timeout, $document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, address) {
    
    $log.debug("AddressCorrectionModalController");
    $log.debug("AddressCorrectionModalController(): corrected address", address);

    $scope.address = angular.copy(address);

    $scope.close = function () {
        $log.debug("AddressCorrectionModalController(): canceling address correction");
        $modalInstance.close({
            address  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug("AddressCorrectionModalController(): saving address correction");
        $modalInstance.close({
            address  : $scope.address,
            canceled : false
        });
    };

    function cleanup() {
        $log.debug("AddressCorrectionModalController(): cleaning up");
        var body = $document.find('html, body');
        body.css("overflow-y", "auto");
    }

    $scope.$on('$destroy', function() {
        cleanup();
    });

});
