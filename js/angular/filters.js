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
    })
    .filter('json', function() {
        return function(input, scope) {
            if (input!=null)
                return JSON.stringify(input);
        }
    }).filter('phone', function () {
        return function (tel) {
            if (!tel) { return ''; }

            if (tel.length < 10) {
                return tel;
            }

            var value = tel.toString().trim().replace(/[^0-9]/, '');
            var prefix = value.slice(0, 3);
            var part1 = value.slice(0, 3);
            var part2 = value.slice(0, 4);

            return "(" + prefix + ") " + part1 + "-" + part2;
        };
    });;

