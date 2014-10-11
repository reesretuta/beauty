'use strict';

/* Directives */
angular.module('app.directives', [])// directives
    // this directive is a helper for browsers that can't seem to get % height correct.  this will watch for page
    .directive('resizeHandler', ['$window', '$log', function ($window, $log) {
        $log = $log.getInstance('resize');
        $log.debug("using resize");

        return {
            restrict: 'A',
            transclude: false,
            replace: false,
            scope: false,
            controller: ["$scope", function ($scope) {
                // nothing needed here atm
            }],
            link: function ($scope, $element, $attrs) {
                var callback = $scope.$eval($attrs.resizeHandler);
                $log.debug("using callback", callback);

                $scope.$watch(function () {
                    return { 'h': $element.height(), 'w': $element.width() };
                }, function (newValue, oldValue) {
                    // call handler
                    callback(newValue.w, newValue.h);
                }, true);

                $element.bind('resize', function () {
                    $scope.$apply();
                });

                $scope.$on('$destroy', function() {
                    //$log.debug("cleaning up old scope");
                    $element.unbind('resize');
                    $element = null;
                });
            }
        }
    }])
    .directive('scrollListener', function($window, $log) {
        $log = $log.getInstance('copybutton');

        return {
            restrict: 'A',
            transclude: false,
            replace: false,
            require: '?ngBind',
            scope: false,
            link: function($scope, $element, $attrs) {
                $log.debug('html scrollListener', $element, $scope, $attrs);
                $element.on('scroll', function() {
                    //$log.debug('html scrolling', $element);
                    if ($attrs.onScroll) {
                        var fn = $scope.$eval($attrs.onScroll);
                        fn($element);
                    }
                });

                var cancelWatch = $scope.$watch(function($scope) {
                    return $element[0].scrollHeight;
                }, function() {
                    //$log.debug('changed', $element);
                    if ($attrs.onOverflow) {
                        var fn = $scope.$eval($attrs.onOverflow);
                        fn($element);
                    }
                });

                $scope.$on('$destroy', function() {
                    cancelWatch();
                    cancelWatch = null;
                });
            }
        };
    })
    ;
