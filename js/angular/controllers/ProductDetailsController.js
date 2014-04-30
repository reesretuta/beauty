angular.module('app.controllers.products')
    .controller('ProductDetailsController', function ($sce, HashKeyCopier, Products, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document, Cart, breadcrumbs, RecentlyViewed) {
        $scope.breadcrumbs = breadcrumbs;
        $scope.breadcrumbs.options = { 'Product Details': $routeParams.productId  }; 

        $scope.productId = $routeParams.productId;

        $scope.breadcrumbs = breadcrumbs;
        $scope.breadcrumbs.options = { 'Product Details': $scope.productId  };

        $rootScope.page = "Product Details";
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;

        $scope.selectedProduct = {};
        
        $scope.quantities = {};

        $scope.addToCart = function(product) {
            $log.debug("adding product", product);
            var qty = $scope.quantities[product.itemnumber]; 
            if (qty == null) {
                qty = 1;
            }
            $log.debug("adding product", product, qty);
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
            $log.debug("adding viewed product", product);
            
            var p = angular.copy(product);
            RecentlyViewed.addRecentlyViewed(p);
        }
        

        $scope.showhide = function(itemnumber) {
            $log.debug("showhide", itemnumber);
            angular.forEach($scope.product.productskus.productdetail, function(product) {
                //$log.debug("showhide foreach", product);
                if (product.itemnumber == itemnumber) {
                    $log.debug("selected", product.itemnumber);
                    $scope.selectedProduct = angular.copy(product);
                }
            })
        };

        /*=== LOAD DATA ====*/

        var loadProduct = function () {
            //var start = new Date().getTime();
            Products.get({"productId": $scope.productId}, function(product, status, headers, config) {
                $log.debug("got product", product);
                // We do this here to eliminate the flickering.  When Products.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.product) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.product = HashKeyCopier.copyHashKeys($scope.product, product, ["id"]);
                    //$log.debug("updating objects", $scope.objects);
                } else {
                    $scope.product = product;
                    //$log.debug("initializing objects");
                }
                if (product.groupid) {
                    $scope.showhide(product.productskus.productdetail[0].itemnumber);
                }
                $rootScope.page = product.productname;
                $scope.breadcrumbs.options = {};
                $scope.breadcrumbs.options[$scope.productId] = product.productname;
                
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
        // kick off the first refresh
        loadProduct();

        function cleanup() {
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
