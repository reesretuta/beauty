angular.module('app.controllers.main')
    .controller('MainController', function ($scope, $document, $rootScope, $routeParams, $log, Categories, Cart) {
//        $log.debug("MainController");
//        $scope.categories = [];
//        var loadCategories = function () {
//            //var start = new Date().getTime();
//            var categories = Categories.query({}, function (value, responseHeaders) {
//                $log.debug("got categories", categories);
//                $scope.categories = categories;
//                $scope.loading = true;
//            }, function (data) {
//                //Hide loader
//                $scope.loading = false;
//                // Set Error message
//                $scope.errorMessage = "An error occurred while retrieving category list. Please refresh the page to try again, or contact your system administrator if the error persists.";
//            });
//        }
//        // kick off the first refresh
//        loadCategories();

        $rootScope.getItemsInCart = function() {
            var count = Cart.getItemCount();
            $log.debug("items count", count);
            return count;
        }
        
        $scope.removeFromCart = function(product) {
            $log.debug("removing product", product);
            Cart.removeFromCart(product);
        }
        
        $scope.quantities = {};

        $scope.addToCart = function(product) {
            $log.debug("adding product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            
            $log.debug("adding product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.addToCart(p);
        }

        $scope.updateCart = function(product) {
            $log.debug("updating product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            $log.debug("updating product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.updateCart(p);
        }
    });