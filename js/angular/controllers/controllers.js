'use strict';

/* Controllers */

angular.module('app.controllers', [
    'app.controllers.main',
    'app.controllers.home',
    'app.controllers.objects',
    'app.controllers.products'
]);

angular.module('app.controllers.main', ["hashKeyCopier"]);
angular.module('app.controllers.objects', ["hashKeyCopier"]);
angular.module('app.controllers.products', ["hashKeyCopier"]);
angular.module('app.controllers.home', []);
