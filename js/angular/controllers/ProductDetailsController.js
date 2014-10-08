angular.module('app.controllers.products')
    .controller('ProductDetailsController', function ($sce, WizardHandler, HashKeyCopier, Categories, Products, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, Cart, BreadcrumbsHelper, RecentlyViewed) {
        $log.debug("ProductDetailsController");

        $scope.productId = $routeParams.productId;
        $scope.categoryId = $routeParams.category;

        $rootScope.title = "Product Details";
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;

        $scope.selectedProduct = {};
        
        $scope.quantities = {};

        // reset the navigation
        BreadcrumbsHelper.setPath(null, null);

        $scope.addToCart = function(product) {
            $log.debug("ProductDetailsController(): adding product", product);
            var qty = $scope.quantities[product.sku];
            if (qty == null) {
                qty = 1;
            }
            $log.debug("ProductDetailsController(): adding product", product, qty);
            Cart.addToCart({
                name: product.name,
                sku: product.sku,
                quantity: qty,
                kitSelections: {}
            });
        }


        $scope.addToCartGroup = function(sku) {

            angular.forEach($scope.product.contains, function(item) {

                if (item.product.sku == sku) {

                    var qty = $scope.quantities[item.product.sku];
                    if (qty == null) {
                        qty = 1;
                    }

                    Cart.addToCart({
                        name: item.product.name,
                        sku: item.product.sku,
                        quantity: qty,
                        kitSelections: {}
                    });
                }
            })

        }

        $scope.configureKit = function() {
            var d = $modal.open({
                backdrop: true,
                keyboard: false, // we will handle ESC in the modal for cleanup
                windowClass: "configureKitModal",
                templateUrl: '/partials/products/configure-kit-modal.html',
                controller: 'ConfigureKitModalController',
                resolve: {
                    item: function() {
                        var qty = $scope.quantities[$scope.product.sku];
                        if (qty == null) {
                            qty = 1;
                        }

                        return {
                            name: $scope.product.name,
                            sku: $scope.product.sku,
                            quantity: qty,
                            kitSelections: {},
                            product: $scope.product
                        };
                    },
                    quantity: function() {
                        var qty = $scope.quantities[$scope.product.sku];
                        if (qty == null) {
                            qty = 1;
                        }
                        return qty;
                    },
                    inCart: function() {
                        return false;
                    },
                    whizFunc: function() {
                        return function() {
                            //WizardHandler.wizard('checkoutWizard').goTo('Shipping');
                        }
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(cartItem) {
                $log.debug("configure kit dialog closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                if (cartItem != null) {
                    $log.debug("add kit to cart", cartItem);

                    var n = cartItem.quantity;
                    cartItem.quantity = 1;
                    for (var i=0; i < n; i++) {
                        Cart.addToCart(cartItem);
                    }
                }
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");
        }

        $scope.zoomImage = function() {
            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "zoomImageModal",
                templateUrl: '/partials/products/zoom-image-modal.html',
                controller: 'ZoomImageModalController',
                resolve: {
                    product: function() {
                        return $scope.product;
                    }
                }
            });

            var body = $document.find('body');

            d.result.then(function(product) {
                $log.debug("zoom image dialog closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");
            });

            // prevent page content from scrolling while modal is up
            $("body").css("overflow-y", "hidden");
        }

        $scope.addToRecentlyViewed = function(product) {
            $log.debug("ProductDetailsController(): adding viewed product", product);

            var p = angular.copy(product);
            RecentlyViewed.addRecentlyViewed(p);
        }


        $scope.showhide = function(sku) {
            $log.debug("ProductDetailsController(): showhide", sku);
            angular.forEach($scope.product.contains, function(item) {
                //$log.debug("ProductDetailsController(): showhide foreach", product);
                if (item.product.sku == sku) {
                    $log.debug("ProductDetailsController(): selected", item.product.sku);
                    $scope.selectedProduct = angular.copy(item.product);
                }
            })
        };

        /*=== LOAD DATA ====*/

        var categoryLoaded = $q.defer();

        var loadCategory = function() {
            $log.debug("ProductDetailsController(): loadCategory(): loading category", $scope.categoryId);
            Categories.get({"categoryId": $scope.categoryId, "recurse": true}, function(category, status, headers) {
                $scope.category = category;

                $log.debug("ProductDetailsController(): loaded category", category);

                var path = BreadcrumbsHelper.setPath($scope.category, $scope.product);
                $log.debug("ProductDetailsController(): after category loaded path", path);

                categoryLoaded.resolve(category);
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
                if (product.type == 'group') {
                    $log.debug("selecting first item in group", product);
                    $scope.showhide(product.contains[0].product.sku);

                    $scope.categoryClicked = function($index) {
                        // FIXME
                    }
                }
                $rootScope.title = product.name;

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

                categoryLoaded.promise.then(function() {
                    var path = BreadcrumbsHelper.setPath($scope.category, $scope.product);
                    $log.debug("ProductDetailsController(): after category & project loaded, path", path);
                });

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
