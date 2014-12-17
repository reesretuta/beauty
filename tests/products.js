var assert = require("assert");
var request = require('request');
var jafraClient = require('../jafra.js');

describe('Products', function(){
    describe('loadProducts()', function(){
        it('should load products', function(done){
            jafraClient.loadProducts(false, false, 0, 2, "id").then(function(products) {
                console.log("got products");
                assert.notEqual(products, null);
                assert.equal(products.length, 2);
                done();
            }, function (err) {
                done(err);
            }).catch(done);
        })
    })

    describe('/products', function(){
        it('should get 2 products', function(done){
            jafraClient.getProducts(false, false, 0, 2, "id").then(function(r) {
                assert.notEqual(r.result, null);
                assert.equal(r.result.length, 2);
                done();
            }, function (r) {
                done(new Error(r.message));
            }).catch(done);
        })
    })

});