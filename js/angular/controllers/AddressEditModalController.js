
angular.module('app.controllers.checkout').controller('AddressEditModalController', function ($document, $modalInstance, $q, $scope, $window, $log, $translate, $rootScope, Addresses, address, addAddress, isOnlineSponsoring, namePlaceholder) {

    $log.debug('AddressEditModalController()');
    
    $scope.address = angular.copy(address);

    $scope.addressError = false;
    $scope.isOnlineSponsoring = isOnlineSponsoring;
    $scope.namePlaceholder = namePlaceholder || undefined;
    $scope.address.name = $scope.address.name || $scope.namePlaceholder;

    $log.debug('AddressEditModalController(): open(): $scope.address:', $scope.address);

    $log.debug('AddressEditModalController(): open(): $scope.address.name:', $scope.address.name, '$rootScope.namePlaceholder:', $rootScope.namePlaceholder);

    $scope.close = function () {
        $log.debug('AddressEditModalController()');
        $modalInstance.close({
            address  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('AddressEditModalController(): save(): saving...');
        $scope.processing = true;
        addAddress($scope.address).then(function (data) {
            $log.debug('AddressEditModalController(): editAddress() [strikeiron]: addAddress success:', data);
            $modalInstance.close({
                address  : $scope.address,
                canceled : false
            });
            $scope.processing = false;
        }, function(error) {
            $log.error('AddressEditModalController(): save(): error!', error);
            $scope.addressError = error;
            $scope.processing = false;
        });
    };

    $scope.$on('$destroy', function () {
        $log.debug('AddressEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
