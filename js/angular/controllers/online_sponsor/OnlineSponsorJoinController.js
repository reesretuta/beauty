angular.module('app.controllers.onlineSponsor')
    .controller('OnlineSponsorJoinController', function ($scope, $document, $rootScope, $routeParams, $log, Categories) {
        $rootScope.page = 'Join';

        $rootScope.step = "landing";
    });