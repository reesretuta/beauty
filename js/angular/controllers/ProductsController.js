angular.module('app.controllers.products')
    .controller('ProductsController', function ($sce, HashKeyCopier, Cart, Products, Search, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, breadcrumbs) {
$scope.breadcrumbs = breadcrumbs;

        $rootScope.page = "Products";
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;


        $log.debug("routeParams", $routeParams);
        $log.debug("routeParams.category", $routeParams.category);
        $log.debug("routeParams.search", $routeParams.search);
        $scope.category = $routeParams.category;

        Search.search($routeParams.search);

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

        /*==== SEARCH ====*/
        $scope.searchFunction = function(product) {
            // no search string, match everything
            var query = Search.getQuery();
            if (S(query).isEmpty()) {
                return true;
            }

            if (S(product.productname).toLowerCase().indexOf(S(query).toLowerCase())!=-1 ||
                S(product.productnumber).toLowerCase().indexOf(S(query).toLowerCase())!=-1)
            {
                return true;
            }
            return false;
        }

        /*=== LOAD DATA ====*/

        var loadProducts = function () {
            //var start = new Date().getTime();
            Products.query({"categoryId": $scope.category}, function(products, responseHeaders) {
                $log.debug("got products", products);
                // We do this here to eliminate the flickering.  When Products.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.products) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.products = HashKeyCopier.copyHashKeys($scope.products, products, ["id"])
                    //$log.debug("updating objects", $scope.objects);
                } else {
                    $scope.products = products;
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
        loadProducts();

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });