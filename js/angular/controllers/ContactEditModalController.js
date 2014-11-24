
angular.module('app.controllers.checkout').controller('ContactEditModalController', function ($document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $window, $log, $translate, Addresses, profile, Session) {

    $log.debug('ContactEditModalController()');

    var originalEmail = profile.loginEmail;

    $scope.profile = angular.copy(profile);

    $scope.close = function () {
        $log.debug('ContactEditModalController()');
        $modalInstance.close({
            profile  : null,
            canceled : true
        });
    };

    $scope.save = function () {
        $log.debug('ContactEditModalController(): save()');
        if ($scope.profile.loginEmail === originalEmail) {
            return $modalInstance.close({
                profile  : $scope.profile,
                canceled : false
            });
        }
        Addresses.validateEmail(profile.loginEmail).then(function (email) {
            Session.consultantEmailAvailable(email, false).then(function(available) {
                if (available) {
                    $log.debug('CheckoutController(): Session: client available', available);
                    $modalInstance.close({
                        profile  : $scope.profile,
                        canceled : false
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
