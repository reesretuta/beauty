
angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $document, $location, $translate, $rootScope, $routeParams, $log, Session, JOIN_BASE_URL, Categories, Product) {
    $rootScope.title = 'Join';

    $rootScope.inCheckout = false;

    $scope.getSessionLanguage = function() {
        var lang = Session.getLanguage();
        $log.debug("OnlineSponsorLandingController(): get session language", lang);
        return lang;
    }

    $scope.join = function(sku, language, name, price) {
        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
        $log.debug("joining with sku", sku);
        $log.debug("language", language);
        $location.url(JOIN_BASE_URL + "/checkout?sku=" + sku);
    };
    
    $scope.productMap = [];
    
    var loadProduct = function() {
        Product.query({"productIds": ["19634", "19635", "19822", "19823"]}).then(function(products, status, headers, config) {
           for (var i = 0; i < products.length; i++) {
               $log.debug('OS product',products[i].id);
               $scope.productMap[products[i].id] = products[i];
           }
           console.log('OnlineSponsorLandingController: ($translating)');
           /*$translate('OS-KIT-PRODUCT1-DESCRIPTION').then(function (items) {
                console.log(items);
                $scope.items = items;
                console.log('$scope.items:', $scope.items);
           });*/
        }, function (data) {
            if (data.status == 401) {
                // Looks like our session expired.
                return;
            }
       });
    };
    loadProduct();
    
});