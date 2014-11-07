// BASE SETUP
// =============================================================================

// call the packages we need
require('newrelic');
var init = require('./config/init')();
var config = require('./config/config');

var env = process.env.NODE_ENV || "development";

var express = require('express');
var methodOverride = require('method-override');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app = express();
var session = require('express-session');
var auth = require("basic-auth");
var MongoStore = require('connect-mongo')(session);
var jafraClient = require('./jafra');
var Types = require("mongoose").Types;
var S = require("string");
var http = require('http');
var mockserver = require('mockserver');

// configure app
//app.use(bodyParser());

var port = process.env.PORT || 8090; // set our port
var mock_port = process.env.MOCK_PORT || 9001; // set our port
var LEAD_PROCESSING_INTERVAL = process.env.LEAD_PROCESSING_INTERVAL || 5 * 60 * 1000; // default: 5 min
var LEAD_MAX_AGE = process.env.LEAD_MAX_AGE || 60 * 60 * 1000; // default: 1 hour

//var morgan = require('morgan')
var models = require('./common/models.js');

// SESSION CONFIG
var hour = 3600000;
var sess = {
    secret: 'jkfh873y8hwhd871wh9udhju1w9sdhyy1gef87g87dfgw',
    cookie: {
        maxAge: hour * 8,
        secure: false,
        path: "/",
        httpOnly: false
    },
    resave: true,
    saveUninitialized: true,
    unset: "destroy",
    store: new MongoStore({
        mongoose_connection : models.db,
        db: config.db,
        stringify: false
    })
};

if (env === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    sess.cookie.secure = false // serve secure cookies
}

app.use(session(sess));

// basic authentication for testing
app.use(function(req, res, next) {
    var user = auth(req);

    //console.log("user", user);
    if (user === undefined || user['name'] !== 'jafra' || user['pass'] !== 'easypassfordpaxton') {
        res.statusCode = 401;
        res.setHeader('WWW-Authenticate', 'Basic realm="JafraProto"');
        res.end('Unauthorized');
    } else if (S(req.url).startsWith("/debug")) {
        console.log("CLIENT DEBUG", req.url);
        res.statusCode = 200;
        res.end();
    } else if (S(req.url).startsWith("/error")) {
        console.log("CLIENT ERROR", req.url);
        res.statusCode = 200;
        res.end();
    } else {
        next();
    }
});

// ROUTES FOR OUR API
// =============================================================================

// create our router
var router = express.Router();

//console.log("have router",router);

//// middleware to use for all requests
//router.use(function(req, res, next) {
//    res.header("Access-Control-Allow-Origin", "*");
//    res.header("Access-Control-Allow-Headers", "X-Requested-With");
//
//    // do logging
//    console.log('Request', JSON.stringify(req.url));
//    next();
//});


// CATEGORIES
// ----------------------------------------------------
router.route('/categories')// get all the categories
    .get(function (req, res) {
        console.log("getting category list");
        models.Category.find({parent: { $exists: false }, onHold: false, showInMenu: true }).sort('rank').limit(100).populate({
            path: 'children',
            match: { onHold: false, showInMenu: true }
        }).exec(function (err, categories) {
                if (err) {
                    res.send(err);
                }

                var opts = {
                    path: 'children.children',
                    model: 'Category',
                    match: { onHold: false, showInMenu: true }
                }

                // populate all levels
                models.Category.populate(categories, opts, function (err, categories) {
                    opts = {
                        path: 'children.children.children',
                        model: 'Category',
                        match: { onHold: false, showInMenu: true }
                    }

                    console.log("returning", categories.length, "categories");
                    res.json(categories);
                })
            });
    })

router.route('/categories/:category_id')// get the category with that id
    .get(function (req, res) {
        models.Category.findOne({_id: req.params.category_id, onHold: false, showInMenu: true }).populate({
            path: 'children',
            match: { onHold: false, showInMenu: true }
        }).exec(function (err, category) {
                if (err) {
                    res.send(err);
                }

                if (!category) {
                    res.send('404', {status: 404, message: 'Category not found'});
                    return;
                }

                var opts = {
                    path: 'children.children',
                    model: 'Category',
                    match: { onHold: false, showInMenu: true }
                }

                // populate all levels
                models.Category.populate(category, opts, function (err, category) {
                    opts = {
                        path: 'children.children.children',
                        model: 'Category',
                        match: { onHold: false, showInMenu: true }
                    }

                    console.log("returning category");
                    res.json(category);
                })
            });
    });

// PRODUCTS
// ----------------------------------------------------
router.route('/products')

    // get all the products (accessed at GET http://localhost:8080/api/products)
    .get(function (req, res) {
        // handle search
        var searchString = req.query.search;
        var categoryId = req.query.categoryId;
        var productIds = req.query.productIds;

        if (searchString != null && !S(searchString).isEmpty()) {
            console.log("searching for product by string", searchString);
            //var re = new RegExp(searchString);
            models.Product.find({ $text: { $search: "" + searchString } })//.or([{ 'name': { $regex: re }}, { 'description': { $regex: re }}, { 'usage': { $regex: re }}, { 'ingredients': { $regex: re }}])
                .and([
                    {masterStatus: "A", onHold: false, searchable: true},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]).sort('name').limit(20).populate({
                    path: 'upsellItems.product youMayAlsoLike.product',
                    model: 'Product',
                    match: { $and: [
                        {masterStatus: "A", onHold: false},
                        {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                    ]}
                }).populate({
                    path: 'contains.product',
                    model: 'Product'//,
//                    match: { $and: [
//                        {masterStatus: "A"},
//                        {$or: [{masterType: "R"}, {masterType: "B"}, {masterType: {$exists: false}, type:"group"}]}
//                    ]}
                }).populate({
                    path: 'kitGroups.kitGroup',
                    model: 'KitGroup'
                }).populate({
                    path: 'kitGroups.kitGroup.components.product',
                    model: 'Product',
                    match: { $and: [
                        {masterStatus: "A", onHold: false},
                        {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                    ]}
                }).exec(function (err, products) {
                    if (err) {
                        res.send(err);
                        return;
                    }

                    console.log("returning", products.length, "products");
                    res.json(products);
                });
        } else if (categoryId != null && !S(categoryId).isEmpty()) {
            console.log("searching for product by category", categoryId);
            var id = parseInt(categoryId);
            models.Product.find({
                $and: [
                    {categories: id, masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]
            }).sort('name')
            .limit(20)
            .populate({
                path: 'upsellItems.product youMayAlsoLike.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }).populate({
                path: 'contains.product',
                model: 'Product'//,
//                match: { $and: [
//                    {masterStatus: "A"},
//                    {$or: [{masterType: "R"}, {masterType: "B"}, {masterType: {$exists: false}, type:"group"}]}
//                ]}
            }).populate({
                path: 'kitGroups.kitGroup',
                model: 'KitGroup'
            }).populate({
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }).exec(function (err, products) {
                if (err) {
                    res.send(err);
                }

                console.log("returning", products.length, "products");
                res.json(products);
            });
        } else if (productIds != null) {
            if (!Array.isArray(productIds)) {
                productIds = [productIds];
            }
            console.log("searching for product by IDs", productIds);

            models.Product.find({
                $and: [
                    {_id: { $in: productIds }, masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]
            }).sort('name').limit(20).populate({
                path: 'upsellItems.product youMayAlsoLike.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }).populate({
                path: 'contains.product',
                model: 'Product'//,
//                match: { $and: [
//                    {masterStatus: "A"},
//                    {$or: [{masterType: "R"}, {masterType: "B"}, {masterType: {$exists: false}, type:"group"}]}
//                ]}
            }).populate({
                path: 'kitGroups.kitGroup',
                model: 'KitGroup'
            }).populate({
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }).exec(function (err, products) {
                if (err) {
                    res.send(err);
                }

                console.log("returning", products.length, "products");
                res.json(products);
            });
        } else {
            console.log("getting product list");
            models.Product.find({masterStatus: "A", masterType: "R", onHold: false}).sort('name').limit(20).populate({
                path: 'upsellItems.product youMayAlsoLike.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }).populate({
                    path: 'contains.product',
                    model: 'Product'//,
//                    match: { $and: [
//                        {masterStatus: "A"},
//                        {$or: [{masterType: "R"}, {masterType: "B"}, {masterType: {$exists: false}, type:"group"}]}
//                    ]}
            }).populate({
                path: 'kitGroups.kitGroup',
                model: 'KitGroup'
            }).populate({
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }).exec(function (err, products) {
                if (err) {
                    res.send(err);
                }

                console.log("returning", products.length, "products");
                res.json(products);
            });
        }
    });

// on routes that end in /products/:productId
router.route('/products/:productId')

    // get the product with that id
    .get(function (req, res) {
        console.log("getting product", req.params);
        var now = new Date();

        models.Product.find({ _id: req.params.productId, masterStatus: "A", onHold: false})
        .or([
            {masterType: "R"}, {masterType: {$exists: false}, type:"group"}//,
//            {$and: [
//                {"prices.startDate":{$elemMatch:{$lte:now}}},
//                {"prices.endDate":{$elemMatch:{$gte:now}}}
//            ]}
        ])
        .exec(function (err, products) {
            if (err) {
                console.error("error loading product", err);
                res.send(err);
                return;
            } else if (products == null || products.length == 0) {
                console.error("error loading product", products);
                res.status(404);
                res.end();
                return;
            }

            var opts = {
                path: 'upsellItems.product youMayAlsoLike.product',
                model: 'Product',
                match: { $and: [
                    {masterStatus: "A", onHold: false},
                    {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
                ]}
            }

            // populate products
            models.Product.populate(products, opts, function (err, products) {
                var opts = {
                    path: 'contains.product',
                    model: 'Product'//,
//                    match: { $and: [
//                        {masterStatus: "A"},
//                        {$or: [{masterType: "R"}, {masterType: "B"}, {masterType: {$exists: false}, type:"group"}]}
//                    ]}
                }

                models.Product.populate(products, opts, function (err, products) {
                    var opts = {
                        path: 'kitGroups.kitGroup'
                    };

                    // populate kit groups
                    models.KitGroup.populate(products, opts, function (err, products) {
                        console.log("returning product");
                        res.json(products[0]);
                    });
                });
            })
        });
    });

// AUTHENTICATION
// ----------------------------------------------------
router.route('/authenticate')// authenticate a user (accessed at POST http://localhost:8080/authenticate)
    .post(function (req, res) {
        var username = req.body.username;
        var password = req.body.password;

        console.log("logging in with", username, password);

        // TODO - auth & get client ID

        // associate the client with the session
        if (req.session.cart == null) {
            console.log('setting default cart');
            req.session.cart = [];
        }
        if (req.session.checkout == null) {
            console.log('setting default checkout');
            req.session.checkout = {};
        }
        if (req.session.language == null) {
            console.log('setting default language');
            req.session.language = 'en_US';
        }

        jafraClient.authenticate(username, password).then(function(r) {
            console.log("authentication successful", r);

            // set the client in the session
            req.session.client = r.result;

            res.status(r.status);
            res.json(req.session);
        }, function(r) {
            console.log("authentication failed");
            res.status(r.status);
            res.json(r.result);
        });
    });

router.route('/logout')
    .post(function (req, res) {
        console.log("logout", req.session);
        res.status(200);
        req.session.destroy(function() {
            console.log('Session deleted');
            res.end();
        });
    });

// SESSIONS
// ----------------------------------------------------
router.route('/session')
    .get(function (req, res) {
//        var updated = false;
//        if (req.session.cart == null) {
//            req.session.cart = [];
//            updated = true;
//        }
//        if (req.session.language == null) {
//            req.session.language = 'en_US';
//            updated = true;
//        }
//        if (req.session.checkout == null) {
//            req.session.checkout = {};
//            updated = true;
//        }
//
//        if (updated) {
//            req.session.save(function(err) {
//                console.log('session saved', req.session);
//                res.json(req.session);
//            });
//            return;
//        }
        res.json(req.session);
    })

    // update the session with some data
    .put(function (req, res) {
        var session = req.body;

        console.log("update session request", session);

//        req.session.consultantId = session.consultantId;
//        req.session.source = session.source;
//
//        // copy over changes to cart, checkout, language
//        req.session.language = session.language;
//        if (Array.isArray(session.cart)) {
//            req.session.cart = [];
//            // save only the parts of the session we want
//            for (var i=0; i < session.cart.length; i++) {
//                var cartItem = session.cart[i];
//                var it = {
//                    name: cartItem.name,
//                    sku: cartItem.sku,
//                    kitSelections: cartItem.kitSelections,
//                    quantity: cartItem.quantity
//                };
//                req.session.cart.push(it);
//            }
//        }
//        req.session.checkout = session.checkout;

        req.session.save(function(err) {
            if (err) {
                console.error('error saving session', err);
                res.status(500);
                res.end();
                return;
            }

            // session saved
            console.log('session updated');
            res.status(204);
            res.end();
        });
    })

// LEADS
// ----------------------------------------------------
router.route('/leads')// create a lead
    .post(function (req, res) {

        models.Lead.create({
            email: req.body.email,
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            language: req.body.language
        }, function (err, lead) {
            if (err) {
                console.error("failed to create lead", err);
                res.status(500);
                res.json({
                    statusCode: 500,
                    errorCode: "leadCreationFailed",
                    errorMessage: "Failed to create lead"
                });
                res.end();
                return;
            }

            // any leads that are created will get pushed to JCS on an interval, if they haven't been
            // closed by the user completing the online sponsoring process

            console.error("created lead", lead);

            res.status(201);
            res.json(lead);
            res.end();
        });
    })

    .delete(function (req, res) {
        var email = req.query.email;

        console.log("removing leads for", email);

        if (S(email).isEmpty()) {
            res.status(400);
            res.json({
                statusCode: 400,
                errorCode: "leadRemoveFailed",
                errorMessage: "Failed to remove lead"
            });
            res.end();
            return;
        }

        models.Lead.update({ email: email, sent: false, completed: false }, { completed: true }, {options: { multi: true }}, function (err, count) {
            if (err) {
                console.error("failed to remove lead", err);
                res.status(500);
                res.json({
                    statusCode: 500,
                    errorCode: "leadRemoveFailed",
                    errorMessage: "Failed to remove lead"
                });
                res.end();
                return;
            }

            // any leads that are created will get pushed to JCS on an interval, if they haven't been
            // closed by the user completing the online sponsoring process

            console.error("updated lead count", count);

            res.status(204);
            res.end();
        });
    });

// CLIENTS
// ----------------------------------------------------
router.route('/clients') // get current client
    // create a client
    .post(function (req, res) {
        // TODO - create the client

        // validate the email address first, then create the client if it's valid
        jafraClient.validateEmail(req.body.email).then(function(r) {
            console.log("validated email", r.status, "result", r.result);

            // email is valid, continue
            jafraClient.createClient({
                "email": req.body.email,
                "password": req.body.password,
                "firstName": req.body.firstName,
                lastName: req.body.lastName,
                dateOfBirth: req.body.dateOfBirth,
                consultantId: req.body.consultantId,
                language: req.body.language
            }).then(function(r2) {
                console.log("created client", r2.result.statusCode, "body", r2.result);

                // add the new client to the session
                req.session.client = r2.result;

                // return response
                res.status(r2.status);
                res.json(r2.result);
                res.end();
            }, function(r2) {
                console.error("failed to create client", r2.result.statusCode, "body", r2.body);
                res.status(r2.status);
                res.json(r2.result);
                res.end();
            });
        }, function(r) {
            console.error("failed to validate email", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
            res.end();
        });

    });

router.route('/clients/:client_id')// get a consultant
    .get(function (req, res) {
        var clientId = req.params.client_id;

        // fetch the client information & return
        jafraClient.getClient(clientId).then(function(r) {
            res.status(r.status);
            res.json(r.result);
        }, function (r) {
            console.error("server: getClient(): failed to load client", r.result);
            res.status(500);
            res.json(r.result);
        });
    })

    // update a client
    .put(function (req, res) {
        res.json({ consultantId: 1000 });
    });

// CONSULTANTS
// ----------------------------------------------------
router.route('/consultants') // get current consultant

    // create a consultant
    .post(function (req, res) {
        console.log("create consultant: got data", req.body.encrypted);

        jafraClient.createConsultant(req.body.encrypted).then(function(r) {
            console.log("success", r)
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failure", r)
            res.status(r.status);
            res.json(r.result);
        });
    });

router.route('/consultants/lookup') // get current consultant

    // lookup a consultant
    .post(function (req, res) {
        console.log("lookup consultant: got data", req.body.encrypted);

        // fetch
        jafraClient.lookupConsultant(req.body.encrypted).then(function(r) {
            console.log("server: consultant looked up");
            res.status(200);
            res.json(r.result);
        }, function (r) {
            console.error("server: failed to load consultant", r.result);
            res.status(r.status);
            res.json(r.result);
            res.end();
        });

    });

router.route('/consultants/:consultant_id')// get a consultant
    .get(function (req, res) {
        var consultant_id = req.params.consultant_id;

        // fetch the consultant information & return
        jafraClient.getConsultant(consultant_id).then(function(r) {
            res.status(r.status);
            res.json(r.result);
        }, function (r) {
            console.error("server: getClient(): failed to load consultant", r.result);
            res.status(500);
            res.json(r.result);
        });

    });


// ADDRESSES
// ----------------------------------------------------
router.route('/clients/:client_id/addresses')// get a client's addresses
    .get(function (req, res) {
        var clientId = req.params.client_id;
        console.log("create address", req.body);

        jafraClient.getAddresses(clientId).then(function(r) {
            console.error("got addresses", r.status, r.result);

            // return response
            res.status(r.status);

            // add this address to the session
            var addresses = r.result;
            req.session.client.addresses = addresses;

            // return the address data
            res.json(addresses);
        }, function(r) {
            console.error("failed to get addresses", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
        });
    })

    // create an address
    .post(function (req, res) {
        console.log("create address", req.body);
        var clientId = req.params.client_id;

        jafraClient.createAddress(clientId, {
            "name": req.body.name,
            "address1": req.body.address1,
            "address2": req.body.address2,
            "city": req.body.city,
            "county": req.body.county,
            "geocode": "000000",
            "state": req.body.state,
            "zip": req.body.zip,
            "country": req.body.country,
            "phone": req.body.phone
        }).then(function(r) {
            console.error("created address", r.status, r.result);

            // return response
            res.status(r.status);

            // add this address to the session
            var address = r.result;
            req.session.client.addresses.push(address);

            // return the address data
            res.json(address);
        }, function(r) {
            console.error("failed to create address", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

router.route('/clients/:client_id/addresses/:address_id')// get a client address
    .get(function (req, res) {
        var clientId = req.params.client_id;
        var addressId = req.params.address_id;

    })

    // update a client address
    .put(function (req, res) {
        res.status(204);
    })

    // delete a client address
    .delete(function (req, res) {
        var clientId = req.params.client_id;
        var addressId = req.params.address_id;

        jafraClient.deleteAddress(clientId, addressId).then(function(r) {
            console.log("deleted address", clientId, addressId);

            // remove the address from the req.session data
            for (var i=0; i < req.session.client.addresses.length; i++) {
                if (req.session.client.addresses[i].id == addressId) {
                    req.session.client.addresses = req.session.client.addresses.splice(i, 1);
                    break;
                }
            }

            // remove from the checkout data if needed
            if (req.session.checkout && req.session.checkout.shipping && req.session.checkout.shipping.id == addressId) {
                req.session.checkout.shipping = null;
            }
            if (req.session.checkout && req.session.checkout.billing && req.session.checkout.billing.id == addressId) {
                req.session.checkout.billing = null;
            }
            
            // return response
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to delete address", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

// CREDIT CARDS
// ----------------------------------------------------
router.route('/clients/:client_id/creditCards')// get a client's creditCards
    .get(function (req, res) {
        var clientId = req.params.client_id;

        return [
            {
                "id": 111,
                "name": "Joe Smith",
                "lastFour": "1111",
                "cardType": "visa",
                "expMonth": "12",
                "expYear": "1978"
            }
        ];
    })

    // create a credit card
    .post(function (req, res) {
        var clientId = req.params.client_id;

        console.log("got data", req.body.encrypted);

        jafraClient.createCreditCard(clientId, req.body.encrypted).then(function(r) {
            console.log("created credit card", r.status, r.result);

            // return response
            res.status(r.status);

            // add this CC to the session
            var cc = r.result;

            console.log("created credit card, client", req.session.client);
            req.session.client.creditCards.push(cc);

            // return the address data
            res.json(cc);
            res.end();
            console.error("create credit card done");
        }, function(r) {
            console.error("failed to create cc", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
            res.end();
        });
    });

router.route('/clients/:client_id/creditCards/:creditCardId')// get a client creditCard
    .get(function (req, res) {
        var clientId = req.params.client_id;
        var creditCardId = req.params.creditCardId;

        // must be authenticated
        if (req.session.client == null) {
            res.status(401);
            res.end();
            return;
        } else if (req.session.client.id != clientId) {
            res.status(403);
            res.end();
            return;
        }

        jafraClient.getCreditCard(clientId, creditCardId).then(function(r) {
            console.log("got credit card", r.status, "result", r.result);
            // return response
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to get credit card", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
        });
    })

    // update a client creditCard
    .put(function (req, res) {
        var clientId = req.params.client_id;
        var creditCardId = req.params.creditCardId;

        console.log("got data", req.body.encrypted);

        jafraClient.updateCreditCard(clientId, creditCardId, req.body.encrypted).then(function(r) {
            console.error("created credit card", r.status, r.result);

            // update this CC in the session
            //req.session.client.creditCards.push(creditCard);

            res.json(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to create cc", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
        });
    })

    // delete a client creditCard
    .delete(function (req, res) {
        var clientId = req.params.client_id;
        var creditCardId = req.params.creditCardId;

        console.log("got id, cc", clientId, creditCardId);

        jafraClient.deleteCreditCard(clientId, creditCardId).then(function(r) {
            console.error("deleted credit card", r.status, r.result);

            // remove this CC from the session
            //req.session.client.creditCards.push(creditCard);

            res.json(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to delete cc", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

// ORDERS
// ----------------------------------------------------
router.route('/orders')// create an order
    .post(function (req, res) {
        res.json({
            orderId: 1234
        });
    });

//// VALIDATION
router.route('/validate/address') // validate address
    .post(function (req, res) {
        console.log("validating address", req.body);

        // validate the address
        jafraClient.validateAddress({
            "name": req.body.name,
            "address1": req.body.address1,
            "address2": req.body.address2,
            "city": req.body.city,
            "state": req.body.state,
            "zip": req.body.zip,
            "country": req.body.country,
            "phone": req.body.phone
        }).then(function(r) {
            console.log("validated address", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to validate address", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

router.route('/validate/email') // validate email address
    .get(function (req, res) {
        var email = req.param('email');

        console.log("validating email", email);
        jafraClient.validateEmail(email).then(function(r) {
            console.log("validated email", r.status, "result", r.result);
            // return response
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to validate email", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

router.route('/geocodes')
    .get(function (req, res) {
        var zipCode = req.param('zipCode');

        console.log("getting geocodes for zip", zipCode);
        jafraClient.getGeocodes(zipCode).then(function(r) {
            console.log("got geocodes", r.status, "result", r.result);
            // return response
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to get geocodes", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

router.route('/calculateTax')
    .post(function (req, res) {
        console.log("getting tax calculations for", req.body);
        jafraClient.calculateSalesTax(req.body).then(function(r) {
            console.log("got tax calculations", r.status, "result", r.result);
            // return response
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to get tax calculations", r.status, "result", r.result);
            res.status(r.status);
            res.json(r.result);
        });
    });

// Configure Lead Cleanup Interval

setInterval(function() {
    var now = new Date();
    var olderThan = new Date(now.getTime() - LEAD_MAX_AGE);
    //console.log("now", now, "olderThan", olderThan);

    models.Lead.find({created: {$lte: olderThan}, sent: false, completed: false}, function(err, leads) {
        console.log("found old leads to send to server", leads);
        for (var i=0; i < leads.length; i++) {
            var lead = leads[i];
            jafraClient.createLead({
                email: lead.email,
                firstName: lead.firstName,
                lastName: lead.lastName,
                phone: lead.phone,
                language: lead.language
            }).then(function(r) {
                console.log("created lead on server", r.result.statusCode, "body", r.result, "removing from local", lead._id);
                lead.sent = true;
                lead.save(function (err, product, numberAffected) {
                    if (err) {
                        console.error("failed to mark lead sent", err);
                        return;
                    }
                })
            }, function(r) {
                if (r.status == 409) {
                    // lead already created, mark sent
                    console.log("created already on server", r.result.statusCode, "body", r.result, "marking sent", lead._id);
                    lead.sent = true;
                    lead.save(function (err, product, numberAffected) {
                        if (err) {
                            console.error("failed to mark lead sent", err);
                            return;
                        }
                    })
                } else {
                    console.error("failed to create lead on server", r.result.statusCode, "body", r.body);
                }
            });
        }
    });
}, LEAD_PROCESSING_INTERVAL);

// Configure Express

var basepath = __dirname;

app.use(express.static(basepath + '/public')); // set the static files location /public/img will be /img for users
app.use(morgan('dev'));                         // logging
app.use(methodOverride());                      // simulate DELETE and PUT
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// serve up proper PGP dynamically for dev/prod
app.get('/js/pgp_key.js', function(req, res) {
    try {
        res.sendfile(basepath + '/' + config.pgp_key_file);
    } catch (ex) {
        console.error("Failed to open PGP key", ex);
        res.status(404);
        res.end();
    }
});

// Web application
app.use('/img', express.static(basepath + '/img'));
app.use('/video', express.static(basepath + '/video'));
app.use('/lib', express.static(basepath + '/lib'));
app.use('/js', express.static(basepath + '/js'));
app.use('/partials', express.static(basepath + '/partials'));
app.use('/styles', express.static(basepath + '/styles'));
app.use('/fonts', express.static(basepath + '/fonts'));
app.use('/i18n', express.static(basepath + '/i18n'));

// API route
//app.use('/api', express.static(__dirname + '/api')); // old used for serving static XML files
app.use('/api', router);

//app.get('/$', function (req, res) {
//    console.log('root', req);
//    res.redirect("http://www.jafra.com/");
//    res.end();
//});

app.get('/$', function (req, res) {
    console.log('root');
    if (req.headers['user-agent'].indexOf("MSIE") >= 0) {
        var myNav = req.headers['user-agent'];
        var IEbrowser = parseInt(myNav.split('MSIE')[1])
        if (IEbrowser <= 9) {
            res.sendfile(basepath + '/redirect.html');
            return;
        }
    }
    res.redirect("http://www.jafra.com/");
});

// any URL beginning with /join without a dot or / should serve online_sponsoring.html, save for /api methods captured above
app.get('/join*', function (req, res) {
    console.log('join path');
    res.sendfile(basepath + '/online_sponsoring.html'); // load the single view file (angular will handle the page changes on the front-end)
});

// any URL without a dot or / should serve index.html, save for /api methods captured above
app.get('/shop*', function (req, res) {
    console.log('store path');
    res.sendfile(basepath + '/index.html'); // load the single view file (angular will handle the page changes on the front-end)
});

app.get('/encrypt_test.html$', function (req, res) {
    res.sendfile(basepath + '/encrypt_test.html'); // load the single view file (angular will handle the page changes on the front-end)
});

models.onReady(function () {
    console.log('Connected to database');

    if (env === 'test') {
        http.createServer(mockserver('./mocks')).listen(mock_port);
        console.log('Mock API server on port ' + mock_port);
    }

    console.log('Using JCS API IP ', config.jcs_api_ip);

    // START THE SERVER
    // =============================================================================
    app.listen(port);
    console.log('App & API on port ' + port);
});
