angular.module('app.controllers.categories')
    .controller('CategoriesController', function ($scope, $document, $rootScope, $routeParams, $log, Categories) {
        $log.debug("CategoriesController");
        $scope.categories = [];

        $rootScope.section = "store";

        // add selection index
        $scope.selectedIndex = -1;
        $scope.itemClicked = function ($index) {
            $scope.selectedIndex = $index;
        };
        
        var loadCategories = function () {
            //var start = new Date().getTime();

            Categories.query({}, function(categories, responseHeaders) {
                $log.debug("got categories on success", categories);
                $scope.categories = categories;
                $scope.loading = true;
            }, function (data) {
                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving category list.";
            });
        };
        // kick off the first refresh
        loadCategories();
    });