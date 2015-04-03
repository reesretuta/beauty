angular.module('app.controllers.products')
    .controller('ProductsController', function ($sce, HashKeyCopier, Cart, Categories, Product, Search, $scope, $rootScope, $routeParams, $q, $location, $timeout, $window, $log, $modal, $document, BreadcrumbsHelper, $translate) {
        $log.debug("ProductsController");

        $scope.errorMessage = '';
        $scope.loading = true;

        // set the navigation to all products
        $log.debug("ProductsController(): clearing breadcrumbs & setting All Project nav item");
        BreadcrumbsHelper.setPath(null, null);
        $rootScope.navStatic = '1';

        $log.debug("ProductsController(): routeParams", $routeParams);
        $scope.query = $routeParams.query || "";
        $scope.categoryId = $routeParams.categoryId;

        var loadCategories = function () {
            //var start = new Date().getTime();

            Categories.query({"recurse": true}, function(categories, responseHeaders) {
                $log.debug("CategoriesController(): got categories on success", categories);
                $scope.categories = categories;
            }, function (data) {
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving category list.";
            });
        };
        // kick off the first refresh
        loadCategories();


        var loadProducts = function () {
            $log.debug("ProductsController(): loadProducts(): loading products");

            $scope.loading = true;

            //var start = new Date().getTime();
            Product.query({"categoryId": $scope.categoryId, "search": $scope.query}).then(function(products, responseHeaders) {
                $log.debug("ProductsController(): got products", products);
                $scope.products = $scope.products.concat(products);
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
        };
        loadProducts();

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
