angular.module('app.controllers.cart')
    .controller('CheckoutController', function ($scope, $document, $rootScope, $routeParams, $log, Cart, Products, HashKeyCopier) {
        $log.debug("CheckoutController");

        //change page title
        $rootScope.page = "Checkout";

        $scope.products = [];

        var loadCart = function() {
            $scope.products = Cart.getItems();
            $log.debug("loaded cart products", $scope.products);
        }
        loadCart();

//        var loadProducts = function () {
//            //var start = new Date().getTime();
//            Products.query({"productIds": Object.keys(Cart.getItems())}, function(products, responseHeaders) {
//                $log.debug("got products", products);
//                // We do this here to eliminate the flickering.  When Products.query returns initially,
//                // it returns an empty array, which is then populated after the response is obtained from the server.
//                // This causes the table to first be emptied, then re-updated with the new data.
//                if ($scope.products) {
//                    // update the objects, not just replace, else we'll yoink the whole DOM
//                    $scope.products = HashKeyCopier.copyHashKeys($scope.products, products, ["id"])
//                    //$log.debug("updating objects", $scope.objects);
//                } else {
//                    $scope.products = products;
//                    //$log.debug("initializing objects");
//                }
//
//                $scope.loading = false;
//            }, function (data) {
//                //$log.debug('refreshProducts(): groupName=' + groupName + ' failure', data);
//                if (data.status == 401) {
//                    // Looks like our session expired.
//                    return;
//                }
//
//                //Hide loader
//                $scope.loading = false;
//                // Set Error message
//                $scope.errorMessage = "An error occurred while retrieving object list. Please refresh the page to try again, or contact your system administrator if the error persists.";
//            });
//        }
//        // kick off the first refresh
//        loadProducts();
    });