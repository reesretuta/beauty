
angular.module('app.controllers.account').controller('ProfileEditModalController', function ($document, $window, $modalInstance, $q, $scope, $log, profile, Account) {
    
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
    Account.updateClient($scope.profile).then(function (data) {
      $log.debug('ProfileEditModalController(): save(): success data:', data);
      $modalInstance.close({
        profile  : $scope.profile,
        canceled : false
      });
    }, function(error) {
      $log.error('ProfileEditModalController(): save(): error!', error);
      $scope.profileEditError = error;
    });
  };

  $scope.$on('$destroy', function () {
    $log.debug('ProfileEditModalController(): cleaning up');
    var body = $document.find('html, body');
    body.css('overflow-y', 'auto');
  });
  
});
