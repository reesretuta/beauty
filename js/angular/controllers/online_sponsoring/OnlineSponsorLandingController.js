angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $rootScope, $routeParams, $log, JOIN_BASE_URL, Categories) {
    $rootScope.title = 'Join';

    $rootScope.inCheckout = false;

    $scope.join = function(sku, language) {
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();

        $log.debug("joining with sku", sku);
        $log.debug("language", language);
        $location.path(JOIN_BASE_URL + "/checkout").search("sku", sku);
    };
});