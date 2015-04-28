
angular.module('app.controllers.checkout').controller('LookupSponsorController', function ($document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $window, $log, $translate, Addresses, Session, Consultant) {

    $log.debug('LookupSponsorController()');
    
    // $scope.profile = {
    //     zip: '',
    //     firstName: '',
    //     lastName: ''
    // }
    
    
    $scope.search = function(){
        // if ($scope.profile.firstName != '' && $scope.profile.lastName != '') {
        //     Consultant.searchByName();
        //
        // }else{
        //     Consultant.searchByZip(12345).then(function(data){
        //
        //     });
        // }
        
        $scope.sponsors = [
            {name: 'test test', id: '123', city: 'city'},
            {name: 'test test', id: '123', city: 'city'},
            {name: 'test test', id: '123', city: 'city'},
            {name: 'test test', id: '123', city: 'city'},
            {name: 'test test', id: '123', city: 'city'}
        ];
        
    }

    $scope.close = function () {
        $log.debug('LookupSponsorController()');
        $modalInstance.close({
            canceled : true
        });
    };

    $scope.selectSponsor = function(sponsorId){
        return $modalInstance.close({
            sponsorId  : sponsorId,
            canceled : false
        });
    };
    
    $scope.save = function () {
        // $log.debug('LookupSponsorController(): save(): trying email:', $scope.profile.loginEmail);
        // if (JSON.stringify($scope.profile) === JSON.stringify(originalProfile)) {
        //     return $modalInstance.close({
        //         profile  : $scope.profile,
        //         canceled : false
        //     });
        // }
        // if (JSON.stringify($scope.profile) === JSON.stringify(originalProfile)) {
        //     return $modalInstance.close({
        //         profile  : $scope.profile,
        //         canceled : false
        //     });
        // }
        // Addresses.validateEmail($scope.profile.loginEmail).then(function (email) {
//             Session.consultantEmailAvailable($scope.profile.loginEmail, false).then(function(available) {
//                 if (available) {
//                     $log.debug('CheckoutController(): Session: client available', available);
//                     $modalInstance.close({
//                         profile  : $scope.profile,
//                         canceled : false
//                     });
//                 } else {
//                     $log.debug('ContactEditModalController(): save(): email invalid');
//                     $translate('INVALID-EMAIL-ADDRESS-IN-USE').then(function (message) {
//                         $log.debug('ContactEditModalController(): INVALID-EMAIL-ADDRESS-IN-USE');
//                         $scope.emailError = message;
//                     });
//                 }
//             }, function(error) {
//                 $log.error('CheckoutController(): Session: client email ERROR', error);
//                 $translate('INVALID-EMAIL-ADDRESS-IN-USE').then(function (message) {
//                     $log.debug('ContactEditModalController(): INVALID-EMAIL-ADDRESS-IN-USE');
//                     $scope.emailError = message;
//                 });
//             });
//         }, function(error) {
//             $log.debug('ContactEditModalController(): save(): email invalid', error);
//             $translate('INVALID-EMAIL').then(function (message) {
//                 $scope.emailError = message;
//             });
//         });
    };

    $scope.$on('$destroy', function() {
        $log.debug('ContactEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
