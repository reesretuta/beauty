'use strict';

/* Services */

angular.module('app.services', ['ngResource'])
    .factory('Page', function($rootScope, $log) {
        return {
            setTitle : function(title) {
                $log.debug("setting title to", title);
                $rootScope.title = title;
            }
        };
    })
    .factory('Objects', function ($resource, API_URL) {
        return $resource(API_URL + '/objects/:objectId');
    })
    .factory('Products', function ($resource, API_URL) {
        return $resource(API_URL + '/products/:productId');
    })
    .factory('Categories', function ($resource, API_URL) {
        return $resource(API_URL + '/categories/:categoryId');
    })
    .constant('BASE_URL', '')
    .constant('API_URL', '/api');
