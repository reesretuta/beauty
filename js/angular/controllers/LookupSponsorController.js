
angular.module('app.controllers.checkout').controller('LookupSponsorController', function ($document, $modalInstance, $q, $scope, $log, $translate) {

    $log.debug('LookupSponsorController() loaded.');

    $scope.search = function () {
        $log.debug('LookupSponsorController(): search()');
        $scope.sponsors = [
            { name: 'test test', id: '123', city: 'city'},
            { name: 'test test', id: '123', city: 'city'}
        ];
    };

    $scope.close = function () {
        $log.debug('LookupSponsorController(): close()');
        $modalInstance.close({
            sponsorId : null,
            canceled  : true
        });
    };

    $scope.selectSponsor = function (sponsorId) {
        $log.debug('LookupSponsorController(): selectSponsor(): sponsorId:', sponsorId);
        return $modalInstance.close({
            sponsorId : sponsorId,
            canceled  : false
        });
    };

    $scope.$on('$destroy', function() {
        $log.debug('ContactEditModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
