angular.module('app.controllers.home')
    .controller('HomeController', function ($scope, $document, $rootScope, $routeParams, $log, Categories) {
        $rootScope.title = 'Our Products';

        $rootScope.section = "store";

        console.log('HomeController');

        $scope.objects = [];
        var loadCategories = function () {
            //var start = new Date().getTime();
            var categories = Categories.query({}, function (value, responseHeaders) {
                $log.debug("got categories", categories);
                $scope.objects = categories;
                $scope.loading = true;
            }, function (data) {
                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving object list. Please refresh the page to try again, or contact your system administrator if the error persists.";
            });
        }
        // kick off the first refresh
        loadCategories();
    });