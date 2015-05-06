
angular.module('app.controllers.checkout').controller('LookupSponsorController', function ($document, $modalInstance, $q, $scope, $log, $translate, Sponsor) {

    $log.debug('LookupSponsorController() loaded.');

    // forms object for having access to form methods - initiate collection
    $scope.forms = {};

    // success message w/ results?
    $scope.successMessage = null;

    // error message / no results?
    $scope.errorMessage = null;

    function search (type) {
        var payload;
        // clear current results, if any and messages
        $scope.sponsors = [];
        $scope.successMessage = null;
        $scope.errorMessage = null;
        $log.debug('LookupSponsorController(): search(): type:', type);
        if (type === 'zip') {
            // clear search by name
            $scope.firstName = '';
            $scope.forms.sponsorByNameForm.firstName.$setPristine();
            $scope.forms.sponsorByNameForm.firstName.$setUntouched();
            $scope.lastName = '';
            $scope.forms.sponsorByNameForm.lastName.$setPristine();
            $scope.forms.sponsorByNameForm.lastName.$setUntouched();
            // setup post data
            payload = {
                zip : $scope.zip
            };
        } else if (type === 'name') {
            // clear search by zip if any
            $scope.zip = '';
            $scope.forms.sponsorByZipForm.zip.$setPristine();
            $scope.forms.sponsorByZipForm.zip.$setUntouched();
            // setup post data
            payload = {
                firstName : $scope.firstName,
                lastName  : $scope.lastName
            };
        }
        // perform actual search after payload setup
        $log.debug('LookupSponsorController(): search(): payload:', payload);
        Sponsor.search(payload).then(function (sponsors) {
            $scope.sponsors = sponsors;
            $log.debug('LookupSponsorController(): sponsors:', sponsors);
            if ($scope.sponsors.length && $scope.sponsors.length > 0) {
                if (type === 'zip') {
                   $translate('SPONSORS-SEARCH-FOUND-ZIP', { 
                        zip   : $scope.zip,
                        count : $scope.sponsors.length
                    }).then(function (message) {
                        $scope.successMessage = message;
                    });
                } else if (type === 'name') {
                    $translate('SPONSORS-SEARCH-FOUND-NAME', {
                        firstName : $scope.firstName,
                        lastName : $scope.lastName,
                        count    : $scope.sponsors.length
                    }).then(function (message) {
                        $scope.successMessage = message;
                    });
                }
            } else {
                $translate('SPONSORS-SEARCH-NO-SPONSORS-FOUND').then(function (message) {
                    $scope.errorMessage = message;
                });
            }
        }, function (error) {
            $log.error('LookupSponsorController(): search(): error:', error);
            $translate('SPONSORS-SEARCH-UNKNOWN-ERROR').then(function (message) {
                $scope.errorMessage = message;
            });
        });
    };

    $scope.searchByZip = function () {
        return search('zip');
    };

    $scope.searchByName = function () {
        return search('name');
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
