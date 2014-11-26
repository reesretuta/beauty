
angular.module('app.controllers.checkout').controller('ContactEditModalController', function ($document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $window, $log, $translate, Addresses, profile, Session) {

    $log.debug('ContactEditModalController()');

    var originalProfile = profile;

    $scope.profile = angular.copy(profile);

    $log.debug(originalProfile, $scope.profile);

    $scope.close = function () {
        $log.debug('ContactEditModalController()');
        $modalInstance.close({
            profile  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('ContactEditModalController(): save(): trying email:', $scope.profile.loginEmail);
        if (JSON.stringify($scope.profile) === JSON.stringify(originalProfile)) {
            return $modalInstance.close({
                profile  : $scope.profile,
                canceled : false
            });
        }
        Addresses.validateEmail($scope.profile.loginEmail).then(function (email) {
            Session.consultantEmailAvailable($scope.profile.loginEmail, false).then(function(available) {
                if (available) {
                    $log.debug('CheckoutController(): Session: client available', available);
                    $modalInstance.close({
                        profile  : $scope.profile,
                        canceled : false
                    });
                } else {
                    $log.debug('ContactEditModalController(): save(): email invalid');
                    $translate('INVALID-EMAIL-ADDRESS-IN-USE').then(function (message) {
                        $log.debug('ContactEditModalController(): INVALID-EMAIL-ADDRESS-IN-USE');
                        $scope.emailError = message;
                    });
                }
            }, function(error) {
                $log.error('CheckoutController(): Session: client email ERROR', error);
                $translate('INVALID-EMAIL-ADDRESS-IN-USE').then(function (message) {
                    $log.debug('ContactEditModalController(): INVALID-EMAIL-ADDRESS-IN-USE');
                    $scope.emailError = message;
                });
            });
        }, function(error) {
            $log.debug('ContactEditModalController(): save(): email invalid', error);
            $translate('INVALID-EMAIL').then(function (message) {
                $scope.emailError = message;
            });
        });
    };

    $scope.$on('$destroy', function() {
        $log.debug('ContactEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
