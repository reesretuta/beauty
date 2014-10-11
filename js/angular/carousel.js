angular.module('app', ['ui.bootstrap']);
function CarouselDemoCtrl($scope){
  $scope.myInterval = 3000;
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
    }
  ];
};