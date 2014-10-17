angular.module('app.controllers.lang').controller('LanguageSwitcherController', function ($scope, $document, $log, $timeout, $location, $translate, Session, $rootScope, $routeParams, JOIN_BASE_URL) {

        $scope.language = function (language) {
            //$log.debug('current language',Session.getLanguage());
            $scope.$watch($rootScope.session.language, function (newVal, oldVal) {
                $translate.use(Session.getLocalSession().language);
            });
            Session.setLanguage(language);
            //$log.debug('current language',Session.getLanguage());
        }

        $scope.getCurrentLanguage = function() {
            if (Session.getLanguage() == 'es_US') {
                return 'LAN02';
            }
            return 'LAN01';
        }
    });