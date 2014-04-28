angular.module('app.controllers.categories')
    .controller('CategoryController', function ($scope, $document, $rootScope, $routeParams, $log, Categories, $http) {
        $log.debug("CategoryController");
        $scope.categories = [];
        var loadCategories = function () {
            //var start = new Date().getTime();
            
            $http.get('/api/categories.xml').success(function(data) {
                var categories = $.xml2json(data);
                $scope.categories = categories.categorydetail;
            });
        
            
//            var categories = cattojson.query({}, function (value, responseHeaders) {
//                $log.debug("got categories", categories);
//                $scope.categories = categories;
//                $scope.loading = true;
//            }, function (data) {
//                //Hide loader
//                $scope.loading = false;
//                // Set Error message
//                $scope.errorMessage = "An error occurred while retrieving category list.";
//            });
        }
        // kick off the first refresh
        loadCategories();
    });