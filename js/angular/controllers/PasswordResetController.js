angular.module('app.controllers.top')
    .controller('PasswordResetController', function ($scope, $document, $timeout, $log, $location, $rootScope, $translate, $routeParams, PasswordResetHelper, STORE_BASE_URL) {

        $log.debug('PasswordResetController()');

        var token = $routeParams.token;
        var email = $routeParams.email;
        $scope.resetData = {
            token: token,
            email: email,
            password: null,
            confirmPassword: null
        };

        $rootScope.section = "passwordReset";

        $scope.reset = function() {
            $log.debug('PasswordResetController()', $scope.resetData.email, $scope.resetData.password, $scope.resetData.token);

            $scope.resetError = "";

            PasswordResetHelper.reset($scope.resetData.email, $scope.resetData.password, $scope.resetData.token).then(function() {
                $location.url(STORE_BASE_URL);
            }, function(error) {
                $log.error('PasswordResetController()', error);
                $translate('PASSWORD-RESET-ERROR').then(function (message) {
                    $scope.resetError = message;
                });
            });
        }
    });