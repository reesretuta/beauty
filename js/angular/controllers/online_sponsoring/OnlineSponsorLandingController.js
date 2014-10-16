angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $translate, $rootScope, $routeParams, $log, Session, JOIN_BASE_URL, Categories, Products) {
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
    

    
    // get product details from DB
//    var loadProduct = function (productId) {
//
//        Products.get({"productId": productId}).then(function(product, status, headers, config) {
//
//
//            $scope.product = product;
//
//
//
//        }, function (data) {
//            $log.error("ProductDetailsController(): loadProduct(): failed to load product", data);
//            //$log.debug('refreshProducts(): groupName=' + groupName + ' failure', data);
//            if (data.status == 401) {
//                // Looks like our session expired.
//                return;
//            }
//
//       });
//    }
    
    $scope.productMap = [];
    
    var loadProduct = function() {
        Products.query({"productIds": ["19634", "19635", "19636", "19637"]}).then(function(products, status, headers, config) {

           for(i=0; i<products.length; i++) {
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