angular.module('app.controllers.checkout')
    .controller('ContactEditModalController', function ($sce, $timeout, $document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $translate, Addresses, profile) {

        $log.debug("ContactEditModalController()");

        $scope.profile = profile;
        $scope.emailError = "";

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("ContactEditModalController()");
            $modalInstance.close({
                profile: null,
                canceled: true
            });
        };

        $scope.save = function () {
            $log.debug("ContactEditModalController(): save()");

            Addresses.validateEmail(profile.loginEmail).then(function(email) {
                $log.debug("ContactEditModalController(): save(): email valid");

                $modalInstance.close({
                    profile: profile,
                    canceled: false
                });
            }, function(error) {
                $log.debug("ContactEditModalController(): save(): email invalid", error);
                $translate('INVALID-EMAIL').then(function (message) {
                    $scope.emailError = message;
                });
            });
        };

        function cleanup() {
            $log.debug("ContactEditModalController(): cleaning up");
            var body = $document.find('html, body');
            body.css("overflow-y", "auto");
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
