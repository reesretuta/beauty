// BASE SETUP
// =============================================================================

// call the packages we need
var express        = require('express');
var methodOverride = require('method-override');
var bodyParser     = require('body-parser');
var morgan         = require('morgan');
var app            = express();

// configure app
//app.use(bodyParser());

var port     = process.env.PORT || 8090; // set our port

//var morgan = require('morgan')
var S = require('string');
var models = require('./common/models.js');

// ROUTES FOR OUR API
// =============================================================================

// create our router
var router = express.Router();

console.log("have router",router);

//// middleware to use for all requests
//router.use(function(req, res, next) {
//    res.header("Access-Control-Allow-Origin", "*");
//    res.header("Access-Control-Allow-Headers", "X-Requested-With");
//
//    // do logging
//    console.log('Request', JSON.stringify(req.url));
//    next();
//});

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'Jafra API' });
});


// CATEGORIES
// ----------------------------------------------------
router.route('/categories')
    // get all the categories
    .get(function(req, res) {
        console.log("getting category list");
        models.Category.find({parent: { $exists: false }, onHold: false, showInMenu: true })
            .sort('rank')
            .limit(100)
            .populate({
                path: 'children',
                match: { onHold: false, showInMenu: true }
            })
            .exec(function(err, categories) {
                if (err)
                    res.send(err);

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

router.route('/categories/:category_id')
    // get the category with that id
    .get(function(req, res) {
        models.Category.findOne({_id: req.params.category_id, onHold: false, showInMenu: true })
            .populate({
                path: 'children',
                match: { onHold: false, showInMenu: true }
            })
            .exec(function(err, category) {
                if (err)
                    res.send(err);

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
    .get(function(req, res) {
        // handle search
        var searchString = req.query.search;
        var categoryId = req.query.categoryId;
        var productIds = req.query.productIds;

        if (searchString != null && !S(searchString).isEmpty()) {
            console.log("searching for product by string", searchString);
            //var re = new RegExp(searchString);
            models.Product.find({ $text : { $search : searchString } })
                //.or([{ 'name': { $regex: re }}, { 'description': { $regex: re }}, { 'usage': { $regex: re }}, { 'ingredients': { $regex: re }}])
                .and([{masterStatus : "A"}])
                .sort('name')
                .limit(20)
                .populate({
                    path: 'upsellItems.product youMayAlsoLike.product contains.product',
                    model: 'Product'
                })
                .exec(function(err, products) {
                    if (err)
                        res.send(err);

                    console.log("returning", products.length, "products");
                    res.json(products);
                });
        } else if (categoryId != null && !S(categoryId).isEmpty()) {
            console.log("searching for product by category", categoryId);
            var id = parseInt(categoryId);
            models.Product.find({ categories : id, masterStatus : "A" })
                .sort('name')
                .limit(20)
                .populate({
                    path: 'upsellItems.product youMayAlsoLike.product contains.product',
                    model: 'Product'
                })
                .exec(function(err, products) {
                    if (err)
                        res.send(err);

                    console.log("returning", products.length, "products");
                    res.json(products);
                });
        } else if (productIds != null) {
            if (!Array.isArray(productIds)) {
                productIds = [productIds];
            }
            console.log("searching for product by IDs", productIds);

            models.Product.find({ _id : { $in: productIds }, masterStatus : "A" })
                .sort('name')
                .limit(20)
                .populate({
                    path: 'upsellItems.product youMayAlsoLike.product contains.product',
                    model: 'Product'
                })
                .exec(function(err, products) {
                    if (err)
                        res.send(err);

                    console.log("returning", products.length, "products");
                    res.json(products);
                });
        } else {
            console.log("getting product list");
            models.Product.find({masterStatus : "A"})
                .sort('name')
                .limit(20)
                .populate({
                    path: 'upsellItems.product youMayAlsoLike.product contains.product',
                    model: 'Product'
                })
                .exec(function(err, products) {
                    if (err)
                        res.send(err);

                    console.log("returning", products.length, "products");
                    res.json(products);
                });
        }
    })

    // create a product (accessed at POST http://localhost:8080/products)
    .post(function(req, res) {

        var product = new models.Product(); // create a new instance of the Product model
        product.name = req.body.name;       // set the products name (comes from the request)

        product.save(function(err) {
            if (err)
                res.send(err);

            res.json({ message: 'Product created!' });
        });


    });

// on routes that end in /products/:product_id
// ----------------------------------------------------
router.route('/products/:product_id')

    // get the product with that id
    .get(function(req, res) {
        models.Product.findById(req.params.product_id, function(err, product) {
            if (err)
                res.send(err);

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

//    // update the product with this id
//    .put(function(req, res) {
//        models.Product.findById(req.params.product_id, function(err, product) {
//
//            if (err)
//                res.send(err);
//
//            console.log("updating product with", JSON.stringify(req.body));
////                product.name = req.body.name;
////                product.save(function(err) {
////                    if (err)
////                        res.send(err);
////
////                    res.json({ message: 'Product updated!' });
////                });
//
//        });
//    })
//
//    // delete the product with this id
//    .delete(function(req, res) {
//        models.Product.remove({
//            _id: req.params.product_id
//        }, function(err, product) {
//            if (err)
//                res.send(err);
//
//            res.json({ message: 'Successfully deleted' });
//        });
//    });


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
app.use('/lib', express.static(basepath + '/lib'));
app.use('/js', express.static(basepath + '/js'));
app.use('/partials', express.static(basepath + '/partials'));
app.use('/styles', express.static(basepath + '/styles'));
app.use('/fonts', express.static(basepath + '/fonts'));
app.use('/i18n', express.static(basepath + '/i18n'));

// API route
//app.use('/api', express.static(__dirname + '/api')); // old used for serving static XML files
app.use('/api', router);

app.get('*', function(req, res) {
    res.sendfile(basepath + '/index.html'); // load the single view file (angular will handle the page changes on the front-end)
});

models.onReady(function() {
    console.log('Connected to database');

    // START THE SERVER
    // =============================================================================
    app.listen(port);
    console.log('App & API on port ' + port);
});
