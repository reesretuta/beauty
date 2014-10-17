angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $translate, $rootScope, $routeParams, $log, Session, JOIN_BASE_URL, Categories, Products) {
    $rootScope.title = 'Join';

    $rootScope.inCheckout = false;

    var cid = $routeParams.cid;
    var source = $routeParams.source;
    var language = $routeParams.language;
    $log.debug("OnlineSponsorLandingController(): sponsorId", cid, "source", source, "language", language);

    Session.setLanguage(language);
    $translate.use(language);

    Session.set({
        "consultantId": cid,
        "source": source,
        "language": language
    }).then(function(session) {
        $log.debug("OnlineSponsorLandingController(): save to session", session);
    }, function(err) {
        $log.debug("OnlineSponsorLandingController(): failed to save to session sponsorId", cid, "source", source, "language", language);
    });

    $scope.join = function(sku, language, name, price) {
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();

        $log.debug("joining with sku", sku);
        $log.debug("language", language);
        $location.path(JOIN_BASE_URL + "/checkout").search({
            "sku": sku
        });
    };
    
    $scope.productMap = [];
    
    var loadProduct = function() {
        Products.query({"productIds": ["19634", "19635", "19636", "19637"]}).then(function(products, status, headers, config) {

           for(var i=0; i<products.length; i++) {
               $log.debug('OS product',products[i].id);
               $scope.productMap[products[i].id] = products[i];
           }

        }, function (data) {
            if (data.status == 401) {
                // Looks like our session expired.
                return;
            }
       });
    };
    loadProduct();
    
});