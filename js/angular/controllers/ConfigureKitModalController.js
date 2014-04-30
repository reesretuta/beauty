angular.module('app.controllers.products')
    .controller('ConfigureKitModalController', function ($sce, HashKeyCopier, Cart, Categories, Products, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, quantity, product) {
        $log.debug("ConfigureKitModalController");

        $scope.product = angular.copy(product);
        $scope.product.quantity = quantity;

        $log.debug("configuring product", product);

        $scope.selectedProduct = null;

        var productsToConfigure = product.kitgroup.productskus.itemnumber;

        // load products

        var loadProducts = function (productIds) {
            //var start = new Date().getTime();
            Products.query({"productIds": productIds}, function(products, responseHeaders) {
                $log.debug("ConfigureKitModalController: got products", products);
                // We do this here to eliminate the flickering.  When Products.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.products) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.products = HashKeyCopier.copyHashKeys($scope.products, products, ["id"])
                    //$log.debug("ProductsController: updating objects", $scope.objects);
                } else {
                    $scope.products = products;
                    //$log.debug("ProductsController: initializing objects");
                }

                //$scope.breadcrumbs.options = {};
                //$scope.breadcrumbs.options[$scope.breadcrumbs.breadcrumbs[$scope.breadcrumbs.breadcrumbs.length-1].label] = path;

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
        loadProducts(productsToConfigure);

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("canceling saving kit");
            $modalInstance.close();
        };

        $scope.save = function () {
            $log.debug("saving kit");
            $scope.product.configuration = {};
            $scope.product.configuration[product.kitgroup] = $scope.selectedProduct;
            Cart.addToCart($scope.product);
            $modalInstance.close();
        };

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
