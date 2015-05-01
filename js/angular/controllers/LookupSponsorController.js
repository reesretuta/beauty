
angular.module('app.controllers.checkout').controller('LookupSponsorController', function ($document, $modalInstance, $q, $scope, $log, $translate, Sponsor) {

    $log.debug('LookupSponsorController() loaded.');

    $scope.query = {};

    $scope.search = function () {
        Sponsor.search($scope.query).then(function (results) {
            $scope.sponsors = results;
        }, function (error) {

        });
    };

    $scope.checkValidSearchType = function () {
        // TODO
        return true;
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
