angular.module('app.controllers.account').controller('ProfileEditModalController', function ($document, $modalInstance, $q, $scope, $window, $log, $translate) {
    
    $log.debug('ProfileEditModalController()');
    

    $scope.close = function () {
        $log.debug('ProfileEditModalController()');
        $modalInstance.close({
            address  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('ProfileEditModalController(): save(): saving...');
        // addAddress($scope.address).then(function (data) {
        //     $log.debug('ProfileEditModalController(): editAddress() [strikeiron]: addAddress success:', data);
        //     $modalInstance.close({
        //         address  : $scope.profile,
        //         canceled : false
        //     });
        // }, function(error) {
        //     $log.error('ProfileEditModalController(): save(): error!', error);
        //     $scope.addressError = error;
        // });
    };

    $scope.$on('$destroy', function () {
        $log.debug('ProfileEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });
});