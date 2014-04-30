angular.module('app.controllers.products')
    .controller('ProductDetailsController', function ($sce, HashKeyCopier, Categories, Products, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, Cart, BreadcrumbsHelper, breadcrumbs, RecentlyViewed) {
        $log.debug("ProductDetailsController");

        $scope.breadcrumbs = breadcrumbs;
        $scope.breadcrumbs.options = { 'Product Details': $routeParams.productId  };

        $scope.productId = $routeParams.productId;
        $scope.categoryId = $routeParams.category;

        $scope.breadcrumbs = breadcrumbs;
        $scope.breadcrumbs.options = { 'Product Details': $scope.productId  };

        $rootScope.page = "Product Details";
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;

        $scope.selectedProduct = {};
        
        $scope.quantities = {};

        $scope.addToCart = function(product) {
            $log.debug("ProductDetailsController(): adding product", product);
            var qty = $scope.quantities[product.itemnumber];
            if (qty == null) {
                qty = 1;
            }
            $log.debug("ProductDetailsController(): adding product", product, qty);
            var p = angular.copy(product);
            p.quantity = qty;
            Cart.addToCart(p);
        }


        $scope.addToCartGroup = function(itemnumber) {

            angular.forEach($scope.product.productskus.productdetail, function(product) {

                if (product.itemnumber == itemnumber) {

                    var qty = $scope.quantities[product.itemnumber];
                    if (qty == null) {
                        qty = 1;
                    }

                    var p = angular.copy(product);
                    p.quantity = qty;
                    Cart.addToCart(p);
                }
            })

        }


        $scope.addToRecentlyViewed = function(product) {
            $log.debug("ProductDetailsController(): adding viewed product", product);

            var p = angular.copy(product);
            RecentlyViewed.addRecentlyViewed(p);
        }


        $scope.showhide = function(itemnumber) {
            $log.debug("ProductDetailsController(): showhide", itemnumber);
            angular.forEach($scope.product.productskus.productdetail, function(product) {
                //$log.debug("ProductDetailsController(): showhide foreach", product);
                if (product.itemnumber == itemnumber) {
                    $log.debug("ProductDetailsController(): selected", product.itemnumber);
                    $scope.selectedProduct = angular.copy(product);
                }
            })
        };

        /*=== LOAD DATA ====*/

        var loadCategory = function() {
            $log.debug("ProductDetailsController(): loadCategory(): loading category", $scope.categoryId);
            Categories.get({"categoryId": $scope.categoryId, "recurse": true}, function(category, status, headers) {
                $scope.category = category;

                $log.debug("ProductDetailsController(): loaded category", category);

                var path = BreadcrumbsHelper.buildPath($scope.category, $scope.product, null);
                $scope.breadcrumbs.options = BreadcrumbsHelper.setPath($scope.breadcrumbs, path);
                $log.debug("ProductDetailsController(): after category path", path, 'replacing current breadcrumb', $scope.breadcrumbs.breadcrumbs);
            }, function(data, status, headers) {
                $log.error("error loading category", data, status);
                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving category data. Please refresh the page to try again, or contact your system administrator if the error persists.";

            })
        }
        if ($scope.categoryId) {
            loadCategory();
        }

        var loadProduct = function () {
            //var start = new Date().getTime();
            Products.get({"productId": $scope.productId}, function(product, status, headers, config) {
                $log.debug("ProductDetailsController(): got product", product);
                // We do this here to eliminate the flickering.  When Products.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.product) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.product = HashKeyCopier.copyHashKeys($scope.product, product, ["id"]);
                    //$log.debug("ProductDetailsController(): updating objects", $scope.objects);
                } else {
                    $scope.product = product;
                    //$log.debug("ProductDetailsController(): initializing objects");
                }
                if (product.groupid) {
                    $scope.showhide(product.productskus.productdetail[0].itemnumber);
                }
                $rootScope.page = product.productname;

                if ($scope.categoryId == null) {
                    // load the first category from this product, we probably landed here from search
                    if ($scope.product.categories != null) {
                        var categories = $scope.product.categories.category;
                        if (Array.isArray(categories)) {
                            $scope.categoryId = categories[0].id;
                        } else if (categories != null) {
                            $scope.categoryId = categories.id;
                        }
                    }
                }

                if ($scope.categoryId != null) {
                    $log.debug("ProductDetailsController(): loading category from product", $scope.categoryId);
                    loadCategory();
                }

                var path = BreadcrumbsHelper.buildPath($scope.category, $scope.product, null);
                $scope.breadcrumbs.options = BreadcrumbsHelper.setPath($scope.breadcrumbs, path);
                $log.debug("ProductDetailsController(): path", path, 'replacing current breadcrumb', $scope.breadcrumbs.breadcrumbs);

                // add product to recently view products
                $scope.addToRecentlyViewed(product);

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
        loadProduct();

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
