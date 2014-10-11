angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $rootScope, $routeParams, $log, Session, JOIN_BASE_URL, Categories) {
    $rootScope.title = 'Join';

    $rootScope.inCheckout = false;

    var cid = $routeParams.cid;
    var source = $routeParams.source;
    $log.debug("OnlineSponsorLandingController(): sponsorId", cid, "source", source);

    Session.set({
        "consultantId": cid,
        "source": source
    }).then(function(session) {
        $log.debug("OnlineSponsorLandingController(): save to session sponsorId", cid, "source", source);
    }, function(err) {
        $log.debug("OnlineSponsorLandingController(): failed to save to session sponsorId", cid, "source", source);
    });

    $scope.join = function(sku, language, name, price) {
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();

        $log.debug("joining with sku", sku);
        $log.debug("language", language);
        $location.path(JOIN_BASE_URL + "/checkout").search({"sku": sku,"name": name, "price": price});
    };
});