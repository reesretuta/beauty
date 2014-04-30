angular.module('app.controllers.cart')
    .controller('CartController', function ($scope, $document, $rootScope, $compile, $routeParams, $log, Cart, Products, HashKeyCopier) {
        $log.debug("CartController");

        //change page title
        $rootScope.page = "Order Details";

        //this is a back-end page, use to hide category nav & stuff
        $rootScope.section = "admin";

        $scope.hidestuff = true;

        $scope.products = [];
        $scope.orderByIdItem = '';
        $scope.orderByIdQty = 1;
        $scope.searchProducts = {};
        $scope.searchProductsByName = {};
        
        


        var loadCart = function() {
            $scope.products = Cart.getItems();
            $log.debug("loaded cart products", $scope.products);
        }
        loadCart();
        
        $scope.total = function() {
            var total = 0;
            angular.forEach($scope.products, function(item) {
                
                var pricing = item.pricing.detailprice;                
                if (!(Array.isArray(pricing))) {
                    total += item.quantity * item.pricing.detailprice.price;
                } else {
                    angular.forEach(pricing, function(price) {
                        if(price.pricetype=='sale') {
                            total += item.quantity * price.price;
                        }
                    })
                }
                
//                total += item.quantity * item.pricing.detailprice.price;
            })

            return total;
        }

        $scope.changeClass = function (options) {
            var widget = options.methods.widget();
            // remove default class, use bootstrap style
            widget.removeClass('ui-menu ui-corner-all ui-widget-content').addClass('dropdown-menu');
        };

        $scope.addToCart = function() {
            $log.debug("adding product", $scope.orderByIdItem, "quantity", $scope.orderByIdQty);

            var product;
            if ($scope.searchProducts[$scope.orderByIdItem]) {
                product = $scope.searchProducts[$scope.orderByIdItem];
            } else if ($scope.searchProductsByName[$scope.orderByIdItem]) {
                product = $scope.searchProductsByName[$scope.orderByIdItem];
            }

            if (product != null) {
                var p = angular.copy(product);
                p.quantity = $scope.orderByIdQty;
                $log.debug("adding product", p);
                Cart.addToCart(p);
                // clear search
                $scope.orderByIdItem = '';
            } else {
                $log.error("product not found");
            }
        }

        /* config object */
        $scope.productSearchConfig = {
            options: {
                html: true,
                minLength: 1,
                outHeight: 50,
                focusOpen: true,
                onlySelect: true,
                messages: {
                    noResults: '',
                    results: function() {}
                },
                source: function (request, response) {
                    if (S($scope.orderByIdItem).length >= 1) {
                        $log.debug("querying products", $scope.orderByIdItem);
                        var products = Products.query({'search': $scope.orderByIdItem}, function(products, status, headers) {
                            $log.debug("got products for search", products);
                            var projectHeaders = new Array();
                            angular.forEach(products, function(product) {
                                if (product.itemnumber) {
                                    $scope.searchProducts[product.itemnumber] = product;
                                    $scope.searchProductsByName[product.itemnumber + ' - ' + product.productname] = product;

                                    projectHeaders.push({
                                        //label: $compile('<a class="ui-menu-add" ng-click="addToCart(searchProducts[\''+product.itemnumber+'\'])">' + product.productname + '</a>')($scope),
                                        label: product.itemnumber + ' - ' + product.productname,
                                        value: product.itemnumber + ' - ' + product.productname
                                    });
                                } else if (product.groupid) {
                                    angular.forEach(product.productskus.productdetail, function(p) {
                                        $scope.searchProducts[p.itemnumber] = p;
                                        $scope.searchProductsByName[p.itemnumber + ' - ' + product.productname + ' - ' + p.productname] = product;

                                        projectHeaders.push({
                                            //label: $compile('<a class="ui-menu-add" ng-click="addToCart(searchProducts[\''+product.itemnumber+'\'])">' + product.productname + '</a>')($scope),
                                            label: p.itemnumber + ' - ' + product.productname + ' - ' + p.productname,
                                            value: p.itemnumber + ' - ' + product.productname + ' - ' + p.productname
                                        });
                                    });
                                }
                            });

                            if (!products.length) {
                                projectHeaders.push({
                                    label: 'Not found',
                                    value: ''
                                });
                            }
                            response(projectHeaders);
                        }, function(products, status, headers) {
                            $log.error("error searching products", status, headers);
                            products.push({
                                label: 'Error searching products',
                                value: ''
                            });
                        });
                    } else {
                        response();
                    }
                }
            },
            methods: {
            }
        };

//        var loadProducts = function () {
//            //var start = new Date().getTime();
//            Products.query({"productIds": Object.keys(Cart.getItems())}, function(products, responseHeaders) {
//                $log.debug("got products", products);
//                // We do this here to eliminate the flickering.  When Products.query returns initially,
//                // it returns an empty array, which is then populated after the response is obtained from the server.
//                // This causes the table to first be emptied, then re-updated with the new data.
//                if ($scope.products) {
//                    // update the objects, not just replace, else we'll yoink the whole DOM
//                    $scope.products = HashKeyCopier.copyHashKeys($scope.products, products, ["id"])
//                    //$log.debug("updating objects", $scope.objects);
//                } else {
//                    $scope.products = products;
//                    //$log.debug("initializing objects");
//                }
//
//                $scope.loading = false;
//            }, function (data) {
//                //$log.debug('refreshProducts(): groupName=' + groupName + ' failure', data);
//                if (data.status == 401) {
//                    // Looks like our session expired.
//                    return;
//                }
//
//                //Hide loader
//                $scope.loading = false;
//                // Set Error message
//                $scope.errorMessage = "An error occurred while retrieving object list. Please refresh the page to try again, or contact your system administrator if the error persists.";
//            });
//        }
//        // kick off the first refresh
//        loadProducts();
    });