angular.module('app.controllers.account').controller('AddressEditModalController', function ($document, $modalInstance, $q, $scope, $window, $log, $translate, Addresses, address) {

    $log.debug('AddressEditModalController()');

    
    $scope.address = angular.copy(address);
    $scope.addressError = false;

    $log.debug('AddressEditModalController(): open(): $scope.address:', $scope.address);

    $scope.close = function () {
        $log.debug('AddressEditModalController()');
        $modalInstance.close({
            address  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('AddressEditModalController(): save(): saving...');
        addAddress($scope.address).then(function (data) {
            $log.debug('AddressEditModalController(): editAddress() [strikeiron]: addAddress success:', data);
            $modalInstance.close({
                address  : $scope.address,
                canceled : false
            });
        }, function(error) {
            $log.error('AddressEditModalController(): save(): error!', error);
            $scope.addressError = error;
        });
    };

    $scope.$on('$destroy', function () {
        $log.debug('AddressEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});