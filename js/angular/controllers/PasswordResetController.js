angular.module('app.controllers.top')
    .controller('PasswordResetController', function ($scope, $document, $timeout, $log, $location, $rootScope, $translate, $routeParams, PasswordResetHelper, SHOP_BASE_URL) {

        $log.debug('PasswordResetController()');

        var token = $routeParams.token;
        var email = $routeParams.email;
        $scope.resetData = {
            token: token,
            email: email
        };

        $scope.resetPassword = function() {
            $scope.resetError = "";

            PasswordResetHelper.reset({
                email: $scope.resetData.email,
                password: $scope.resetData.password,
                token: $scope.resetData.token
            }).then(function() {
                $location.url(SHOP_BASE_URL);
            }, function(error) {
                $log.error('PasswordResetController()', error);
                $translate('PASSWORD-RESET-ERROR').then(function (message) {
                    $scope.resetError = message;
                });
            });
        }
    });