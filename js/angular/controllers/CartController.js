angular.module('app.controllers.cart')
    .controller('CartController', function ($scope, $document, $rootScope, $compile, $routeParams, $modal, $log, $q, SalesTax, Cart, Product, OrderHelper, HashKeyCopier, STORE_BASE_URL) {
        $log.debug("CartController");

        //change page title
        $rootScope.title = "Order Details";

        //this is a back-end page, use to hide category nav & stuff
        $rootScope.section = "cart";

        $scope.hidestuff = true;

        $scope.cart = [];
        $scope.products = [];
        $scope.productMap = {};
        $scope.orderByIdItem = '';
        $scope.orderByIdQty = 1;
        $scope.searchProducts = {};
        $scope.searchProductsByName = {};

        $scope.cartLoaded = false;

        function loadCart() {
            var d = $q.defer();

            $scope.orderError = null;

            $log.debug("CartController(): loadCart(): loading products");

            Cart.get().then(function(cart) {
                $log.debug("CartController(): loadCart(): SKU loaded & added to cart", cart);

                $scope.cart = cart;
            }, function(error) {
                $log.error("CartController(): loadCart(): failed to add to cart, redirecting", error);
                $scope.orderError = "Failed to add product to cart";
                $scope.salesTaxInfo = null;

                $location.path(STORE_BASE_URL);
                d.reject(error);
            });

            return d.promise;
        }

        loadCart();

        $scope.total = function() {
            if ($scope.cart != null || $scope.cart.length == 0) {
                //$log.debug("CheckoutController(): total(): for items", $scope.cart)
                return OrderHelper.getTotal($scope.cart);
            }

            return 0;
        }

        $scope.changeClass = function (options) {
            var widget = options.methods.widget();
            // remove default class, use bootstrap style
            widget.removeClass('ui-menu ui-corner-all ui-widget-content').addClass('dropdown-menu');
        };

        $scope.addToCart = function() {
            $log.debug("CartController(): addToCart(): adding product", $scope.orderByIdItem, "quantity", $scope.orderByIdQty);

            var product;
            if ($scope.searchProducts[$scope.orderByIdItem]) {
                product = $scope.searchProducts[$scope.orderByIdItem];
            } else if ($scope.searchProductsByName[$scope.orderByIdItem]) {
                product = $scope.searchProductsByName[$scope.orderByIdItem];
            }

            if (product != null) {
                if (product.type == 'kit') {
                    // configure kit
                    $scope.configureKit({
                        name: product.name,
                        sku: product.sku,
                        product: product,
                        kitSelections: product.kitSelections,
                        quantity: $scope.orderByIdQty
                    }, false);
                } else {
                    $log.debug("CartController(): addToCart(): adding product", product);
                    Cart.addToCart({
                        name: product.name,
                        sku: product.sku,
                        kitSelections: product.kitSelections,
                        quantity: $scope.orderByIdQty
                    });
                    // clear search
                    $scope.orderByIdItem = '';

                    $scope.cartLoaded = false;
                    loadCart();
                }
            } else {
                $log.error("CartController(): addToCart(): product not found");
            }
        }

        $scope.removeFromCart = function(product) {
            $log.debug("CartController(): removeFromCart(): removing product", product);
            Cart.removeFromCart(product).then(function(cart) {
                $log.debug("CartController(): removeFromCart(): removed", cart);
                // reload the cart
                $scope.cartLoaded = false;
                loadCart();
            }, function(error) {
                $log.error("CartController(): removeFromCart(): failed to remove from cart", product, cart);
            });
        }

        $scope.configureKit = function(item, inCart) {
            var d = $modal.open({
                backdrop: true,
                keyboard: true, // we will handle ESC in the modal for cleanup
                windowClass: "configureKitModal",
                templateUrl: '/partials/products/configure-kit-modal.html',
                controller: 'ConfigureKitModalController',
                resolve: {
                    item: function() {
                        return item;
                    },
                    inCart: function() {
                        console.log("inCart", inCart);
                        return inCart == null ? true : inCart;
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
                $log.debug("CartController(): configureKit(): configure kit dialog closed");

                // re-enable scrolling on body
                body.css("overflow-y", "auto");

                if (cartItem != null) {
                    $log.debug("CartController(): configureKit(): add", $scope.orderByIdQty, "kits to cart", cartItem);

                    for (var i=0; i < $scope.orderByIdQty; i++) {
                        Cart.addToCart({
                            name: cartItem.name,
                            sku: cartItem.sku,
                            kitSelections: cartItem.kitSelections,
                            quantity: 1
                        });
                    }

                    $scope.cartLoaded = false;
                    loadCart();
                }
            });

            // prevent page content from scrolling while modal is up
            $("html, body").css("overflow-y", "hidden");
        }

        $scope.searchProductsList = new Array();

        $scope.searchProducts = function(search) {
            // do something as user is searching, like constrain data set
            if (S($scope.orderByIdItem).length >= 1) {
                $log.debug("CartController(): searchProducts(): querying products", $scope.orderByIdItem);
                var products = Product.query({'search': "." + $scope.orderByIdItem + "."}).then(function(products, status, headers) {
                    $log.debug("CartController(): searchProducts(): got products for search", products);
                    $scope.searchProductsList = new Array();
                    angular.forEach(products, function(product) {
                        $scope.searchProducts[product.sku] = product;
                        $scope.searchProductsByName[product.sku + ' - ' + product.name] = product;
                        $scope.searchProductsList.push(product.sku + ' - ' + product.name);
                    });

                    if (!products.length) {
                        $scope.searchProductsList.push('Not found');
                    }
                }, function(products, status, headers) {
                    $log.error("CartController(): searchProducts(): error searching products", status, headers);
                    $scope.searchProductsList.push('Error searching products');
                });
            } else {
                $scope.searchProductsList = new Array();
            }
        }
    });