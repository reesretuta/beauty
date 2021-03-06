angular.module('app.controllers.top')
    .controller('PasswordResetController', function ($scope, $document, $timeout, $log, $location, $rootScope, $translate, $routeParams, PasswordResetHelper, STORE_BASE_URL) {

        $rootScope.title = 'RESET-PASSWORD';

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

        $scope.resetPasswordRequest = function (email) {
            $scope.processing = true;
            $scope.passwordResetError = null;
            $log.debug("PasswordResetController(): resetPasswordRequest()", email);
            PasswordResetHelper.requestReset(email).then(function(){
                $log.debug("PasswordResetController(): resetPasswordRequest(): password reset");
                $('#forgot').css('display','none');
                $('#thanks').css('display','block');
                $scope.processing = false;
            }, function(error) {
                $log.error("PasswordResetController(): resetPasswordRequest(): password reset failed", error);
                if (error.statusCode && error.statusCode === 409) {
                    $log.error("PasswordResetController(): resetPasswordRequest(): password reset failed: reset too soon");
                    $translate('PASSWORD-RESET-ERROR-TOO-SOON').then(function (message) {
                        $scope.passwordResetError = message;
                        $scope.processing = false;
                    });
                } else {
                    $log.error("PasswordResetController(): resetPasswordRequest(): password reset failed: unknown error");
                    $translate('FORGOT-PASSWORD-ERROR').then(function (message) {
                        $scope.passwordResetError = message;
                        $scope.processing = false;
                    });
                }
            });
        }

        $scope.reset = function () {
            $log.debug('PasswordResetController()', $scope.resetData.email, $scope.resetData.password, $scope.resetData.token);
            $scope.processing = true;
            $scope.resetError = '';
            PasswordResetHelper.reset($scope.resetData.email, $scope.resetData.password, $scope.resetData.token).then(function () {
                $location.url(STORE_BASE_URL);
                $scope.processing = false;
            }, function(error) {
                $log.error('PasswordResetController()', error);
                $translate('PASSWORD-RESET-ERROR').then(function (message) {
                    $scope.resetError = message;
                });
                $scope.processing = false;
            });
        }
    });
