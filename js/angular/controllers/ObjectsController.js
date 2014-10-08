angular.module('app.controllers.objects')
    .controller('ObjectsController', function ($sce, HashKeyCopier, Objects, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, $modal, $document) {

        $rootScope.title = "Objects";
        $rootScope.section = "store";

        $scope.errorMessage = '';
        $scope.loading = true;

        /*=== LOAD DATA ====*/

        var refreshObjectsTimer, refreshGroupsTimer;
        var OBJECT_REFRESH_INTERVAL = 5000;

        var cancelRefreshObjects = function() {
            //$log.info("cancelling any existing objects timer before refresh");
            if (refreshObjectsTimer) {
                $timeout.cancel(refreshObjectsTimer);
            }
        };
        var loadObjects = function () {
            cancelRefreshObjects();

            //$log.debug('refreshObjects(): groupName=' + groupName);
            //var start = new Date().getTime();
            var objects = Objects.query({}, function (value, responseHeaders) {
                // We do this here to eliminate the flickering.  When Objects.query returns initially,
                // it returns an empty array, which is then populated after the response is obtained from the server.
                // This causes the table to first be emptied, then re-updated with the new data.
                if ($scope.objects) {
                    // update the objects, not just replace, else we'll yoink the whole DOM
                    $scope.objects = HashKeyCopier.copyHashKeys($scope.objects, objects, ["id"])
                    //$log.debug("updating objects", $scope.objects);
                } else {
                    $scope.objects = objects;
                    //$log.debug("initializing objects");
                }
                $scope.loading = false;

                // schedule update
                if (!$routeParams.norefresh) {
                    refreshObjectsTimer = $timeout(function () {
                        //$log.debug('scheduling refresh');
                        refreshObjects();
                    }, OBJECT_REFRESH_INTERVAL);
                }

                //var end = new Date().getTime();
                //$log.debug("refreshObjects(): took", end-start);
            }, function (data) {
                //$log.debug('refreshObjects(): groupName=' + groupName + ' failure', data);
                if (data.status == 401) {
                    // Looks like our session expired.
                    return;
                }

                //Hide loader
                $scope.loading = false;
                // Set Error message
                $scope.errorMessage = "An error occurred while retrieving object list. Please refresh the page to try again, or contact your system administrator if the error persists.";

                // schedule update
                if (!$routeParams.norefresh) {
                    refreshObjectsTimer = $timeout(function () {
                        //$log.debug('scheduling refresh');
                        refreshObjects();
                    }, OBJECT_REFRESH_INTERVAL);
                }
            });
        }
        // kick off the first refresh
        loadObjects();

        function cleanup() {
            if (refreshObjectsTimer) {
                $log.debug("cleanup(): canceling project timer");
                $timeout.cancel(refreshObjectsTimer);
            }
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });