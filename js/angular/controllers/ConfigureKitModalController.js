
angular.module('app.controllers.products').controller('ConfigureKitModalController', function ($timeout, $document, HashKeyCopier, Cart, Categories, Product, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, item, inCart, whizFunc, $translate) {
        
    $log.debug("ConfigureKitModalController");

    $log.debug("ConfigureKitModalController(): the funk", whizFunc);
    whizFunc();

    var NUM_ITEMS_IN_GROUP = 2;

    $scope.item = angular.copy(item);

    $scope.products = [];
    $scope.kitData = {};

    $log.debug("ConfigureKitModalController(): configuring product", $scope.item);

    $scope.productIdToProduct = {};
    
    if ($scope.kitData.kitSelections == null) {
        $scope.kitData.kitSelections = {};
    }

    $scope.selectProduct = function(kitId, kitGroupNum, productId) {
        $log.debug("ConfigureKitModalController(): selected product", productId, "for kit", kitId, "kitGroupNum", kitGroupNum);

        if ($scope.kitData.kitSelections[kitId+'_'+kitGroupNum] == null) {
            $scope.kitData.kitSelections[kitId+'_'+kitGroupNum] = [];
        }

        var selections = $scope.kitData.kitSelections[kitId+'_'+kitGroupNum];

        var foundIndex = -1;
        $.each(selections, function(index, product) {
            if (product.sku == productId) {
                foundIndex = index;
            }
        })

        // remove the first item we selected to make room
        if (foundIndex == -1 && selections.length >= NUM_ITEMS_IN_GROUP) {
            selections.shift();
        } else if (foundIndex >= 0) {
            // remove it
            selections.splice(foundIndex, 1);
        }

        selections.push({
            sku: productId,
            name: $scope.productIdToProduct[productId].name
        });

        $scope.kitGroupSelected = kitId+'_'+kitGroupNum;
        $log.debug("ConfigureKitModalController(): kitSelections now", $scope.kitData.kitSelections);
    };

    $scope.kitGroupSelected = null;

    $scope.isKitGroupSelected = function(kitGroup) {
        $log.debug("ConfigureKitModalController(): isKitGroupSelected", kitGroup);
        if (kitGroup.kitGroup.id+'_'+kitGroup.kitGroupNum == $scope.kitGroupSelected) {
            return true;
        }
        return false;
    };

    $scope.isKitGroupItemSelected = function(kitGroup, productId) {
        var selections = $scope.kitData.kitSelections[kitGroup.kitGroupId+'_'+kitGroup.kitGroupNum];
        $log.debug("ConfigureKitModalController(): isKitGroupItemSelected", kitGroup.kitGroupId+'_'+kitGroup.kitGroupNum, selections);

        if (selections && selections.length > 0) {
            var found = false;
            $.each(selections, function(index, product) {
                if (product.sku == productId) {
                    found = true;
                }
            })
            return found;
        }
        return false;
    }

    $scope.kitGroupClicked = function(kitGroup) {
        $scope.kitGroupSelected = kitGroup.kitGroup.id+'_'+kitGroup.kitGroupNum;
        $log.debug("ConfigureKitModalController(): selected kit group", kitGroup);
        var el = $document[0].querySelector("#kitGroup" + kitGroup.kitGroup.id+'_'+kitGroup.kitGroupNum);
        if (el) {
            el.scrollIntoView(true);
        }
    };

    var kitgroups = new Array();
    if (Array.isArray(item.product.kitGroups)) {
        $log.debug("ConfigureKitModalController(): have kit groups array", item.product.kitGroups);
        kitgroups = item.product.kitGroups;
    } else {
        $log.debug("ConfigureKitModalController(): have kit groups item");
        kitgroups.push(item.product.kitGroups);
    }

    $log.debug('ConfigureKitModalController(): kitgroups', kitgroups);

    $scope.isKitSelectionComplete = function() {
        var complete = true;
        if ($scope.kitData.kitSelections == null) {
            return false;
        }
        $.each(allKitGroups, function(index, kitgroup) {
            var selections = $scope.kitData.kitSelections[kitgroup.kitGroup.id+'_'+kitgroup.kitGroupNum];
            if (selections == null || selections.length < NUM_ITEMS_IN_GROUP) {
                $log.debug('ConfigureKitModalController(): not complete', kitgroup);
                complete = false;
                return;
            }
        });
        return complete;
    }

    var productIds = new Array();
    var allKitGroups = new Array();
    $.each(kitgroups, function(index, kitgroup) {
        $log.debug('ConfigureKitModalController(): processing kitGroup', kitgroup);

        // get product list to load
        $.each(kitgroup.kitGroup.components, function(index, component) {
            $log.debug('ConfigureKitModalController(): adding kitGroup component', component);
            productIds.push(component.productId);
        });

        // break out quantities to create a list of kit groups for configuring
        for (var i=1; i <= kitgroup.quantity; i++) {
            var kg = angular.copy(kitgroup);
            // set this to uniquely identify copies
            kg.kitGroupNum = i;
            allKitGroups.push(kg);
        }
    });

    // convert kitSelections into the form we need
    //"kitSelections": {
    //    "NUPL19193": [{        // each kit group
    //        "sku": "12026",      // product sku
    //        "qty": 1             // quantity
    //    }, {
    //        "sku": "12029",      // product sku
    //        "qty": 1             // quantity
    //    }]
    //}
    // - to -
    //kitSelections: {
    //     NUPL19405_1: {
    //         name: "Simple - High Shine Moisture Gloss ",
    //         sku: "25033"
    //     },
    //     NUPL19405_2: {
    //         name: " Crush - High Shine Moisture Gloss "
    //         sku: "25037"
    //     }
    //}

    var kitSelections = {};
    if ($scope.item.kitSelections) {
        $.each($scope.item.kitSelections, function(kitId, selections) {
            $log.debug("ConfigureKitModalController(): processing loaded kitSelections", selections);
            $.each(selections, function(index, selection) {
                $log.debug("ConfigureKitModalController(): setting", kitId+"_"+(index+1), "to", selection);
                kitSelections[kitId+"_"+(index+1)] = selection;
            });
        });
    }
    $log.debug("ConfigureKitModalController(): setting kitSelections", kitSelections);
    $scope.kitData.kitSelections = kitSelections;

    $scope.allKitGroups = allKitGroups;
    $scope.kitGroupSelected = kitgroups[0];

    // load products

    var loadProducts = function (productIds) {
        //var start = new Date().getTime();
        $log.debug("ConfigureKitModalController(): loading products", productIds);
        Product.query({"productIds": productIds, "loadComponents": true}).then(function(products, responseHeaders) {
            $log.debug("ConfigureKitModalController: got products", products);
            // We do this here to eliminate the flickering.  When Product.query returns initially,
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

        // FIXME - needed?
        
        //$.each(kitgroups, function(index, kitgroup) {
        //    var productId = $scope.kitData.kitSelections[kitgroup.id];
        //    $scope.kitData.kitSelections[kitgroup.id] = angular.copy($scope.productIdToProduct[productId]);
        //    $log.debug("ConfigureKitModalController(): kit group", kitgroup.id, "selected product", $scope.productIdToProduct[productId]);
        //});

        // mash the kits back into what they should be
        //kitSelections: {
        //     NUPL19405_1: {
        //         name: "Simple - High Shine Moisture Gloss ",
        //         sku: "25033"
        //     },
        //     NUPL19405_2: {
        //         name: " Crush - High Shine Moisture Gloss "
        //         sku: "25037"
        //     }
        //}
        //
        //"kitSelections": {
        //    "NUPL19193": [{        // each kit group
        //        "sku": "12026",      // product sku
        //        "qty": 1             // quantity
        //    }, {
        //        "sku": "12029",      // product sku
        //        "qty": 1             // quantity
        //    }]
        //}
        var kitSelections = {};
        $log.debug("ConfigureKitModalController(): kitSelections", $scope.kitData.kitSelections);

        for (var kitKey in $scope.kitData.kitSelections) {
            if ($scope.kitData.kitSelections.hasOwnProperty(kitKey)) {
                $log.debug("ConfigureKitModalController(): processing kit selection key", kitKey);
                var kitItem = $scope.kitData.kitSelections[kitKey];
                $log.debug("ConfigureKitModalController(): have kitItem", kitItem);
                var key = kitKey.substring(0, kitKey.indexOf('_'));
                $log.debug("ConfigureKitModalController(): have key", key);

                if (kitSelections[key] == null) {
                    kitSelections[key] = [kitItem];
                    $log.debug("ConfigureKitModalController(): setting kitGroup", key, "to", kitSelections[key]);
                } else {
                    // add to the existing items
                    var added = false;
                    for (var j=0; j < kitSelections[key]; j++) {
                        var selection = kitSelections[key];
                        if (selection.sku == kitItem.sku) {
                            selection.qty += 1;
                            $log.debug("ConfigureKitModalController(): kitGroup", key, "adding to quantity", selection.sku, selection.quantity);
                            added = true;
                        }
                    }
                    if (!added) {
                        $log.debug("ConfigureKitModalController(): kitGroup", key, "adding", kitItem);
                        kitSelections[key].push(kitItem);
                    }
                }
            }
        }

        if (!inCart) {
            var o = angular.copy(item);
            o.kitSelections = kitSelections;

            $modalInstance.close(o);
            $log.debug("ConfigureKitModalController(): save new cart item", o);
        } else {
            item.kitSelections = kitSelections;
            $log.debug("ConfigureKitModalController(): replacing existing kit selections", item);
            $modalInstance.close();
        }
    };

    $scope.$on('$destroy', function() {
        $log.debug('ConfigureKitModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
