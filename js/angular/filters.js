'use strict';

/* Filters */

angular.module('app.filters', [])// Navigation Item Filter
    .filter('unsafe', function($sce) {
        return function(val) {
            return $sce.trustAsHtml(val);
        };
    })
    .filter('capitalize', function() {
        return function(input, scope) {
            if (input!=null)
                input = input.toLowerCase();
            return input.substring(0,1).toUpperCase()+input.substring(1);
        }
    });
	
