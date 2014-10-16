angular.module('app.controllers.lang')
    .controller('LanguageSwitchController', function ($scope, $document, $log, $timeout, $location, $translate, Session, $rootScope, $routeParams, JOIN_BASE_URL) {

        $scope.language = function(language) { 
        
//        $log.debug('current language',Session.getLanguage());
        Session.setLanguage(language);
        $scope.$watch('session.language', function(newVal, oldVal) {
            $translate.use(Session.getLocalSession().language);
        });
//        $log.debug('current language',Session.getLanguage());
    }
    });