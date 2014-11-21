
angular.module('app.controllers.lang').controller('LanguageSwitcherController', function ($scope, $document, $log, $timeout, $location, $translate, Session, $rootScope, $routeParams, JOIN_BASE_URL) {

    'use strict';

    angular.element('.language-dropdown .dropdown-menu input, .language-dropdown .dropdown-menu button').on('click', function(evt) {
        evt.stopPropagation();
    });

    $log.debug('LanguageSwitcherController(): instantiate, (%s)', $rootScope.session.language);

    //$log.debug('current language',Session.getLanguage());

    $scope.language = {
        current: 'en_US'
    };

    Session.get().then(function(session) {
        $log.debug('LanguageSwitcherController(): loaded language', session.language);
        $scope.language.current = session.language;

        $scope.$watch('language.current', function (newVal, oldVal) {
            $log.debug('LanguageSwitcherController(): language changed');
            Session.setLanguage(newVal);
        });
    });

    //session.language
    $scope.setLanguage = function (language) {
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