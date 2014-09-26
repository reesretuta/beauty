angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $rootScope, $routeParams, $log, Categories) {
    $rootScope.page = 'Join';

    $scope.join = function(sku) {
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();

        $log.debug("joining with sku", sku);
        $location.path("/online_sponsoring/join").search("sku", sku);
    };
});