
angular.module('app.controllers.onlineSponsor')
.controller('OnlineSponsorLandingController', function ($scope, $window, $document, $location, $translate, $rootScope, $routeParams, $log, $analytics, Session, JOIN_BASE_URL, Categories, Product, Leads) {
    
    $rootScope.title = 'JOIN_JAFRA_TITLE';

    $rootScope.inCheckout = false;
    $scope.profile = {};
    $scope.showThanks = false;
    
    $scope.fromLead = false;

    // this page will watch for URL changes for back/forward that require it to change anything needed (like search)
    var cancelChangeListener;
    function createListener() {
        $log.debug("OnlineSponsorLandingController(): createListener(): creating change listener");
        cancelChangeListener = $rootScope.$on('$locationChangeSuccess', function(event, absNewUrl, absOldUrl){
            var url = $location.url(),
                path = $location.path(),
                params = $location.search();

            $log.debug("OnlineSponsorLandingController(): changeListener(): locationChangeSuccess", url, params);

            // determine chat hour availability
            $rootScope.isChatAvailable = (function () {
                var pacificTime, hour;
                pacificTime = moment().tz('America/Los_Angeles').format('HHmm');
                hour = moment(pacificTime).get('hour');
                $log.debug('OnlineSponsorLandingController(): isChatAvailable: hour:', hour);
                if (hour >= 8 && hour < 18) {
                    return true;
                } else {
                    return false;
                }
            }());

            $log.debug('OnlineSponsorLandingController(): isChatAvailable:', $rootScope.isChatAvailable); 

            // keep cid / source in URL
            if (params.cid == null || params.source == null) {
                Session.get().then(function(session) {
                    if (session.cid != null || session.source != null) {
                        $log.debug("OnlineSponsorLandingController(): changeListener(): preserving cid/source in URL");
                        if (session.consultantId != null) {
                            $log.debug("OnlineSponsorLandingController(): changeListener(): using session cid", session.consultantId);
                            params["cid"] = session.consultantId;
                            params["source"] = session.source;
                            $location.search(params);
                            $location.replace();
                            $log.debug("OnlineSponsorLandingController(): changeListener(): replace URL");
                        }
                    }
                });
            }
        });
    }
    createListener();        
        
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
            ($scope.profile.firstName != null ? "&firstName=" + $scope.profile.firstName : "") +
            ($scope.profile.lastName != null ? "&lastName=" + $scope.profile.lastName : "") +
            ($scope.profile.loginEmail != null ? "&loginEmail=" + $scope.profile.loginEmail : "") +
            ($scope.profile.phoneNumber != null ? "&phoneNumber=" + $scope.profile.phoneNumber : ""));
        } else {
          $location.url(JOIN_BASE_URL + "/checkout?sku=" + sku +
            ($scope.profile.firstName != null ? "&firstName=" + $scope.profile.firstName : "") +
            ($scope.profile.lastName != null ? "&lastName=" + $scope.profile.lastName : "") +
            ($scope.profile.loginEmail != null ? "&loginEmail=" + $scope.profile.loginEmail : "") +
            ($scope.profile.phoneNumber != null ? "&phoneNumber=" + $scope.profile.phoneNumber : ""));
        }
    };

    $scope.joinFirstStep = function() {
        $log.debug("OnlineSponsorLandingController(): joinFirstStep()", $scope.profile.firstName, $scope.profile.lastName, $scope.profile.loginEmail, $scope.profile.phoneNumber);
        $scope.fromLead = true;
        $scope.showThanks = true;
    }

    $scope.addLead = function() {
        var leadData = {
            email: $scope.profile.loginEmail,
            firstName: $scope.profile.firstName,
            lastName: $scope.profile.lastName,
            phone: $scope.profile.phoneNumber.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
            language: Session.get().language,
            type: 'jj-moreinfo'
        };
        $log.debug("OnlineSponsorLandingController(): addLead(): creating lead", leadData);
        
        Leads.save(leadData).$promise.then(function(lead) {
            $log.debug("OnlineSponsorLandingController(): addLead(): lead created", lead);
            $log.debug('OnlineSponsorLandingController() addLead(): analytics:');
            $analytics.pageTrack('/leads/collected');
            // FIXME do something here
        }, function(error) {
            $log.error("OnlineSponsorLandingController(): addLead(): failed to create lead", error);
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