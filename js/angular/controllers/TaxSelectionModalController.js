angular.module('app.controllers.checkout')
    .controller('TaxSelectionModalController', function ($sce, $timeout, $document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, geocodes) {
        $log.debug("TaxSelectionModalController");

        $log.debug("TaxSelectionModalController(): geocodes", geocodes);

        for (var i=0; i < geocodes.length; i++) {
            geocodes[i].index = i;
        }

        $scope.geocodes = geocodes;
        $scope.selected = {};

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("TaxSelectionModalController(): canceling saving kit");
            $modalInstance.close({
                geocode: null,
                canceled: true
            });
        };

        $scope.save = function () {
            $log.debug("TaxSelectionModalController(): saving selected geocode");

            if ($scope.selected.index) {
                $modalInstance.close({
                    geocode: geocodes[$scope.selected.index],
                    canceled: false
                });
                $log.debug("TaxSelectionModalController(): selected", geocodes[$scope.selected.index]);
            } else {
                // FIXME
                $log.error("TaxSelectionModalController(): failed to select item, not closing.");
            }
        };

        function cleanup() {
            $log.debug("TaxSelectionModalController(): cleaning up");
            var body = $document.find('html, body');
            body.css("overflow-y", "auto");
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
