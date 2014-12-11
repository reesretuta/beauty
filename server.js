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
var Grid = require('gridfs-stream');

// configure app
//app.use(bodyParser());

var port = process.env.PORT || 8090; // set our port
var mock_port = process.env.MOCK_PORT || 9001; // set our port
var LEAD_PROCESSING_INTERVAL = process.env.LEAD_PROCESSING_INTERVAL || 5 * 60 * 1000; // default: 5 min
var LEAD_MAX_AGE = process.env.LEAD_MAX_AGE || 60 * 60 * 1000; // default: 1 hour
var INVENTORY_SCANNING_INTERVAL = process.env.INVENTORY_SCANNING_INTERVAL || 30 * 60 * 1000; // default: 30 minutes

//var morgan = require('morgan')
var models = require('./common/models.js');
var GridFS = Grid(models.mongoose.connection.db, models.mongoose.mongo);

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
    if ((user === undefined || user['name'] !== 'jafra' || user['pass'] !== 'easypassfordpaxton') && env != "development") {
        //res.statusCode = 401;
        //res.setHeader('WWW-Authenticate', 'Basic realm="JafraProto"');
        //res.end('Unauthorized');
        next();
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

jafraClient.preloadCategories();

// CATEGORIES
// ----------------------------------------------------
router.route('/categories')// get all the categories
    .get(function (req, res) {
        console.log("getting category list");
        var now = new Date();

        models.Category.find({$and:[
            {parent: { $exists: false }, onHold: false, showInMenu: true},
            {$or: [{"startDate":{$lte: now}}, {startDate: {$exists: false}}]},
            {$or: [{"endDate":{$gte: now}}, {endDate: {$exists: false}}]}
        ]})
        .sort('rank').limit(100)
        .populate({
            path: 'children',
            match: { $and: [
                {onHold: false, showInMenu: true},
                {$or: [{"startDate":{$lte: now}}, {startDate: {$exists: false}}]},
                {$or: [{"endDate":{$gte: now}}, {endDate: {$exists: false}}]}
            ]}
        }).exec(function (err, categories) {
            if (err) {
                res.send(err);
            }

            var opts = {
                path: 'children.children',
                model: 'Category',
                match: { $and: [
                    {onHold: false, showInMenu: true},
                    {$or: [{"startDate":{$lte: now}}, {startDate: {$exists: false}}]},
                    {$or: [{"endDate":{$gte: now}}, {endDate: {$exists: false}}]}
                ]}
            }

            // populate all levels
            models.Category.populate(categories, opts, function (err, categories) {
                opts = {
                    path: 'children.children.children',
                    model: 'Category',
                    match: { $and: [
                        {onHold: false, showInMenu: true},
                        {$or: [{"startDate":{$lte: now}}, {startDate: {$exists: false}}]},
                        {$or: [{"endDate":{$gte: now}}, {endDate: {$exists: false}}]}
                    ]}
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
        var loadUnavailable = req.query.loadUnavailable || false;
        var loadComponents = req.query.loadComponents || false;
        var loadStarterKits = req.query.loadStarterKits || false;

        var language = req.query.language || 'en_US';
        var sort = req.query.sort;
        if (sort == null) {
            if (language == 'es_US') {
                sort = 'name_es_US';
            } else {
                sort = 'name';
            }
        }
        var limit = parseInt(req.query.limit);
        if (!limit || isNaN(limit)) {
            limit = 20;
        }
        var skip = parseInt(req.query.skip);
        if (!skip || isNaN(skip)) {
            skip = 0;
        }

        var now = new Date();

        if (searchString != null && !S(searchString).isEmpty()) {
            console.log("searching for product by string", searchString);
            //var re = new RegExp(searchString);

            jafraClient.searchProducts(searchString, loadUnavailable, skip, limit).then(function(products) {
                res.json(products);
            }, function (err) {
                res.send(err);
            });

        } else if (categoryId != null && !S(categoryId).isEmpty()) {
            console.log("searching for products by category", categoryId);
            var id = parseInt(categoryId);

            jafraClient.loadProductsByCategory(id, loadUnavailable, skip, limit, sort).then(function(products) {
                res.json(products);
            }, function (err) {
                res.send(err);
            });

        } else if (productIds != null) {
            if (!Array.isArray(productIds)) {
                productIds = [productIds];
            }
            console.log("searching for product by IDs", productIds);

            jafraClient.loadProductsById(productIds, loadUnavailable, loadStarterKits).then(function(products) {
                res.json(products);
            }, function (err) {
                res.send(err);
            });
        } else {
            console.log("getting product list");

            jafraClient.loadProducts(loadUnavailable, loadComponents, skip, limit, sort).then(function(products) {
                res.json(products);
            }, function (err) {
                res.send(err);
            });

        }
    });

// on routes that end in /products/:productId, get the product with that id
router.route('/products/:productId').get(function (req, res) {
    var productId = req.params.productId;
    var loadUnavailable = req.query.loadUnavailable || false;
    var loadStarterKit = req.query.loadStarterKit || false;

    console.log('getting product', req.params.productId);

    jafraClient.loadProductById(productId, loadUnavailable, loadStarterKit).then(function(product) {
        res.json(product);
        res.end();
    }, function(r) {
        res.status(r.statusCode);
        res.json(r);
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
        req.session.destroy(function(err) {
            if (err) {
                console.log('failed to delete session', error);
                res.status(500);
                res.end();
                return;
            }
            console.log('session deleted');
            res.status(200);
            res.json(req.session);
            res.end();
        });
    });

// SESSIONS
// ----------------------------------------------------
router.route('/session')
    .get(function (req, res) {
        var updated = false;
        if (req.session.cart == null) {
            req.session.cart = [];
            updated = true;
        }
        if (req.session.language == null) {
            req.session.language = 'en_US';
            updated = true;
        }
        if (req.session.checkout == null) {
            req.session.checkout = {};
            updated = true;
        }
        if (req.session.source == null) {
            req.session.source = "web";
            updated = true;
        }

        if (updated) {
            req.session.save(function(err) {
                if (err) {
                    console.error('error saving session', err);
                    res.status(500);
                    res.end();
                    return;
                }

                console.log('session saved', req.session);
                res.json(req.session);
                res.end();
            });
            return;
        }

        console.log("returning session", req.session);
        res.json(req.session);
        res.end();
    })

    // update the session with some data
    .put(function (req, res) {
        var session = req.body;

        console.log("update session request", session);

        req.session.consultantId = session.consultantId;
        req.session.source = session.source;

        // copy over changes to cart, checkout, language
        req.session.language = session.language;
        if (Array.isArray(session.cart)) {
            req.session.cart = [];
            // save only the parts of the session we want
            for (var i=0; i < session.cart.length; i++) {
                var cartItem = session.cart[i];
                var it = {
                    name: cartItem.name,
                    sku: cartItem.sku,
                    kitSelections: cartItem.kitSelections,
                    quantity: cartItem.quantity
                };
                req.session.cart.push(it);
            }
        }
        req.session.checkout = session.checkout;

        req.session.save(function(err) {
            if (err) {
                console.error('error saving session', err);
                res.status(500);
                res.end();
                return;
            }

            // session saved
            console.log('session updated', req.session);
            res.status(200);
            res.json(req.session);
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

router.route('/clients/passwordReset')
    .get(function (req, res) {
        console.log("password reset: got data", req.query);
        var email = req.query.email;
        var language = req.query.language;

        jafraClient.requestPasswordReset(email, language).then(function(r) {
            console.log("success", r)
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failure", r)
            res.status(r.status);
            res.json(r.result);
        });
    })

    .post(function (req, res) {
        console.log("password change: got data", req.body);
        var token = req.body.token;
        var email = req.body.email;
        var password = req.body.password;

        jafraClient.requestPasswordChange(email, password, token).then(function(r) {
            console.log("success", r)
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failure", r)
            res.status(r.status);
            res.json(r.result);
        });
    });

// get a client
router.route('/clients/:client_id').get(function (req, res) {
    var clientId = req.params.client_id;
    if (clientId.indexOf('@') != -1) {
        // fetch the consultant information & return
        jafraClient.lookupClientByEmail(clientId).then(function(data) {
            res.status(data.status);
            res.json(data.result);
        }, function (data) {
            console.error('server: getClient(): failed to load client', data.result);
            res.status(data.status);
            res.json(data.result);
        });
    } else {
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
        // fetch the client information & return
        jafraClient.getClient(clientId).then(function (r) {
            res.status(r.status);
            res.json(r.result);
        }, function (r) {
            console.error("server: getClient(): failed to load client", r.result);
            res.status(500);
            res.json(r.result);
        });
    }
})

// update a client
.put(function (req, res) {
    res.json({});
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

        if (consultant_id.indexOf('@') != -1) {
            // fetch the consultant information & return
            jafraClient.lookupConsultantByEmail(consultant_id).then(function(r) {
                res.status(r.status);
                res.json(r.result);
            }, function (r) {
                console.error("server: getConsultant(): failed to load consultant", r.result);
                res.status(r.status);
                res.json(r.result);
            });
        } else {
            // fetch the consultant information & return
            jafraClient.getConsultant(consultant_id).then(function(r) {
                res.status(r.status);
                res.json(r.result);
            }, function (r) {
                console.error("server: getConsultant(): failed to load consultant", r.result);
                res.status(500);
                res.json(r.result);
            });
        }

    });


// ADDRESSES
// ----------------------------------------------------
router.route('/clients/:client_id/addresses')// get a client's addresses
    .get(function (req, res) {
        var clientId = req.params.client_id;
        console.log("create address", req.body);

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
        var clientId = req.params.client_id;

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

        console.log("creating address", clientId, req.body);

        jafraClient.createAddress(clientId, {
            "name": req.body.name,
            "address1": req.body.address1,
            "address2": req.body.address2,
            "city": req.body.city,
            "county": req.body.county,
            "geocode": req.body.geocode,
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

        // NOT USED ATM (managed in the session as retrieved from login)
    })

    // update a client address
    .put(function (req, res) {
        var clientId = req.params.client_id;
        var addressId = req.params.address_id;

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

        console.log("updating address", req.body);

        jafraClient.updateAddress(clientId, addressId, req.body).then(function(r) {
            console.error("updated address", r.status, r.result);

            // update this address in the session
            if (req.session.checkout && req.session.checkout.shipping && req.session.checkout.shipping.id == addressId) {
                req.session.checkout.shipping = req.body;
            }
            if (req.session.checkout && req.session.checkout.billing && req.session.checkout.billing.id == addressId) {
                req.session.checkout.billing = req.body;
            }

            res.json(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to create cc", r.status, r.result);
            res.status(r.status);
            res.json(r.result);
        });
    })

    // delete a client address
    .delete(function (req, res) {
        var clientId = req.params.client_id;
        var addressId = req.params.address_id;

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

        console.log("deleting", clientId, addressId);

        jafraClient.deleteAddress(clientId, addressId).then(function(r) {
            console.log("deleted address", clientId, addressId);

            // remove the address from the req.session data
            for (var i=0; i < req.session.client.addresses.length; i++) {
                if (req.session.client.addresses[i].id == addressId) {
                    req.session.client.addresses.splice(i, 1);
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
        // NOT USED ATM (managed in the session as retrieved from login)
        return [];
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

        console.log("got cc get", clientId, creditCardId);

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

        console.log("got cc update", clientId, creditCardId, req.body.encrypted);

        jafraClient.updateCreditCard(clientId, creditCardId, req.body.encrypted).then(function(r) {
            console.error("updated credit card", r.status, r.result);

            // remove the cc from the req.session data
            for (var i=0; i < req.session.client.creditCards.length; i++) {
                if (req.session.client.creditCards[i].id == creditCardId) {
                    req.session.client.creditCards[i] = r.result;
                    console.log("updated credit card in session");
                    break;
                }
            }

            res.status(200);
            res.json(r.result);
            res.end();

            //// fetch credit cards now to place in the session
            //jafraClient.getCreditCards(clientId).then(function(r) {
            //    console.error("setting credit cards in session to", r.status, r.result);
            //    req.session.client.creditCards = r.result;
            //    res.status(204);
            //    res.end();
            //}, function(r) {
            //    console.error("failed to create cc", r.status, r.result);
            //    res.status(500);
            //    res.json({
            //        statusCode: 500,
            //        errorCode: "creditCardUpdateFailure",
            //        message: "Failed to update credit card in session"
            //    });
            //    res.end();
            //});
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

        console.log("got cc delete", clientId, creditCardId);

        jafraClient.deleteCreditCard(clientId, creditCardId).then(function(r) {
            console.log("deleted credit card", r.status, r.result);

            // remove the cc from the req.session data
            for (var i=0; i < req.session.client.creditCards.length; i++) {
                if (req.session.client.creditCards[i].id == creditCardId) {
                    req.session.client.creditCards.splice(i, 1);
                    console.log("removing deleted credit card from session");
                    break;
                }
            }

            res.json(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failed to delete cc", r.status, r.result);

            // remove the cc from the req.session data
            for (var i=0; i < req.session.client.creditCards.length; i++) {
                if (req.session.client.creditCards[i].id == creditCardId) {
                    req.session.client.creditCards.splice(i, 1);
                    console.log("removing deleted credit card from session");
                    break;
                }
            }

            res.status(r.status);
            res.json(r.result);
        });
    });

// ORDERS
// ----------------------------------------------------
router.route('/orders')// create an order
    .post(function (req, res) {
        console.log("create order: got data", req.body);

        jafraClient.createOrder(req.body).then(function(r) {
            console.log("success", r)
            res.status(r.status);
            res.json(r.result);
        }, function(r) {
            console.error("failure", r)
            res.status(r.status);
            res.json(r.result);
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

// INVENTORY
// ----------------------------------------------------
// check if product is available
router.route('/inventory/:inventoryId').get(function (req, res) {
    console.log('getting inventory', req.params);

    jafraClient.getInventory(req.params.inventoryId).then(function(r) {
        console.log("got inventory", r.status, "result", r.result);
        // return response
        res.status(r.status);
        res.json(r.result);
    }, function (r) {
        console.error("failed to get inventory", r.status, "result", r.result);
        res.status(r.status);
        res.json(r.result);
    });
});

var assetRouter = express.Router();
assetRouter.get('*', function (req, res) {
        var asset = req.params[0];
        console.log("getting asset", asset);

        try {
            GridFS.exist({filename: asset}, function (err, found) {
                if (err) {
                    console.error(err);
                    res.status(404);
                    res.end();
                    return;
                }

                if (found) {
                    var readstream = GridFS.createReadStream({filename: asset});
                    readstream.pipe(res);
                } else {
                    res.status(404);
                    res.end();
                }
            });
        } catch (err) {
            log.error(err);
            res.status(404);
            res.end();
            return;
        }
    });

// Configure Lead Cleanup Interval

setInterval(function() {
    var now = new Date();
    var olderThan = new Date(now.getTime() - LEAD_MAX_AGE);
    //console.log("now", now, "olderThan", olderThan);

    models.Lead.find({created: {$lte: olderThan}, sent: false, completed: false}, function(err, leads) {
        if (err) {
            console.error("failed looking up leads from server", err);
            return;
        }

        if (leads == null) {
            console.log("no leads to send to server");
            return;
        }

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

function updateInventory() {
    console.log("updating inventory");
    jafraClient.updateInventory().then(function(inventory) {
        console.log("updated inventory");
    }, function(err) {
        console.error("failed to update inventory", err);
    });
}

// update on startup and on an interval
updateInventory();
setInterval(function() {
    updateInventory();
}, INVENTORY_SCANNING_INTERVAL);

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

// serve up proper config.js
app.get('/js/config.js', function(req, res) {
    try {
        res.contentType("text/javascript");
        if (env === 'test' || env === 'development') {
            res.send("DEBUG=true;CDN_URL='"+config.cdn_base_url+"';");
        } else {
            res.send("DEBUG=false;CDN_URL='"+config.cdn_base_url+"';");
        }
        res.end();
    } catch (ex) {
        console.error("Failed to open debug script", ex);
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

app.use('/assets', assetRouter);

//app.get('/$', function (req, res) {
//    console.log('root', req);
//    res.redirect("http://www.jafra.com/");
//    res.end();
//});

// handle redirects
app.get('*', function (req, res, next) {
    //console.log("request for hostname", req.hostname);
    if (req.hostname && S(req.hostname).endsWith("joinjafra.com")) {
        console.log("redirecting joinjafra.com to usa.jafra.com");
        res.redirect("https://usa.jafra.com/join/");
        res.end();
        return;
    }

    next();
});

app.get('/*', function (req, res, next) {
    if (req.headers['user-agent'].indexOf("MSIE") >= 0) {
        console.log('IE <= 9 detected, showing upgrade page');
        var myNav = req.headers['user-agent'];
        var IEbrowser = parseInt(myNav.split('MSIE')[1])
        if (IEbrowser <= 9) {
            if (req.originalUrl != null && req.originalUrl.match("/join")) {
                res.sendfile(basepath + '/browser_unsupported.join.html');
            } else {
                res.sendfile(basepath + '/browser_unsupported.shop.html');
            }
            return;
        }
    }
    next();
});

app.get('/$', function (req, res) {
    console.log('root');
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

    if (env === 'mock') {
        http.createServer(mockserver('./mocks')).listen(mock_port);
        console.log('Mock API server on port ' + mock_port);
    }

    console.log('Using JCS API IP ', config.jcs_api_ip);

    // START THE SERVER
    // =============================================================================
    app.listen(port);
    console.log('App & API on port ' + port);
});
