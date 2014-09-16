angular.module('app.controllers.top')
    .controller('TopController', function ($scope, $document, $timeout, $location, $rootScope, $routeParams) {

        console.log('top controller', $location.search().site);

        // this controller handles toggling between Online Sponsor and Client Direct
        if (S($location.path()).startsWith("/online_sponsor")) {
            console.log('online sponsor');
            $scope.site = 'OnlineSponsor';
            $scope.title = 'Online Sponsor';
        } else {
            console.log('client direct');
            $scope.site = 'ClientDirect';
            $scope.title = 'MyJAFRA Store';
        }
    });