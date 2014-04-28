angular.module('app.controllers.products')
    .controller('ProductDetailsController', function ($sce, HashKeyCopier, Products, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document) {

        $rootScope.page = "Product Details";

        $scope.errorMessage = '';
        $scope.loading = true;

        $scope.productId = $routeParams.productId;

        /*=== LOAD DATA ====*/

        var loadProduct = function () {
            //var start = new Date().getTime();
            Products.get({"productId": $scope.productId}, function(product, status, headers, config) {
                $log.debug("got product", product);
                // We do this here to eliminate the flickering.  When Products.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.product) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.product = HashKeyCopier.copyHashKeys($scope.product, product, ["id"]);
                    //$log.debug("updating objects", $scope.objects);
                } else {
                    $scope.product = product;
                    //$log.debug("initializing objects");
                }
                $scope.loading = false;
            }, function (data) {
                //$log.debug('refreshProducts(): groupName=' + groupName + ' failure', data);
                if (data.status == 401) {
                    // Looks like our session expired.
                    return;
                }

                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving object list. Please refresh the page to try again, or contact your system administrator if the error persists.";
            });
        }
        // kick off the first refresh
        loadProduct();

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });