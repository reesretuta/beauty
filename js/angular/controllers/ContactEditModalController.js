
angular.module('app.controllers.checkout').controller('ContactEditModalController', function ($document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $window, $log, $translate, Addresses, profile, Session) {

    $log.debug('ContactEditModalController()');

    $scope.profile = angular.copy(profile);
    $scope.emailError = '';

    $scope.close = function () {
        $log.debug('ContactEditModalController()');
        $modalInstance.close({
            profile  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('ContactEditModalController(): save()');
        Addresses.validateEmail(profile.loginEmail).then(function (email) {
            Session.clientEmailAvailable(email, $scope.ignoreExists).then(function(available) {
                if (available) {
                    $log.debug('CheckoutController(): Session: client available', available);
                    $modalInstance.close({
                        profile: profile,
                        canceled: false
                    });
                } else {
                    $log.debug('ContactEditModalController(): save(): email invalid', error);
                    $translate('INVALID-EMAIL').then(function (message) {
                        $scope.emailError = message;
                    });
                }
            }, function(error) {
                $log.error('CheckoutController(): Session: client email ERROR', error);
                $translate('INVALID-EMAIL').then(function (message) {
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
