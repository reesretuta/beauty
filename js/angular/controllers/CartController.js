angular.module('app.controllers.cart')
    .controller('CartController', function ($scope, $document, $rootScope, $compile, $routeParams, $modal, $log, Cart, Products, HashKeyCopier) {
        $log.debug("CartController");

        //change page title
        $rootScope.page = "Order Details";

        //this is a back-end page, use to hide category nav & stuff
        $rootScope.section = "cart";

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
                if (product.kitgroup != null) {
                    // configure kit
                    $scope.configureKit(product, false);
                } else {
                    var parent = product.parent;
                    product.parent = null;
                    var p = angular.copy(product);
                    product.parent = parent;

                    p.quantity = $scope.orderByIdQty;
                    $log.debug("adding product", p);
                    Cart.addToCart(p);
                    // clear search
                    $scope.orderByIdItem = '';
                }
            } else {
                $log.error("product not found");
            }
        }

        $scope.configureKit = function(product, inCart) {
            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "configureKitModal",
                templateUrl: '/partials/products/configure-kit-modal.html',
                controller: 'ConfigureKitModalController',
                resolve: {
                    product: function() {
                        return product;
                    },
                    quantity: function() {
                        return 1;
                    },
                    inCart: function() {
                        console.log("inCart", inCart);
                        return inCart == null ? true : inCart;
                    }
                }
            });

            var body = $document.find('html, body');

            d.result.then(function(product) {
                $log.debug("configure kit dialog closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                if (product != null) {
                    $log.debug("add kit to cart");
                }
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");
        }

        $scope.searchProductsList = new Array();

        $scope.searchProducts = function(search) {
            // do something as user is searching, like constrain data set
            if (S($scope.orderByIdItem).length >= 1) {
                $log.debug("querying products", $scope.orderByIdItem);
                var products = Products.query({'search': $scope.orderByIdItem}, function(products, status, headers) {
                    $log.debug("got products for search", products);
                    $scope.searchProductsList = new Array();
                    angular.forEach(products, function(product) {
                        if (product.parent != null && product.parent.groupid) {
                            // this is a group product returned back
                            $scope.searchProducts[product.itemnumber] = product;
                            $scope.searchProductsByName[product.itemnumber + ' - ' + product.parent.productname + ' - ' + product.productname] = product;
                            $scope.searchProductsList.push(product.itemnumber + ' - ' + product.parent.productname + ' - ' + product.productname);
                        } else if (product.itemnumber) {
                            $scope.searchProducts[product.itemnumber] = product;
                            $scope.searchProductsByName[product.itemnumber + ' - ' + product.productname] = product;
                            $scope.searchProductsList.push(product.itemnumber + ' - ' + product.productname);
                        } else if (product.groupid) {
                            angular.forEach(product.productskus.productdetail, function(p) {
                                $scope.searchProducts[p.itemnumber] = p;
                                $scope.searchProductsByName[p.itemnumber + ' - ' + product.productname + ' - ' + p.productname] = p;
                                $scope.searchProductsList.push(p.itemnumber + ' - ' + product.productname + ' - ' + p.productname);
                            });
                        }
                    });

                    if (!products.length) {
                        $scope.searchProductsList.push('Not found');
                    }
                }, function(products, status, headers) {
                    $log.error("error searching products", status, headers);
                    $scope.searchProductsList.push('Error searching products');
                });
            } else {
                $scope.searchProductsList = new Array();
            }
        }

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