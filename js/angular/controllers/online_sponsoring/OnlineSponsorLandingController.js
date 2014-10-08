angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $rootScope, $routeParams, $log, JOIN_BASE_URL, Categories) {
    $rootScope.title = 'Join';

    $scope.join = function(sku) {
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();

        $log.debug("joining with sku", sku);
        $location.path(JOIN_BASE_URL + "/checkout").search("sku", sku);
    };
});