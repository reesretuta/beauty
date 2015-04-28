
angular.module('app.controllers.account').controller('ProfileEditModalController', function ($document, $window, $modalInstance, $q, $rootScope, $scope, $log, $translate, Addresses, Account, profile) {
    
  $log.debug('ProfileEditModalController(): open(): address:', profile);

  $scope.profile = angular.copy(profile);
    
  $scope.close = function () {
    $log.debug('ProfileEditModalController()');
    $modalInstance.close({
      profile  : null,
      canceled : true
    });
  };

  $scope.save = function () {
    $log.debug('ProfileEditModalController(): save(): saving...');
    $scope.processing = true;
    Addresses.validateEmail($scope.profile.email).then(function(result) {
      $log.debug('ProfileEditModalController(): validated email: result', result);
      Account.updateClient($scope.profile).then(function (data) {
        if (data.statusCode && data.statusCode === 409) {
          $translate('EMAIL_EXISTS').then(function (message) {
            $scope.profileEditError = message;
          });
          $scope.processing = false;
        } else {
          $log.debug('ProfileEditModalController(): save(): success data:', data);
          $translate('PROFILE-SAVE-SUCCESS').then(function (message) {
            $modalInstance.close({
              profileEditInfo : message,
              profile         : angular.copy(data),
              canceled        : false
            });
            $scope.processing = false;
          });
        }
      }, function(error) {
        $log.error('ProfileEditModalController(): save(): error!', error);
        $translate('ERROR-UPDATING-PROFILE').then(function (message) {
          $scope.profileEditError = message;
        });
        $scope.processing = false;
      });
    }, function(r) {
      $log.error("ProfileEditModalController(): failed validating email", r);
      $translate('INVALID-EMAIL').then(function (message) {
        $scope.profileEditError = message;
      });
      $scope.processing = false;
    });
  };

  $scope.$on('$destroy', function () {
    $log.debug('ProfileEditModalController(): cleaning up');
    var body = $document.find('html, body');
    body.css('overflow-y', 'auto');
  });
  
});
