
angular.module('app.controllers.checkout').controller('EditCreditCardModalController', function ($document, HashKeyCopier, $modalInstance, $q, $scope, $location, $log, CreditCards, creditCard, JOIN_BASE_URL) {

    $log.debug('EditCreditCardModalController(): editing creditCard', creditCard);
    $scope.creditCard = angular.copy(creditCard);
    $scope.isOnlineSponsoring = false;
    var path = $location.path();
    $log.debug("EditCreditCardModalController(): path", path);
    if (path && path.match(JOIN_BASE_URL)) {
        $scope.isOnlineSponsoring = true;
    }

    $scope.close = function () {
        $log.debug("EditCreditCardModalController(): canceling creditCard correction");
        $modalInstance.close({
            creditCard: null,
            canceled: true
        });
    };

    $scope.isValidCard = function(card) {
        if (card == null || S(card).isEmpty()) {
            $log.debug("empty", card);
            return false;
        }
        var res = CreditCards.validateCard(card);
        $log.debug("valid", res.valid, card);
        return res.valid;
    };

    $scope.save = function () {
        $scope.saveError = null;
        $scope.processing = true;
        $log.debug("EditCreditCardModalController(): save(): saving creditCard correction");
        if ($scope.isOnlineSponsoring) {
            $modalInstance.close({
                creditCard: $scope.creditCard,
                canceled: false
            });
        } else {
            CreditCards.saveCreditCard($scope.creditCard).then(function(card) {
                $log.debug('EditCreditCardModalController(): save(): saved: card:', card);
                $scope.processing = false;
                $modalInstance.close({
                    creditCard: card,
                    canceled: false
                });
            }, function(error) {
                $log.debug("EditCreditCardModalController(): save(): error", error);
                $scope.processing = false;
                $scope.saveError = "There was an error updating this card";
            });
        }
    };

    $scope.$on('$destroy', function() {
        $log.debug('EditCreditCardModalController(): cleaning up');
        var body = $document.find('html, body');
        body.css('overflow-y', 'auto');
    });

});
