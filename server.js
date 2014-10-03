// BASE SETUP
// =============================================================================

// call the packages we need
var init = require('./config/init')();
config = require('./config/config');

var express = require('express');
var methodOverride = require('method-override');
var bodyParser = require('body-parser');
var morgan = require('morgan');
var app = express();
var session = require('express-session');
var MongoStore = require('connect-mongo')(session);
var jafraClient = require('./js/jafra');

// configure app
//app.use(bodyParser());

var port = process.env.PORT || 8090; // set our port

//var morgan = require('morgan')
var S = require('string');
var models = require('./common/models.js');

// SESSION CONFIG
var hour = 3600000;
var sess = {
    secret: 'jkfh873y8hwhd871wh9udhju1w9sdhyy1gef87g87dfgw',
    cookie: {
        maxAge: hour,
        secure: false,
        path: "/"
    },
    resave: true,
    saveUninitialized: true,
    store: new MongoStore({
        mongoose_connection : models.db,
        db: config.db,
        stringify: false
    })
};

if (app.get('env') === 'production') {
    app.set('trust proxy', 1) // trust first proxy
    sess.cookie.secure = true // serve secure cookies
}

app.use(session(sess));

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
                    {masterStatus: "A"}
                ]).sort('name').limit(20).populate({
                    path: 'upsellItems.product youMayAlsoLike.product contains.product',
                    model: 'Product'
                }).populate({
                    path: 'kitGroups.kitGroup',
                    model: 'KitGroup'
                }).populate({
                    path: 'kitGroups.kitGroup.components.product',
                    model: 'Product'
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
            models.Product.find({ categories: id, masterStatus: "A" }).sort('name').limit(20).populate({
                path: 'upsellItems.product youMayAlsoLike.product contains.product',
                model: 'Product'
            }).populate({
                path: 'kitGroups.kitGroup',
                model: 'KitGroup'
            }).populate({
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product'
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

            models.Product.find({ _id: { $in: productIds }, masterStatus: "A" }).sort('name').limit(20).populate({
                path: 'upsellItems.product youMayAlsoLike.product contains.product',
                model: 'Product'
            }).populate({
                path: 'kitGroups.kitGroup',
                model: 'KitGroup'
            }).populate({
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product'
            }).exec(function (err, products) {
                if (err) {
                    res.send(err);
                }

                console.log("returning", products.length, "products");
                res.json(products);
            });
        } else {
            console.log("getting product list");
            models.Product.find({masterStatus: "A"}).sort('name').limit(20).populate({
                path: 'upsellItems.product youMayAlsoLike.product contains.product',
                model: 'Product'
            }).populate({
                path: 'kitGroups.kitGroup',
                model: 'KitGroup'
            }).populate({
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product'
            }).exec(function (err, products) {
                if (err) {
                    res.send(err);
                }

                console.log("returning", products.length, "products");
                res.json(products);
            });
        }
    });

// on routes that end in /products/:product_id
router.route('/products/:product_id')

    // get the product with that id
    .get(function (req, res) {
        models.Product.findById(req.params.product_id, function (err, product) {
            if (err) {
                res.send(err);
            }

            var opts = {
                path: 'upsellItems.product youMayAlsoLike.product contains.product',
                model: 'Product'
            }

            // populate products
            models.Product.populate(product, opts, function (err, product) {
                var opts = {
                    path: 'kitGroups.kitGroup'
                };

                // populate kit groups
                models.KitGroup.populate(product, opts, function (err, product) {
                    console.log("returning product");
                    res.json(product);
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
            console.log("authentication successful");

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

        if (updated) {
            req.session.save(function(err) {
                console.log('session saved', req.session);
                res.json(req.session);
            });
            return;
        }
        res.json(req.session);
    })

    // update the session with some data
    .put(function (req, res) {
        var session = req.body;

        console.log("update session request", session);

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
            console.log('session updated');
            res.status(204);
            res.end();
        });
    })

// LEADS
// ----------------------------------------------------
router.route('/leads')// create a lead
    .post(function (req, res) {
        res.status(204);
    });

// CLIENTS
// ----------------------------------------------------
router.route('/clients') // get current client
    // create a client
    .post(function (req, res) {
        // TODO - create the client

        jafraClient.createClient({
            "email": req.body.email,
            "password": req.body.password,
            "firstName": req.body.firstName,
            lastName: req.body.lastName,
            phone: req.body.phone,
            dateOfBirth: req.body.dateOfBirth, // optional
            language: req.body.language        // optional
        }).then(function(r) {
            console.log("response", r.response.statusCode, "body", r.result);

            // add the new client to the session
            req.session.client = r.result;

            // return response
            res.status(r.status);
            res.json(r.result);

        }, function(r) {
            console.error("response", r.response.statusCode, "body", r.body);
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
    // create a client
    .post(function (req, res) {
        res.json({ consultantId: 1000 });
    });

router.route('/consultants/:consultant_id')// get a consultant
//    .get(function (req, res) {
//        var consultant_id = req.params.consultant_id;
//
//        return {
//            "id": 1000,
//            "email": "jsmith@gmail.com",
//            "firstName": "John",
//            "lastName": "Smith",
//            "phone": "555-555-4432",
//            "dateOfBirth": "12/01/1978",
//            "sponsorId": 4657323,
//            "language": "en_US"
//        };
//    })

    // create a consultant
    .post(function (req, res) {
        res.json({ consultantId: 1000 });
    });

// ADDRESSES
// ----------------------------------------------------
router.route('/clients/:client_id/addresses')// get a client's addresses
    .get(function (req, res) {
        var clientId = req.params.client_id;

        return [
            {
                "id": 111,
                "name": "Joe Smith",
                "address1": "1111 Test Ln",
                "address2": "",
                "city": "Corona",
                "state": "CA",
                "zip": "92880",
                "country": "United States",
                "phone": "555-333-2222"
            }
        ];
    })

    // create a client
    .post(function (req, res) {
        res.json({ addressId: 111 });
    });

router.route('/clients/:client_id/addresses/:address_id')// get a client address
    .get(function (req, res) {
        var clientId = req.params.client_id;
        var addressId = req.params.address_id;

        return {
            "id": addressId,
            "name": "Joe Smith",
            "address1": "1111 Test Ln",
            "address2": "",
            "city": "Corona",
            "state": "CA",
            "zip": "92880",
            "country": "United States",
            "phone": "555-333-2222"
        };
    })

    // update a client address
    .put(function (req, res) {
        res.status(204);
    })

    // delete a client address
    .delete(function (req, res) {
        res.status(204);
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
        res.json({ creditCardId: 111 });
    });

router.route('/clients/:client_id/creditCards/:creditCard_id')// get a client creditCard
    .get(function (req, res) {
        var clientId = req.params.client_id;
        var creditCardId = req.params.creditCard_id;

        return {
            "id": 111,
            "name": "Joe Smith",
            "lastFour": "1111",
            "cardType": "visa",
            "expMonth": "12",
            "expYear": "2015"
        };
    })

    // update a client creditCard
    .put(function (req, res) {
        res.status(204);
    })

    // delete a client creditCard
    .delete(function (req, res) {
        res.status(204);
    });

// ORDERS
// ----------------------------------------------------
router.route('/orders')// create an order
    .post(function (req, res) {
        res.json({
            orderId: 1234
        });
    });

// Configure Express

var basepath = __dirname;

app.use(express.static(basepath + '/public')); // set the static files location /public/img will be /img for users
app.use(morgan('dev'));                         // logging
app.use(methodOverride());                      // simulate DELETE and PUT
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

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

app.get('/$', function (req, res) {
    console.log('root');
    res.redirect("http://www.jafra.com/");
    res.end();
});

// any URL beginning with /join without a dot or / should serve online_sponsoring.html, save for /api methods captured above
app.get('/join*', function (req, res) {
    console.log('join path');
    res.sendfile(basepath + '/online_sponsoring.html'); // load the single view file (angular will handle the page changes on the front-end)
});

// any URL without a dot or / should serve index.html, save for /api methods captured above
app.get('/store*', function (req, res) {
    console.log('store path');
    res.sendfile(basepath + '/index.html'); // load the single view file (angular will handle the page changes on the front-end)
});

app.get('/encrypt_test.html$', function (req, res) {
    res.sendfile(basepath + '/encrypt_test.html'); // load the single view file (angular will handle the page changes on the front-end)
});

models.onReady(function () {
    console.log('Connected to database');

    // START THE SERVER
    // =============================================================================
    app.listen(port);
    console.log('App & API on port ' + port);
});
