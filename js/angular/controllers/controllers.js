'use strict';

/* Controllers */

angular.module('app.controllers', [
  'app.controllers.top',
  'app.controllers.lang',
  'app.controllers.main',
  'app.controllers.home',
  'app.controllers.objects',
  'app.controllers.products',
  'app.controllers.categories',
  'app.controllers.cart',
  'app.controllers.checkout',
  'app.controllers.account',
  'app.controllers.recentlyViewed',
  'app.controllers.onlineSponsor',
  'app.controllers.scroll'
]);

angular.module('app.controllers.top', []);
angular.module('app.controllers.lang', []);
angular.module('app.controllers.main', ["hashKeyCopier"]);
angular.module('app.controllers.categories', ["hashKeyCopier"]);
angular.module('app.controllers.objects', ["hashKeyCopier"]);
angular.module('app.controllers.products', ["hashKeyCopier"]);
angular.module('app.controllers.recentlyViewed', ["hashKeyCopier"]);
angular.module('app.controllers.home', []);
angular.module('app.controllers.cart', []);
angular.module('app.controllers.checkout', []);
angular.module('app.controllers.account', []);

angular.module('app.controllers.onlineSponsor', []);
angular.module('app.controllers.scroll', ['duScroll']);

