'use strict';

/* Controllers */

angular.module('app.controllers', [
    'app.controllers.main',
    'app.controllers.home',
    'app.controllers.objects',
    'app.controllers.products',
    'app.controllers.categories',
    'app.controllers.cart',
    'app.controllers.checkout'
]);

angular.module('app.controllers.main', ["hashKeyCopier"]);
angular.module('app.controllers.categories', ["hashKeyCopier"]);
angular.module('app.controllers.objects', ["hashKeyCopier"]);
angular.module('app.controllers.products', ["hashKeyCopier"]);
angular.module('app.controllers.home', []);
angular.module('app.controllers.cart', []);
angular.module('app.controllers.checkout', []);
