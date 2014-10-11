angular.module('app.controllers.top')
    .controller('CarouselDemoCtrl', function ($scope, $document, $timeout, $location, $rootScope, $routeParams, JOIN_BASE_URL) {
      $scope.myInterval = 4000;
      $scope.slides = [
        {
          image: '/img/products_royalJelly.jpg'
        },
        {
          image: '/img/products_PRO.jpg'
        },
        {
          image: '/img/products_marineBotanicals.jpg'
        },
        {
          image: '/img/products_fragranceWomen.jpg'
        },
        {
          image: '/img/products_fragranceMen.jpg'
        },
        {
          image: '/img/products_color.jpg'
        }
        ]
    });