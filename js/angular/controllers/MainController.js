angular.module('app.controllers.main')
    .controller('MainController', function ($scope, $document, $rootScope, $routeParams, $log, Categories, Cart) {

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