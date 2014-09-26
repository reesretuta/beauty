angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorJoinController', function ($scope, $document, $rootScope, $routeParams, $log, WizardHandler) {
    $rootScope.page = 'Join';

    var sku = $routeParams.sku || '';
    $log.debug("OnlineSponsorJoinController(): sku", sku);

    $scope.join = {
      currentStep: 'Sign-In',
      sku: sku
    };

    if (!$scope.join.billSame) {
        $scope.join.billSame = true;
    }

    $scope.loginOrCreateUser = function(loginEmail, loginPassword) {
      $scope.loginError = false;

      $log.debug("trying to login with username=", loginEmail, "password=", loginPassword);
      var success = true;

      if (success) {
        $log.debug("OnlineSponsorJoinController(): authenticated, moving to next step");
        // jump to Shipping
        WizardHandler.wizard('joinWizard').goTo('Consultant Profile');
      } else {
        $log.debug("OnlineSponsorJoinController(): failed to authenticate");
        $scope.loginError = true;
      }
    }

    $scope.saveProfile = function() {
      WizardHandler.wizard('joinWizard').goTo('Shipping');
    }

    $scope.saveShipping = function() {
      WizardHandler.wizard('joinWizard').goTo('Payment Method');
    }

    $scope.savePaymentMethod = function() {
      WizardHandler.wizard('joinWizard').goTo('Review');
    }

    $scope.completeOrder = function() {
      WizardHandler.wizard('joinWizard').goTo('Finish');
    }
});