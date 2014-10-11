// angular.module('app.controllers.carousel')
//     .controller('CarouselDemoCtrl', function ($scope, $document, $timeout, $location, $rootScope, $routeParams, JOIN_BASE_URL) {
//       $scope.myInterval = 4000;
//       $scope.slides = [
//         {
//           image: '/img/products_royalJelly.jpg'
//         },
//         {
//           image: '/img/products_PRO.jpg'
//         },
//         {
//           image: '/img/products_marineBotanicals.jpg'
//         },
//         {
//           image: '/img/products_fragranceWomen.jpg'
//         },
//         {
//           image: '/img/products_fragranceMen.jpg'
//         },
//         {
//           image: '/img/products_color.jpg'
//         }
//       ]
//     });

angular.module('app', ['ui.bootstrap']);
function CarouselDemoCtrl($scope){
  $scope.myInterval = 3000;
  $scope.slides = [
    {
      image: 'http://lorempixel.com/400/200/'
    },
    {
      image: 'http://lorempixel.com/400/200/food'
    },
    {
      image: 'http://lorempixel.com/400/200/sports'
    },
    {
      image: 'http://lorempixel.com/400/200/people'
    }
  ];
}