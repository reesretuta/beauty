
angular.module('app.controllers.checkout').controller('AddressEditModalController', function ($document, $modalInstance, $q, $scope, $window, $log, $translate, Addresses, address) {

    $log.debug('AddressEditModalController()');

    $scope.address = angular.copy(address);
    $scope.addressError = false;

    $scope.close = function () {
        $log.debug('AddressEditModalController()');
        $modalInstance.close({
            address  : $scope.address,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('AddressEditModalController(): save()');
        // update local model
        address = $scope.address;
        $modalInstance.close({
            address  : $scope.address,
            canceled : false
        });
    };

    $scope.$on('$destroy', function () {
        $log.debug('AddressEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
