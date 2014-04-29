angular.module('app.controllers.products')
    .controller('ProductsController', function ($sce, HashKeyCopier, Cart, Categories, Products, Search, $scope, $rootScope, $routeParams, $q, $location, $timeout, $window, $log, $modal, $document, breadcrumbs) {
        $log.debug("ProductsController");

        $scope.breadcrumbs = breadcrumbs;
        $scope.currentBreadcrumb = {};

        $rootScope.page = "Products";
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;


        $log.debug("routeParams", $routeParams);
        $log.debug("routeParams.category", $routeParams.category);
        $log.debug("routeParams.search", $routeParams.search);
        $scope.categoryId = $routeParams.category;
        $scope.category = {};

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

        var categoriesLoadedPromise = $q.defer();
        var loadCategory = function() {
            Categories.get({"categoryId": $scope.categoryId, "recurse": true}, function(category, status, headers) {
                $scope.category = category;

                $log.debug("loaded category", category);

                $rootScope.page = 'Products / ' + category.name;
                categoriesLoadedPromise.resolve(category);
            }, function(data, status, headers) {
                $log.error("error loading category", data, status);
                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving category data. Please refresh the page to try again, or contact your system administrator if the error persists.";

            })
        }
        loadCategory();

        var loadProducts = function () {
            //var start = new Date().getTime();
            Products.query({"categoryId": $scope.categoryId}, function(products, responseHeaders) {
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

                var path = $scope.buildPath($scope.category, null, null);
                $log.debug("path", path, 'replacing current breadcrumb', $scope.breadcrumbs.breadcrumbs);

                $scope.breadcrumbs.options = {};
                $scope.breadcrumbs.options[$scope.breadcrumbs.breadcrumbs[$scope.breadcrumbs.breadcrumbs.length-1].label] = path;

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

        categoriesLoadedPromise.promise.then(function(category) {
            $log.debug("loading products after category loaded");
            // kick off the first refresh
            loadProducts();
        });

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
