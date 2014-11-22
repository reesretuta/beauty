
angular.module('app.controllers.checkout').controller('AddressEditModalController', function ($document, $modalInstance, $q, $scope, $rootScope, $window, $log, $translate, Addresses, profile) {

    $log.debug('AddressEditModalController()');

    $scope.profile = profile;
    $scope.emailError = '';

    $scope.close = function () {
        $log.debug('AddressEditModalController()');
        $modalInstance.close({
            profile: null,
            canceled: true
        });
    };

    $scope.save = function () {
        $log.debug('AddressEditModalController(): save()');
        Addresses.validateEmail(profile.loginEmail).then(function(email) {
            $log.debug('AddressEditModalController(): save(): email valid');
            $modalInstance.close({
                profile: profile,
                canceled: false
            });
        }, function(error) {
            $log.debug('AddressEditModalController(): save(): email invalid', error);
            $translate('INVALID-EMAIL').then(function (message) {
                $scope.emailError = message;
            });
        });
    };

    function cleanup() {
        $log.debug('AddressEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    }

    $scope.$on('$destroy', function() {
        cleanup();
    });

});
