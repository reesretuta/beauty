
angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $window, $document, $location, $translate, $rootScope, $routeParams, $log, $analytics, Session, JOIN_BASE_URL, Categories, Product, Leads) {
    
    $rootScope.title = 'JOIN_JAFRA_TITLE';

    $rootScope.inCheckout = false;
    $scope.profile = {};
    $scope.showThanks = false;

    $scope.getSessionLanguage = function() {
        var lang = Session.getLanguage();
        $log.debug("OnlineSponsorLandingController(): get session language", lang);
        return lang;
    }

    $scope.getSessionSource = function() {
        var source = Session.getSource();
        $log.debug("OnlineSponsorLandingController(): get session source", source);
        return source;
    }
    
    $scope.join = function(sku, language) {
        $log.debug("OnlineSponsorLandingController(): join()", $scope.profile.firstName, $scope.profile.lastName, $scope.profile.loginEmail, $scope.profile.phoneNumber);

        $('.modal').modal('hide');
        $('body').removeClass('modal-open');
        $('.modal-backdrop').remove();
        $log.debug("joining with sku", sku);
        $log.debug("language", language);
        if ( $rootScope.iveBeenFramed ) {
          $window.open(JOIN_BASE_URL + "/checkout?sku=" + sku +
            "&language=" + $scope.getSessionLanguage() +
            "&source=" + $scope.getSessionSource() +
            "&firstName=" + $scope.profile.firstName +
            "&lastName=" + $scope.profile.lastName +
            "&loginEmail=" + $scope.profile.loginEmail +
            "&phoneNumber=" + $scope.profile.phoneNumber);
        } else {
          $location.url(JOIN_BASE_URL + "/checkout?sku=" + sku +
            "&firstName=" + $scope.profile.firstName +
            "&lastName=" + $scope.profile.lastName +
            "&loginEmail=" + $scope.profile.loginEmail +
            "&phoneNumber=" + $scope.profile.phoneNumber);
        }
    };

    $scope.joinFirstStep = function() {
        $log.debug("OnlineSponsorLandingController(): joinFirstStep()", $scope.profile.firstName, $scope.profile.lastName, $scope.profile.loginEmail, $scope.profile.phoneNumber);

        $scope.showThanks = true;
    }

    $scope.addLead = function() {
        Leads.save({
            email: $scope.profile.loginEmail,
            firstName: $scope.profile.firstName,
            lastName: $scope.profile.lastName,
            phone: $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
            language: Session.get().language,
            type: 'jj-moreinfo'
        }).$promise.then(function(lead) {
            $log.debug("MainController(): addLead(): lead created");

            // FIXME do something here
        }, function(error) {
            $log.error("MainController(): addLead(): failed to create lead", error);
            // FIXME show error here
        });
    }

    $scope.productMap = [];
    
    var loadProduct = function() {
        Product.query({"productIds": ["19634", "19635", "19822", "19823", "20494", "20495", "20498", "20499"]}).then(function(products, status, headers, config) {
           for (var i = 0; i < products.length; i++) {
               //$log.debug('OS product',products[i].id);
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