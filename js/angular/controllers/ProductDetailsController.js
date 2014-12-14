
angular.module('app.controllers.products')
    .controller('ProductDetailsController', function ($sce, WizardHandler, HashKeyCopier, Categories, Product, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, Cart, BreadcrumbsHelper, RecentlyViewed, $translate) {
        
        $log.debug("ProductDetailsController()");

        $scope.productId = $routeParams.productId;
        $scope.categoryId = $routeParams.category;
        $log.debug("ProductDetailsController(): productId", $scope.productId, "categoryId", $scope.categoryId);

        $rootScope.title = 'PRODUCT-DETAILS';
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;
        $scope.qtyError = false;

        $scope.selectedProduct = {};
        
        $scope.quantities = {};

        // reset the navigation
        BreadcrumbsHelper.setPath(null, null);

        $scope.resetQtyError = function() {
            $scope.qtyError = null;
        };

        $scope.addToCart = function(product) {
            $log.debug("ProductDetailsController(): adding product", product);
            var qty = $scope.quantities[product.sku];
            if (qty == null) {
                qty = 1;
            }
            if (qty > product.availableInventory) {
                $scope.qtyError = true;
                $scope.productAvailableInventory = product.availableInventory;
            } else {
                $scope.qtyError = false;
                Cart.addToCart({
                    name: product.name,
                    name_es_US: product.name_es_US,
                    sku: product.sku,
                    quantity: qty,
                    kitSelections: {}
                }).then(function() {
                    $log.debug('ProductDetailsController(): addToCart: complete (clearing qty)');
                    $scope.quantities[product.sku] = 1;
                });
            }
        };

        $scope.addToCartGroup = function(sku) {

            angular.forEach($scope.product.contains, function(item) {

                if (item.product.sku == sku) {

                    var qty = $scope.quantities[item.product.sku];
                    if (qty == null) {
                        qty = 1;
                    }

                    Cart.addToCart({
                        name: item.product.name,
                        name_es_US: item.product.name_es_US,
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

                        var item = {
                            name: $scope.product.name,
                            name_es_US: $scope.product.name_es_US,
                            sku: $scope.product.sku,
                            quantity: qty,
                            kitSelections: {},
                            product: $scope.product
                        };
                        console.log("configuring item", item);
                        return item;
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
                body.css("overflow-y", "auto");
                if (cartItem != null) {
                    $log.debug("add kit to cart", cartItem);
                    Cart.addToCart({
                        name: cartItem.name,
                        name_es_US: cartItem.name_es_US,
                        sku: cartItem.sku,
                        kitSelections: cartItem.kitSelections,
                        quantity: cartItem.quantity
                    }).then(function() {
                        $log.debug('MainController(): kit: addToCart()', $scope.product);
                        $scope.quantities[$scope.product.sku] = 1;
                        $log.debug('MainController(): kid: addToCart().then() -> clear qty.', $scope.quantities[$scope.product.sku]);
                    }, function (error) {
                        $log.error("MainController(): kit: addToCart(): error", $scope.product);
                    });
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
            Categories.get({"categoryId": $scope.categoryId, "recurse": true}).then(function(category, status, headers) {
                $scope.category = category;

                $log.debug("ProductDetailsController(): loaded category", category);

                BreadcrumbsHelper.setPath($scope.category, $scope.product).then(function(path) {
                    $log.debug("ProductDetailsController(): after category loaded path", path);
                });

                categoryLoaded.resolve(category);
            }, function(data, status, headers) {
                $log.error("ProductDetailsController(): error loading category", data, status);
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
            $log.debug("ProductDetailsController(): loadProduct()", $scope.productId);

            Product.get({"productId": $scope.productId}).then(function(product, status, headers, config) {
                $log.debug("ProductDetailsController(): loadProduct(): got product", product);

                // load the group products current prices if needed
                if (product.type == "group") {
                     for (var i=0; i < product.contains.length; i++) {
                         var p = product.contains[i];
                         $log.debug("ProductDetailsController(): loadProduct(): getting current price for", p.product);
                         Product.selectCurrentPrice(p.product);
                     }
                }

                $scope.product = product;

                if (product.type == 'group') {
                    $log.debug("ProductDetailsController(): loadProduct(): selecting first item in group", product);
                    $scope.showhide(product.contains[0].product.sku);

                    $scope.categoryClicked = function($index) {
                        // FIXME
                    }
                }

                // set the page title
                $rootScope.title = Product.getTranslated(product).name;

                if ($scope.categoryId == null && $scope.product.categories != null) {
                    // load the first category from this product, we probably landed here from search
                    var categories = $scope.product.categories.category;
                    if (Array.isArray(categories)) {
                        $scope.categoryId = categories[0].id;
                    } else if (categories != null) {
                        $scope.categoryId = categories.id;
                    }
                }

                if ($scope.categoryId != null) {
                    $log.debug("ProductDetailsController(): loadProduct(): loading category from product", $scope.categoryId);
                    loadCategory();
                }

                categoryLoaded.promise.then(function() {
                    BreadcrumbsHelper.setPath($scope.category, $scope.product).then(function(path) {
                        $log.debug("ProductDetailsController(): loadProduct(): after category & project loaded, path", path);
                    });
                });

                // add product to recently view products
                $scope.addToRecentlyViewed(product);

                $scope.loading = false;
            }, function (data) {
                $log.error("ProductDetailsController(): loadProduct(): failed to load product", data);
                //$log.debug('refreshProducts(): groupName=' + groupName + ' failure', data);
                if (data.status == 401) {
                    // Looks like our session expired.
                    return;
                }

                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving product. Please refresh the page to try again, or contact your system administrator if the error persists.";
            });
        }
        if ($scope.categoryId) {
            categoryLoaded.promise.then(function(category) {
                $log.debug("ProductDetailsController(): loading product after category loaded");
                // kick off the first refresh
                loadProduct();
            });
        } else {
            $log.debug("ProductDetailsController(): loading product");
            loadProduct();
        }

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
