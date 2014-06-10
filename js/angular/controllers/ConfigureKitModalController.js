angular.module('app.controllers.products')
    .controller('ConfigureKitModalController', function ($sce, $timeout, $document, HashKeyCopier, Cart, Categories, Products, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, quantity, product, inCart) {
        $log.debug("ConfigureKitModalController");

        $scope.product = product;
        if (!inCart) {
            $scope.product = angular.copy(product);
        }
        $scope.product.quantity = quantity;
        $scope.products = [];

        $log.debug("configuring product", $scope.product);

        $scope.productIdToProduct = {};
        if ($scope.product.kitSelections == null) {
            $scope.product.kitSelections = {};
        }

        $scope.selectProduct = function(kitGroupId, productId) {
            $log.debug("selected product", productId);
            $scope.product.kitSelections[kitGroupId] = $scope.productIdToProduct[productId];
            $scope.kitGroupSelected = kitGroupId;

            $timeout(function() {
                // scroll the header into view
                var el = $document[0].querySelector("#kitGroupNav"+kitGroupId);
                if (el) {
                    el.scrollIntoView(true);
                }
            }, 0);
        }

        $scope.kitGroupSelected = null;
        $scope.isKitGroupSelected = function(kitGroup) {
            if (kitGroup.id == $scope.kitGroupSelected) {
                return true;
            }
            return false;
        }

        $scope.kitGroupClicked = function(kitGroup) {
            $scope.kitGroupSelected = kitGroup.id;

            $log.debug("selected kit group", kitGroup);

            // scroll the header into view
            var el = $document[0].querySelector("#kitGroup"+kitGroup.id);
            if (el) {
                el.scrollIntoView(true);
            }
        }

        var kitgroups = new Array();
        if (Array.isArray(product.kitgroup)) {
            kitgroups = product.kitgroup;
        } else {
            kitgroups.push(product.kitgroup);
        }

        $log.debug('ConfigureKitModalController(): kitgroups', kitgroups);

        $scope.isKitSelectionComplete = function() {
            var complete = true;
            $.each(kitgroups, function(index, kitgroup) {
                if ($scope.product.kitSelections[kitgroup.id] == null) {
                    complete = false;
                    return;
                }
            });
            return complete;
        }

        var productIds = new Array();
        $.each(kitgroups, function(index, kitgroup) {
            $.each(kitgroup.productskus.itemnumber, function(index, itemnumber) {
                productIds.push(itemnumber);
            });
        });

        kitGroupSelected = kitgroups[0];

        // load products

        var loadProducts = function (productIds) {
            //var start = new Date().getTime();
            $log.debug("loading products", productIds);
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

                angular.forEach(products, function(product) {
                    $scope.productIdToProduct[product.itemnumber] = product;
                });

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
        loadProducts(productIds);

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("canceling saving kit");
            $modalInstance.close();
        };

        $scope.save = function () {
            $log.debug("saving configured product kit");

            //$.each(kitgroups, function(index, kitgroup) {
            //    var productId = $scope.product.kitSelections[kitgroup.id];
            //    $scope.product.kitSelections[kitgroup.id] = angular.copy($scope.productIdToProduct[productId]);
            //    $log.debug("kit group", kitgroup.id, "selected product", $scope.productIdToProduct[productId]);
            //});

            if (!inCart) {
                var qty = $scope.product.quantity;
                for (var i=0; i < qty; i++) {
                    var product = angular.copy($scope.product);
                    product.quantity = 1;
                    Cart.addToCart(product);
                    $log.debug("added product to cart", product);
                }
            }
            $modalInstance.close();
        };

        function cleanup() {
            $log.debug("cleaning up");
            var body = $document.find('html, body');
            body.css("overflow-y", "auto");
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
