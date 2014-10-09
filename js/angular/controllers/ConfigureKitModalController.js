angular.module('app.controllers.products')
    .controller('ConfigureKitModalController', function ($sce, $timeout, $document, HashKeyCopier, Cart, Categories, Products, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, item, inCart, whizFunc) {
        $log.debug("ConfigureKitModalController");

        $log.debug("ConfigureKitModalController(): the funk", whizFunc);
        whizFunc();

        $scope.item = angular.copy(item);

        $scope.products = [];

        $log.debug("ConfigureKitModalController(): configuring product", $scope.item);

        $scope.productIdToProduct = {};
        if ($scope.item.kitSelections == null) {
            $scope.item.kitSelections = {};
        }

        $scope.selectProduct = function(kitId, productId) {
            $log.debug("ConfigureKitModalController(): selected product", productId, "for kit", kitId);
            $scope.item.kitSelections[kitId] = {
                sku: productId,
                name: $scope.productIdToProduct[productId].name
            };
            $scope.item.kitGroupSelected = kitId;

            $timeout(function() {
                // scroll the header into view
                //var el = $document[0].querySelector("#kitGroupNav"+kitId);
                //if (el) {
                //    el.scrollIntoView(true);
                //}
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

            $log.debug("ConfigureKitModalController(): selected kit group", kitGroup);

            // scroll the header into view
            var el = $document[0].querySelector("#kitGroup"+kitGroup.id);
            if (el) {
                el.scrollIntoView(true);
            }
        }

        var kitgroups = new Array();
        if (Array.isArray(item.product.kitGroups)) {
            kitgroups = item.product.kitGroups;
        } else {
            kitgroups.push(item.product.kitGroups);
        }

        $log.debug('ConfigureKitModalController(): kitgroups', kitgroups);

        $scope.isKitSelectionComplete = function() {
            var complete = true;
            if ($scope.item.kitSelections == null) {
                return false;
            }
            $.each(kitgroups, function(index, kitgroup) {
                if ($scope.item.kitSelections[kitgroup.kitGroup.id] == null) {
                    complete = false;
                    return;
                }
            });
            return complete;
        }

        var productIds = new Array();
        $.each(kitgroups, function(index, kitgroup) {
            $.each(kitgroup.kitGroup.components, function(index, component) {
                productIds.push(component.product);
            });
        });

        $scope.kitGroupSelected = kitgroups[0];

        // load products

        var loadProducts = function (productIds) {
            //var start = new Date().getTime();
            $log.debug("ConfigureKitModalController(): loading products", productIds);
            Products.query({"productIds": productIds}).then(function(products, responseHeaders) {
                $log.debug("ConfigureKitModalController: got products", products);
                // We do this here to eliminate the flickering.  When Products.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.products) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.products = HashKeyCopier.copyHashKeys($scope.products, products, ["id"])
                    //$log.debug("ConfigureKitModalController(): ProductsController: updating objects", $scope.objects);
                } else {
                    $scope.products = products;
                    //$log.debug("ConfigureKitModalController(): ProductsController: initializing objects");
                }

                angular.forEach(products, function(product) {
                    $scope.productIdToProduct[product.sku] = product;
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
            $log.debug("ConfigureKitModalController(): canceling saving kit");
            $modalInstance.close();
        };


        $scope.save = function () {
            $log.debug("ConfigureKitModalController(): saving configured product kit");

            //$.each(kitgroups, function(index, kitgroup) {
            //    var productId = $scope.kitSelections[kitgroup.id];
            //    $scope.kitSelections[kitgroup.id] = angular.copy($scope.productIdToProduct[productId]);
            //    $log.debug("ConfigureKitModalController(): kit group", kitgroup.id, "selected product", $scope.productIdToProduct[productId]);
            //});

            if (!inCart) {
                $modalInstance.close($scope.item);
                $log.debug("ConfigureKitModalController(): save new cart item", $scope.item);
            } else {
                // just replace the kit selections
                item.kitSelections = $scope.item.kitSelections;
                $log.debug("ConfigureKitModalController(): replacing existing kit selections", item);
                $modalInstance.close();
            }
        };

        function cleanup() {
            $log.debug("ConfigureKitModalController(): cleaning up");
            var body = $document.find('html, body');
            body.css("overflow-y", "auto");
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
