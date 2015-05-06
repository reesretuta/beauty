
angular.module('app.controllers.checkout').controller('LookupSponsorController', function ($document, $modalInstance, $q, $scope, $log, $translate, Sponsor) {

    $log.debug('LookupSponsorController() loaded.');

    function search (type) {
        var payload;
        // clear current results, if any
        $scope.sponsors = [];
        $log.debug('LookupSponsorController(): search(): type:', type);
        if (type === 'zip') {
            payload = {
                zip : $scope.zip
            }
        } else if (type === 'name') {
            payload = {
                firstName : $scope.firstName,
                lastName  : $scope.lastName
            }
        }
        $log.debug('LookupSponsorController(): search(): payload:', payload);
        Sponsor.search(payload).then(function (results) {
            $scope.sponsors = results;
        }, function (error) {
            $log.error('LookupSponsorController(): search(): error:', error);
        });
    };

    $scope.searchByZip = function () {
        search('zip');
    };

    $scope.searchByName = function () {
        search('name');
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
