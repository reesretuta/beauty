angular.module('app.controllers.checkout')
    .controller('EditCreditCardModalController', function ($sce, $timeout, $document, HashKeyCopier, $modalInstance, $q, $scope, $rootScope, $routeParams, $location, $timeout, $window, $log, CreditCards, creditCard) {

        $log.debug("EditCreditCardModalController(): editing creditCard", creditCard);

        $scope.creditCard = creditCard;

        /*==== DIALOG CONTROLS ====*/

        $scope.close = function () {
            $log.debug("EditCreditCardModalController(): canceling creditCard correction");
            $modalInstance.close({
                creditCard: null,
                canceled: true
            });
        };

        $scope.isValidCard = function(card) {
            if (card == null || S(card).isEmpty()) {
                //$log.debug("empty", card);
                return false;
            }
            var res = CreditCards.validateCard(card);
            //$log.debug("valid", res.valid, card);
            return res.valid;
        }

        $scope.save = function () {
            $scope.saveError = null;

            $log.debug("EditCreditCardModalController(): save(): saving creditCard correction");

            // save the card
            CreditCards.saveCreditCard($scope.creditCard).then(function(card) {
                $log.debug("EditCreditCardModalController(): save(): saved");
                $modalInstance.close({
                    creditCard: card,
                    canceled: false
                });
            }, function(error) {
                $log.debug("EditCreditCardModalController(): save(): error", error);
                $scope.saveError = "There was an error updating this card";
            });
        };

        function cleanup() {
            $log.debug("EditCreditCardModalController(): cleaning up");
            var body = $document.find('html, body');
            body.css("overflow-y", "auto");
        }

        /*==== CLEANUP ====*/
        $scope.$on('$destroy', function() {
            cleanup();
        });
    });
