angular.module('app.controllers.scroll', ['duScroll']).
  controller('ScrollController', function($scope, $document){
  	
    $scope.toTheTop = function() {
      $document.scrollTopAnimated(0).then(function() { 
        console && console.log('You just scrolled to the top!');
      });
    }
    var section2 = angular.element(document.getElementById('section-2'));
    $scope.toSection2 = function() {
      $document.scrollToElementAnimated(section2);
    }
  }
).value('duScrollOffset', 30);