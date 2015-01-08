/**
 * This file contains a scraping application that will scrape the site located at BASE_SITE_URL below
 * and store all resulting data into mongodb
 *
 */
var Spooky = require('spooky');
var S = require('string');
var request = require('request');
var Q = require('q');
var jafraClient = require('./jafra');
jafraClient.setLogger(console);

var models = require('./common/models.js');
var Grid = require('gridfs-stream');
var GridFS = Grid(models.mongoose.connection.db, models.mongoose.mongo);
var moment = require('moment');
var deep = require('deep-diff');

var options = require('minimist')(process.argv.slice(2));
if (options["products"]) {
    options["products"] = options["products"] + "";
    options["products"] = options["products"].split(/,/);
}
console.log("options", options);

models.onError(function(err) {
    console.error("error connecting to the database", err);
})

models.onReady(function() {
    console.log('Connected to database');

    var savedCategories = 0;
    var savedProducts = 0;
    var savedProductKits = 0;
    var savedProductGroups = 0;
    var savedKitGroups = 0;

    var updatedCategories = 0;
    var updatedProducts = 0;
    var updatedProductKits = 0;
    var updatedProductGroups = 0;
    var updatedKitGroups = 0;

    var skippedProducts = 0;
    var skippedProductKits = 0;
    var skippedProductGroups = 0;

    var existingProductTypes = {};
    var existingProductPromotionalMessages = {};
    var existingProductUpsellItems = {};

    var totalImageFetches = 0;
    var completedImageFetches = 0;

    var processingProductComplete = {};

    var updatedProductIds = [];

    var VERBOSE = process.env.VERBOSE || options["verbose"] || false;
    var AVAILABLE_ONLY = process.env.AVAILABLE_ONLY || options["available-only"] || false;
    var TEMP_UNAVAILABLE_ONLY = process.env.TEMP_UNAVAILABLE_ONLY || options["temp-unavailable-only"] || false;
    var BASIC = process.env.BASIC || options["basic"] || false;
    var IMAGES_ONLY = process.env.IMAGES_ONLY || options["images"] || false;
    var BASE_SITE_URL = process.env.BASE_SITE_URL || "https://stageadmin.jafra.com";
    var USERNAME = process.env.USERNAME || "jafra_test";
    var PASSWORD = process.env.PASSWORD || "lavisual1";
    var LANGUAGE = process.env.LANGUAGE || options["language"] || "en_US";

    console.log("base url", BASE_SITE_URL);
    console.log("username", USERNAME);
    console.log("password", PASSWORD);
    console.log("================================");
    console.log("available only", AVAILABLE_ONLY);
    console.log("temp available only", TEMP_UNAVAILABLE_ONLY);
    console.log("basic", BASIC);
    console.log("images only", IMAGES_ONLY);
    console.log("language", LANGUAGE);
    console.log("================================");

    // load up the known products / product groups, so we can prioritize loading new ones
    models.Product.find({}, '_id type promotionalMessages upsellItems', function(err, products) {
        if (err) return console.error("error loading products", err);
        if (products != null) {
            for (var i=0; i < products.length; i++) {
                var id = products[i]._id;
                existingProductTypes[id] = products[i].type;
                //console.log("product", id, "type", products[i].type);
                existingProductPromotionalMessages[id] = products[i].promotionalMessages;
                //console.log("product", id, "messages", products[i].promotionalMessages);
                existingProductUpsellItems[id] = products[i].upsellItems;
            }
        }
    });

    // DEBUGGING
    //models.Product.findOne({_id: "11345"}).populate('contains.product').populate('kitGroups.kitGroup').exec(function(err, product) {
    //    console.log("got loaded product", JSON.stringify(product));
    //});
    //return;

    // scraping session
    // - generate session key
    // - checkpoint stage: product, kit, group, kitGroup
    // - fetch the lists for each stage
    // - mark items as they are created
    // - log progress level as they are created
    //
    // Ability to resume
    // TODO - fetch available (include temp unavailable products)



    var spooky = new Spooky({
        child: {
            transport: 'stdio',
            "ignore-ssl-errors": true,
            "ssl-protocol": 'tlsv1'
            //proxy: 'localhost:8889',
            //'proxy-type': 'socks5'
        },
        casper: {
            clientScripts:  [
                './common/jquery-1.4.2.min.js',      // This will be injected in remote on every request
                './lib/momentjs/moment.js',
                './lib/string.js/lib/string.min.js'
            ],
            pageSettings: {
                loadImages:  false,        // The WebPage instance used by Casper will
                loadPlugins: false,        // use these settings
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/35.0.1916.153 Safari/537.36'
            },
            logLevel: "debug",             // Only this level messages and below will be logged
            verbose: true                  // log messages will be printed out to the console
        }
    }, function (err) {
        if (err) {
            var e = new Error('Failed to initialize SpookyJS');
            e.details = err;
            throw e;
        }

        console.log("starting spooky");
        spooky.start();
        console.log("done starting spooky");

        // LOGIN
        spooky.then([{
            existingProductTypes: existingProductTypes,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            TEMP_UNAVAILABLE_ONLY: TEMP_UNAVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL,
            USERNAME: USERNAME,
            PASSWORD: PASSWORD,
            LANGUAGE: LANGUAGE
        }, function () {
            console.log("== LOGIN ==");

            // casperjs context here
            var casper = this;

            casper.onResourceReceived = function (response) {
                //console.log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response));
            };
            casper.onResourceError = function (resourceError) {
                console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
            };

            var login_url = BASE_SITE_URL + '/csr-admin/security-admin/login';

            console.log("login url", login_url);

            // LOGIN
            var data = "pagechanged=N&tab=&redirectPage=%2Fadmin&userid=" + USERNAME + "&password=" + PASSWORD;
            casper.open(login_url, {
                method: 'post', data: data
            }).then(function (response) {
                console.log('response', JSON.stringify(response));
                if (response.status !== 200) {
                    console.error('Unable to login!', response.status);
                    this.exit();
                } else {
                    console.log('Logged in');
                }
            });

            // MANAGE SKUS
            var manage_skus_url = BASE_SITE_URL + '/csr-admin-4/productcatalog/product.listing?adminUserId=86&language=' + LANGUAGE;

            casper.thenOpen(manage_skus_url, function (response) {
                if (response.status !== 200) {
                    console.error('Unable to get Manage SKUs!', response.status);
                    this.exit();
                } else {
                    console.log('Got Manage SKUs');
                }
            });
        }]);

        // CATEGORIES
        if (!options["skipCategories"] && !options["products"]) {
            spooky.then([{
                existingProductTypes: existingProductTypes,
                AVAILABLE_ONLY: AVAILABLE_ONLY,
                TEMP_UNAVAILABLE_ONLY: TEMP_UNAVAILABLE_ONLY,
                BASE_SITE_URL: BASE_SITE_URL,
                LANGUAGE: LANGUAGE
            }, function () {
                console.log("== CATEGORIES ==");

                // casperjs context here
                var casper = this;

                casper.onResourceError = function (resourceError) {
                    console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                    console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
                };

                var categories = [];
                var visitedCategories = {};

                function Category() {
                }

                var categories_url = BASE_SITE_URL + '/csr-admin-4/productcatalog/product-category.listing';

                try {
                    casper.thenOpen(categories_url, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get categories!', response.status);
                            this.exit();
                        } else {
                            console.log('Got categories page');

                            casper.waitUntilVisible('#categoryListing', function () {
                                console.log("got category listing");
                            });

                            casper.then(function () {
                                // open all children, so they render
                                function expandChildren() {
                                    console.log("expandChildren()");

                                    var notExpanded = casper.evaluate(function () {
                                        var content = $('#categoryListing table.categoryListingTable > tbody > tr:nth-child(2) table').html();
                                        if (content.match(/<img class="pc-parentCategoryNode" src="\/csr-admin-4\/images\/en_US\/productcatalog\/icons\/plus.gif" alt="">/)) {
                                            return true;
                                        }
                                        return false;
                                    });

                                    if (notExpanded) {
                                        console.log("expandChildren(): not expanded");
                                        // expand all categories
                                        casper.evaluate(function () {
                                            try {
                                                console.log("expanding sub-categories");
                                                // expand children
                                                $("img[src$='/csr-admin-4/images/en_US/productcatalog/icons/plus.gif'].pc-parentCategoryNode").click();
                                            } catch (ex) {
                                                console.error("error expanding sub-categories", JSON.stringify(ex));
                                            }
                                        });
                                        casper.wait(1000, function () {
                                            console.log("expanding children after timeout");
                                            expandChildren();
                                        });
                                    } else {
                                        console.log("expandChildren(): all categories expanded");
                                    }
                                }
                                expandChildren();
                            });

                            // DEBUGGING - capture image after expand
                            //casper.then(function() {
                            //    console.log("capturing category page");
                            //    casper.capture('expand.jpg', undefined, {
                            //        format: 'jpg',
                            //        quality: 100
                            //    });
                            //});

                            casper.then(function () {
                                console.log("processing categories");

                                // get all the categories
                                categories = casper.evaluate(function (LANGUAGE) {
                                    /**
                                     * @param {string=} rows
                                     * @param {number=} level
                                     */
                                    function getCategories(rows, level) {
                                        if (level == null) {
                                            level = 0;
                                        }
                                        var indent = "";
                                        for (var i = 0; i < (level ? level : 0); i++) {
                                            indent += "  ";
                                        }
                                        //console.log(indent, "getCategories("+level+"): START");
                                        try {
                                            var categories = [];
                                            if (rows == null) {
                                                console.log(indent, "getCategories(" + level + "): getting initial categories");
                                                rows = $('#categoryListing table.categoryListingTable > tbody > tr > td > table > tbody > tr');
                                            }
                                            var category = null;
                                            rows.each(function (index, row) {
                                                var rowId = $(this).attr("id");
                                                var isCategory = S(rowId).startsWith('rowDnD');
                                                var isSubCategory = S(rowId).startsWith('subcat');

                                                if (isCategory) {
                                                    var link = $(this).find("a.navigationNormal");
                                                    var name = link.html().trim();
                                                    var href = link.attr('href');
                                                    var id = -1;
                                                    var match;
                                                    if (match = href.match(/product-category.detail\?action=edit&categoryId=([0-9]+)/)) {
                                                        id = parseInt(match[1]);
                                                    }

                                                    var rank = $(this).find('> td > table > tbody > tr > td:nth-child(4) > input').val();
                                                    var onHold = $(this).find('> td > table > tbody > tr > td:nth-child(6) > input').attr('checked');
                                                    var showInMenu = $(this).find('> td > table > tbody > tr > td:nth-child(8) > input').attr('checked');
                                                    var searchable = $(this).find('> td > table > tbody > tr > td:nth-child(10) > input').attr('checked');

                                                    category = {
                                                        _id: id,
                                                        rank: rank,
                                                        onHold: onHold,
                                                        showInMenu: showInMenu,
                                                        searchable: searchable
                                                    };

                                                    if (LANGUAGE == "en_US") {
                                                        category["name"]= name;
                                                    } else {
                                                        category["name_es_US"]= name;
                                                    }

                                                    categories.push(category);
                                                    console.log(indent, "getCategories(" + level + "): category found:", name, id, rank, onHold, showInMenu, searchable);
                                                } else if (isSubCategory && category != null) {
                                                    //console.log(indent, "getCategories("+level+"): getting children categories");
                                                    // we have a sub-category
                                                    var childRows = $(this).find("> td > div > table > tbody > tr");
                                                    //console.log("childRows", childRows.length);

                                                    var children = getCategories(childRows, level + 1);

                                                    // save the parent category id into the children
                                                    for (var i = 0; i < children.length; i++) {
                                                        children[i].parent = category._id;
                                                    }
                                                    category.children = children;
                                                    category = null;
                                                }
                                            });
                                            //console.log(indent, "getCategories("+level+"): END");
                                            return categories;
                                        } catch (ex) {
                                            console.error(indent, "getCategories(" + level + "): error getting category", JSON.stringify(ex));
                                        }
                                    }
                                    return getCategories();
                                }, LANGUAGE);

                                console.log("got categories");
                                for (var i = 0; i < categories.length; i++) {
                                    var category = categories[i];

                                    // get more category details
                                    fetchCategoryDetail(category);

                                    // save
                                    saveCategory(categories[i]);
                                }
                            });
                        }
                    });

                    function fetchCategoryDetail(category) {
                        var categoryId = category._id;
                        var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product-category.detail?action=edit&categoryId=" + categoryId;

                        console.log("[summary] Loading category detail", u);

                        casper.thenOpen(u, function (response) {
                            if (response.status !== 200) {
                                console.error('Unable to get category detail page!');
                                this.exit();
                            } else {
                                console.log('Got category detail page');

                                // get details
                                var detail = casper.evaluate(function (LANGUAGE) {
                                    try {
                                        var detail = {};
                                        detail.startDate = new Date(moment($('input[name="category.startDate"]').val(), 'MM/DD/YYYY').unix() * 1000);
                                        detail.endDate = new Date(moment($('input[name="category.endDate"]').val(), 'MM/DD/YYYY').unix() * 1000);

                                        // description
                                        detail.description = $('textarea[name="categoryLocale.' + LANGUAGE + '.description"]').html();
                                        console.log('Got category description', detail.description);

                                        // customer type
                                        detail.customerTypes = [];
                                        if ($('input[name="customerType1"]').attr('checked')) {
                                            detail.customerTypes.push("Non-Party Customer");
                                        }
                                        if ($('input[name="customerType2"]').attr('checked')) {
                                            detail.customerTypes.push("Consultant");
                                        }
                                        if ($('input[name="customerType4"]').attr('checked')) {
                                            detail.customerTypes.push("Employee");
                                        }
                                        if ($('input[name="customerType5"]').attr('checked')) {
                                            detail.customerTypes.push("Party Guest");
                                        }
                                        if ($('input[name="customerType6"]').attr('checked')) {
                                            detail.customerTypes.push("Hostess");
                                        }
                                        if ($('input[name="customerType7"]').attr('checked')) {
                                            detail.customerTypes.push("Fundraiser");
                                        }
                                        if ($('input[name="customerType8"]').attr('checked')) {
                                            detail.customerTypes.push("Department");
                                        }
                                        return detail;
                                    } catch (ex) {
                                        console.error("error parsing category detail page", JSON.stringify(ex));
                                    }
                                }, LANGUAGE);
                                category.startDate = detail.startDate;
                                category.endDate = detail.endDate;
                                category.customerTypes = detail.customerTypes;

                                // get any images
                                casper.waitUntilVisible('#gridImages .x-grid3-scroller table tr div.x-grid3-cell-inner.x-grid3-col-4 a', function(LANGUAGE) {
                                    console.log('[summary] category image DOM loaded');

                                    var images = casper.evaluate(function (LANGUAGE) {
                                        try {
                                            // images
                                            var images = [];

                                            console.log('[summary] Got image count', $("#gridImages .x-grid3-scroller table tr").length);

                                            $("#gridImages .x-grid3-scroller table tr").each(function () {
                                                try {
                                                    var image = {};
                                                    image.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                                    image.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html(), 'MM/DD/YYYY').unix() * 1000);
                                                    image.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html(), 'MM/DD/YYYY').unix() * 1000);
                                                    image.imagePath = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4 a').attr("href");
                                                    image.alt = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                                    images.push(image);
                                                    console.log('[summary] Got image', JSON.stringify(image));
                                                } catch (ex) {
                                                    console.error('error parsing category image', JSON.stringify(ex));
                                                }
                                            });

                                            return images;
                                        } catch (ex) {
                                            console.error("error parsing category detail images", JSON.stringify(ex));
                                        }
                                    }, LANGUAGE);

                                    console.log('[summary] Got category images', JSON.stringify(images));

                                    category.images = images;
                                }, function() {
                                    console.log('[summary] No category images');
                                }, 3000);
                            }
                        });

                        if (visitedCategories[categoryId]==null) {
                            casper.then(function () {
                                // handle parent, if any
                                if (category.children) {
                                    var ids = [];
                                    for (var i = 0; i < category.children.length; i++) {
                                        var child = category.children[i];
                                        fetchCategoryDetail(child);
                                    }
                                }
                            });
                        } else {
                            console.log("[summary] Already fetched category details", categoryId);
                        }
                    }

                    function saveCategory(category) {
                        casper.then(function () {
                            // handle parent, if any
                            if (category.children) {
                                var ids = [];
                                for (var i = 0; i < category.children.length; i++) {
                                    var child = category.children[i];
                                    // save the child
                                    saveCategory(child);

                                    // add it's ID to the ID list
                                    ids.push(child._id);
                                }

                                // replace the categories children with a list of IDs for MongoDB
                                category.children = ids;
                            }

                            var json = JSON.stringify(category);
                            console.log("====== Category ======");
                            console.log(json);
                            console.log("=====================");

                            this.emit('category.save', json);
                        });
                    }

                } catch (ex) {
                    console.error("problem with categories", JSON.stringify(ex));
                }
            }]);
        }

        // PRODUCTS & KITS
        spooky.then([{
            existingProductTypes: existingProductTypes,
            existingProductPromotionalMessages: existingProductPromotionalMessages,
            existingProductUpsellItems: existingProductUpsellItems,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            TEMP_UNAVAILABLE_ONLY: TEMP_UNAVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL,
            LANGUAGE: LANGUAGE,
            BASIC: BASIC,
            IMAGES_ONLY: IMAGES_ONLY,
            options: options
        }, function () {
            console.log("[summary] == PRODUCTS ==");

            // casperjs context here
            var casper = this;

            casper.onResourceError = function(resourceError) {
                console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
            };

            // map of all products
            var productMap = {};
            var newProducts = [];
            var updateProducts = [];
            var unavailableProducts = [];
            var tempUnavailableProducts = [];

            // PRODUCT LISTING
            function getProductListing(pageNum, kits, productSku) {
                if (pageNum == null) {
                    pageNum = 1;
                }
                console.log('[summary] getProductListing(', pageNum, ",", kits, ",", productSku, ")");

                // GET PRODUCT LISTING
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(kits?'kit':'')+".listing?currentPage=" + pageNum;
                if (productSku == null) {
                    u += "&_changePage=Y&searchById=8";
                } else {
                    u += "&searchById=1&sku=" + productSku + "&marketingName=";
                }

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log("Loading product "+(kits?'kit':'')+" listing page", pageNum, u);
                });

                casper.thenOpen(u, function(response) {
                    if (response.status !== 200) {
                        console.error("Unable to get product "+(kits?'kit':'')+" listing page!");
                        this.exit();
                    } else {
                        if (productSku) {
                            console.log('Got product listing page', pageNum, "for product id", productSku);
                        } else {
                            console.log('Got product listing page', pageNum);
                        }

                        casper.waitUntilVisible('#gridProducts .x-grid3-scroller table tbody tr', function() {
                            try {
                                if (productSku) {
                                    console.log("Evaluating product "+(kits?'kit':'')+" listing page", pageNum, "for product id", productSku);
                                } else {
                                    console.log("Evaluating product "+(kits?'kit':'')+" listing page", pageNum);
                                }

                                var products = casper.evaluate(function(productSku) {
                                    try {
                                        var productRe = /<a href="product(kit)?\.detail\?productId=([^"]+)">([^<]+)<\/a>/;
                                        var products = [];
                                        var match;
                                        $("#gridProducts .x-grid3-scroller table tbody tr").each(function(index, row) {
                                            //console.log("processing product row");
                                            var product = {};
                                            var c = $(this).find("div.x-grid3-cell-inner.x-grid3-col-status").html();
                                            if (c.match(/\/available.gif/)) {
                                                //console.log("available");
                                                product.status = "A";
                                            } else if (c.match(/\/temp-unavailable.gif/)) {
                                                product.status = "T";
                                            } else {
                                                //console.log("unavailable");
                                                product.status = "I";
                                            }
                                            var c2 = $(this).find("div.x-grid3-cell-inner.x-grid3-col-3").html();
                                            if (match = productRe.exec(c2)) {
                                                product.id = match[2];
                                                product.sku = match[3];

                                                if (productSku) {
                                                    if (product.sku != productSku) {
                                                        console.log("product id doesn't match expected, skipping", product.sku, "!=", productSku);
                                                    } else {
                                                        console.log("found product", productSku);
                                                        products.push(product);
                                                    }
                                                } else {
                                                    console.log("found product", product.sku);
                                                    products.push(product);
                                                }

                                            } else {
                                                console.error("failed to parse product line");
                                            }
                                        });
                                        //console.log("returning products", JSON.stringify(products));
                                        return products;
                                    } catch (ex) {
                                        console.error("error parsing product "+(kits?'kit':'')+" listing page", JSON.stringify(ex));
                                    }
                                }, productSku);

                                if (productSku && products.length == 0) {
                                    console.warn("unable to find product page listing for", productSku);
                                }

                                for (var i=0; i < products.length; i++) {
                                    var product = products[i];
                                    //console.log("found product page", JSON.stringify(product));

                                    if ((AVAILABLE_ONLY == false && TEMP_UNAVAILABLE_ONLY == false) || // everything included
                                        (TEMP_UNAVAILABLE_ONLY == false && product.status == "A") ||   // avail && not just fetching temp unavail
                                        (TEMP_UNAVAILABLE_ONLY == true && product.status == "T"))      // temp unavail && product is temp unavail
                                    {
                                        // add to the list to be fetched if new
                                        if (existingProductTypes[product.sku]) {
                                            console.log("[summary] found updated product" + (kits ? ' kit' : ''), product.sku);
                                            updateProducts.push({
                                                id: product.id,
                                                sku: product.sku,
                                                isKit: kits
                                            });
                                            // else add to the list to be updated later
                                        } else {
                                            console.log("[summary] found new product" + (kits ? ' kit' : ''), product.sku);
                                            newProducts.push({
                                                id: product.id,
                                                sku: product.sku,
                                                isKit: kits
                                            });
                                        }
                                    } else {
                                        console.log("skipping unavailable product"+(kits?' kit':''), JSON.stringify(product));
                                        // mark it as unavailable in the database too, since we now know it's unavailable
                                        if (existingProductTypes[product.sku]) {
                                            if (product.status == "I") {
                                                unavailableProducts.push(product.sku);
                                            } else if (product.status == "T") {
                                                tempUnavailableProducts.push(product.sku);
                                            }
                                        }
                                    }
                                }

                                var content = casper.evaluate(function() {
                                    return document.all[0].outerHTML;
                                });

                                var nextPage = pageNum + 1;
                                var find = "pageChange\\("+nextPage+", true\\)";
                                //console.log("searching for next page using", find);

                                // continue if we have more pages, else we're done
                                if (productSku == null && content.match(new RegExp(find))) {
                                    // uncomment to enable multiple product page scraping
                                    // we have another page
                                    console.log("[summary] have another page, fetching");
                                    getProductListing(nextPage, kits);
                                } else if (productSku != null) {
                                    console.log("[summary] fetch by product ID complete");
                                } else {
                                    console.log("[summary] last page was", pageNum);
                                }
                            } catch (ex) {
                                console.error("error evaluating product listing", pageNum, JSON.stringify(ex));
                            }
                        }, function() {
                            console.error("timed out waiting to get product listing");
                            if (!options["products"]) {
                                this.exit();
                            }
                            // else just move along, since this is a product page that may have nothing on it
                        });
                    }
                });
            }

            if (!options["skipProducts"] && !options["products"]) {
                console.log("getting product listing");
                // get regular products
                getProductListing(1, false);
            }

            if (!options["skipKits"] && !options["products"]) {
                console.log("getting product kit listing");
                // get kits
                getProductListing(1, true);
            }

            if (options["products"]) {
                console.log("getting listings for specific product");

                for (var i=0; i < options["products"].length; i++) {
                    var sku = options["products"][i];
                    console.log("getting listings for product", sku, "known type?", existingProductTypes[sku]);

                    // try to fetch this product as both a product / kit
                    if (existingProductTypes[sku] == "kit") {
                        getProductListing(1, true, sku);
                    } else if (existingProductTypes[sku] == "product") {
                        getProductListing(1, false, sku);
                    } else {
                        // not sure, so just try both
                        getProductListing(1, false, sku);
                        getProductListing(1, true, sku);
                    }
                }
            }

            casper.then(function() {
                console.log("got all products & kits, get product listings");

                // if fetching images only, we can only fetch existing products, not new ones since
                // we don't have a record to associate the images with
                var allProducts = IMAGES_ONLY ? updateProducts : newProducts.concat(updateProducts);
                for (var i=0; i < allProducts.length; i++) {
                    var product = allProducts[i];
                    productMap[product.id] = product;
                    //console.log("have product", product.id, JSON.stringify(product));
                }

                // go through the products and fetch product/kit details
                processAllProducts(allProducts);

                // mark all unavailable products as unavailable
                for (var i=0; i < unavailableProducts.length; i++) {
                    this.emit('product.markUnavailable', unavailableProducts[i]);
                    if (unavailableProducts[i].type == 'kit') {
                        this.emit('productKit.skip', unavailableProducts[i]);
                    } else {
                        this.emit('product.skip', unavailableProducts[i]);
                    }
                }
            });

            function processAllProducts(products) {
                console.log("processNextProduct()");

                for (var i=0; i < products.length; i++) {
                    try {
                        var item = products[i];
                        var productId = item.id;
                        var sku = item.sku;
                        var isKit = item.isKit;

                        console.log("queueing up product for processing", JSON.stringify(item));
                        casper.then(function() {
                            console.log('[summary] processing product', productId, 'sku', sku, 'isKit', isKit);
                        });

                        if (IMAGES_ONLY) {
                            fetchProductImages(productId, sku, isKit);
                        } else {
                            fetchProductDetail(productId, sku, isKit);
                            fetchProductPromotionalMessages(productId, sku, isKit);
                            fetchProductIngredients(productId, sku, isKit);
                            fetchProductUsage(productId, sku, isKit);
                            fetchProductUpsellItems(productId, sku, isKit);

                            // we only do this for english, spanish is just for fetching the text
                            if (LANGUAGE == "en_US" && !BASIC) {
                                fetchProductImages(productId, sku, isKit);
                                fetchProductPrices(productId, sku, isKit);
                                fetchProductCategories(productId, sku, isKit);
                                fetchProductYouMayAlsoLike(productId, sku, isKit);
                                fetchProductSharedAssets(productId, sku, isKit);

                                // only for kits
                                if (isKit) {
                                    fetchProductComponents(productId, sku);
                                }
                            }
                        }

                        saveProduct(productId, sku);
                    } catch (ex) {
                        console.error("error processing product", productId, JSON.stringify(ex));
                    }
                }
            }

            function saveProduct(productId, sku) {
                console.log("[summary] saveProduct", sku);
                this.emit('product.process', sku);
                casper.then(function() {
                    var json = JSON.stringify(productMap[productId]);
                    console.log("====== Product ======");
                    console.log(json);
                    console.log("=====================");

                    this.emit('product.save', json);
                });
            }

            function fetchProductDetail(productId, sku, isKit) {
                if (isKit == null) {
                    isKit = false;
                }

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".detail?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product detail', productId, 'sku', sku, 'isKit', isKit);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product detail page!', productId, 'sku', sku);
                    } else {
                        try {
                            console.log('Got product detail page', productId, sku, isKit);
                            casper.waitUntilVisible('input[name=formalName_'+LANGUAGE+']', function() {
                                console.log("DOM available");
                                var p = productMap[productId];

                                var product = casper.evaluate(function(LANGUAGE) {
                                    try {
                                        var product = {};
                                        var description = $('iframe[name=ext-gen49]').contents().find("body").html();
                                        if (LANGUAGE == "en_US") {
                                            product.name = $('input[name=formalName_en_US]').val();
                                            product.quantity = $('input[name=sellingQty_en_US]').val();
                                            product.description = description;
                                        } else {
                                            product.name_es_US = $('input[name=formalName_es_US]').val();
                                            product.quantity_es_US = $('input[name=sellingQty_es_US]').val();
                                            product.description_es_US = description;
                                        }
                                        product.onHold = $('input[name="onHold"]').attr('checked') || false;
                                        product.searchable = $('input[name="searchable"]').attr('checked') || false;
                                        product.masterStatus = $('select[name="status"] > option:selected').val();
                                        product.masterType = $('select[name="type"] > option:selected').val() || 0;
                                        product.taxCode = $('select[name="taxCode"] > option:selected').val() || 0;
                                        product.standardCost = parseFloat($('input[name="standardCost"]').val()) || 0;
                                        product.hazmatClass  = $('select[name="hazmat"] > option:selected').val() || 0;
                                        product.productClass = parseInt($('input[name="classId"] > option:selected').val()) || 0;
                                        return product;
                                    } catch (ex) {
                                        console.error("error parsing product", JSON.stringify(ex));
                                    }
                                }, LANGUAGE);
                                product.type = isKit ? "kit" : "product";
                                product._id = sku;

                                if (p) {
                                    // copy over existing
                                    p.type = product.type;
                                    if (LANGUAGE == "en_US") {
                                        p.name = product.name;
                                        p.quantity = product.quantity;
                                        p.description = product.description;
                                    } else {
                                        p.name_es_US = product.name_es_US;
                                        p.quantity_es_US = product.quantity_es_US;
                                        p.description_es_US = product.description_es_US;
                                    }
                                    p.onHold = product.onHold;
                                    p.searchable = product.searchable;
                                    p.masterStatus = product.masterStatus;
                                    p.masterType = product.masterType;
                                    p.taxCode = product.taxCode;
                                    p.standardCost = product.standardCost;
                                    p.hazmatClass = product.hazmatClass;
                                    p.productClass = product.productClass;
                                    console.log("Product:", JSON.stringify(p));
                                } else {
                                    // new product
                                    productMap[productId] = product;
                                    console.log("Product:", JSON.stringify(product));
                                }
                            }, function() {
                                console.error("timed out waiting on product detail");
                                this.exit();
                            });
                        } catch (ex) {
                            console.error("error parsing product details", JSON.stringify(ex));
                        }
                    }
                });
            }

            function fetchProductPromotionalMessages(productId, sku, isKit) {
                if (isKit == null) {
                    isKit = false;
                }

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".promomessages?productId=" + productId;
                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product promotional messages', productId, 'sku', sku, 'isKit', isKit);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product promotionalMessages page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product promotionalMessages page', productId, 'sku', sku);

                        casper.waitUntilVisible('#grid-promomessages', function() {
                            var product = productMap[productId];

                            if (product == null) {
                                console.error("fetchProductPromotionalMessages(): couldn't find product", productId, 'sku', sku, "is null");
                                return;
                            }

                            var promotionalMessages = casper.evaluate(function() {
                                try {
                                    var promotionalMessages = [];

                                    $("#grid-promomessages .x-grid3-scroller table tr").each(function() {
                                        try {
                                            var message = {};
                                            message.message = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                            message.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html()).unix()*1000);
                                            message.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html()).unix()*1000);
                                            promotionalMessages.push(message);
                                            console.log('Got message', JSON.stringify(message));
                                        } catch (ex) {
                                            console.error('error parsing product promotionalMessage', JSON.stringify(ex));
                                        }
                                    });

                                    return promotionalMessages;
                                } catch (ex) {
                                    console.error('error processing promotionalMessages', JSON.stringify(ex));
                                }
                            });

                            // create array of messages to keep & update as needed
                            var savedMessages = [];
                            var existingPromotionalMessages = existingProductPromotionalMessages[sku];

                            if (existingPromotionalMessages) {
                                console.log("have promo messages", existingPromotionalMessages);
                                for (var i=0; i < existingPromotionalMessages.length; i++) {
                                    var p = existingPromotionalMessages[i];
                                    console.log("have orig message", JSON.stringify(p));

                                    var index = -1;
                                    for (var j=0; j < promotionalMessages.length; j++) {
                                        var m = promotionalMessages[j];
                                        console.log("found existing", p.startDate, m.startDate, p.endDate, m.endDate);
                                        if (p.startDate == m.startDate && p.endDate == m.endDate) {
                                            console.log("found existing promo message to update");
                                            index = j;
                                            break;
                                        }
                                    }

                                    if (index >= 0) {
                                        var m = promotionalMessages[index];
                                        console.log("using new message to update", JSON.stringify(m));

                                        // remove this items from the new messages list
                                        promotionalMessages.splice(index, 1);

                                        // copy over message based on language
                                        if (LANGUAGE == "en_US") {
                                            p.message = m.message ? m.message : p.message;
                                        } else {
                                            p.message_es_US = m.message ? m.message : p.message;
                                        }

                                        console.log("saving updated message", JSON.stringify(p));
                                        savedMessages.push(p);
                                    } else {
                                        console.log("keeping old message", JSON.stringify(p));
                                        savedMessages.push(p);
                                    }
                                }
                            }

                            // add all remaining messages as new

                            console.log("saving new messages");

                            for (var i=0; i < promotionalMessages.length; i++) {
                                var m = promotionalMessages[i];
                                var p = {};

                                // add to the list
                                if (LANGUAGE == "en_US") {
                                    p = {
                                        message: m.message,
                                        startDate: m.startDate,
                                        endDate: m.endDate
                                    };
                                } else {
                                    p = {
                                        message_es_US: m.message,
                                        startDate: m.startDate,
                                        endDate: m.endDate
                                    };
                                }

                                console.log("saving new message", JSON.stringify(p));
                                savedMessages.push(p);
                            }

                            product.promotionalMessages = savedMessages;

                            //console.log("Product:", JSON.stringify(product));
                        }, function() {
                            console.error("timed out waiting on product promotionalMessages");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductImages(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".images?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product images', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product images page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product images page', productId, 'sku', sku);

                        casper.waitUntilVisible('#gridImages', function() {
                            var product = productMap[productId];

                            console.log('Using current product', JSON.stringify(product));

                            product.images = casper.evaluate(function() {
                                try {
                                    var images = [];

                                    $("#gridImages .x-grid3-scroller table tr").each(function() {
                                        try {
                                            var image = {};
                                            image.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            image.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html(), 'MM/DD/YYYY').unix()*1000);
                                            image.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html(), 'MM/DD/YYYY').unix()*1000);
                                            image.imagePath = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4 a').attr("href");
                                            image.alt = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                            images.push(image);
                                            console.log('Got image', JSON.stringify(image));
                                        } catch (ex) {
                                            console.error('error parsing product image', JSON.stringify(ex));
                                        }
                                    });

                                    return images;
                                } catch (ex) {
                                    console.error('error processing images', JSON.stringify(ex));
                                }
                            });
                            //console.log("Product:", JSON.stringify(product));
                        }, function() {
                            console.error("timed out waiting to on product images");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductIngredients(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".features?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product ingredients', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product ingredients page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product ingredients page', productId, 'sku', sku);

                        casper.waitUntilVisible('iframe', function() {
                            var product = productMap[productId];

                            var ingredients = casper.evaluate(function() {
                                try {
                                    return $('iframe').contents().find("body").html();
                                } catch (ex) {
                                    console.error("error while parsing product ingredients", JSON.stringify(ex));
                                }
                            });
                            if (LANGUAGE == "en_US") {
                                product.ingredients = ingredients;
                            } else {
                                product.ingredients_es_US = ingredients;
                            }
                            console.log("Ingredients:", ingredients);
                        }, function() {
                            console.error("timed out waiting to get product ingredients");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductUsage(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".usage?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product usage', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product usage page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product usage page', productId, 'sku', sku);

                        casper.waitUntilVisible('iframe', function() {
                            var product = productMap[productId];

                            var usage = casper.evaluate(function() {
                                try {
                                    return $('iframe').contents().find("body").html();
                                } catch (ex) {
                                    console.error("error while parsing product usage", JSON.stringify(ex));
                                }
                            });
                            if (LANGUAGE == "en_US") {
                                product.usage = usage;
                            } else {
                                product.usage_es_US = usage;
                            }
                            console.log("Usage:", usage);
                        }, function() {
                            console.error("timed out waiting to get product usage");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductPrices(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".prices?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product prices', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product prices page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product prices page', productId, 'sku', sku);

                        casper.waitUntilVisible('#grid-prices .x-grid3-scroller', function() {
                            var product = productMap[productId];
                            product.prices = [];

                            var linkCount = casper.evaluate(function() {
                                console.log("getting link list");
                                try {
                                    return $('#grid-prices .x-grid3-scroller table tr td div.x-grid3-cell-inner.x-grid3-col-priceId a').length;
                                } catch (ex) {
                                    console.error("error while getting price link count", JSON.stringify(ex));
                                }
                            }) || 0;

                            console.log("link count", linkCount);

                            for (var i=0; i < linkCount; i++) {
                                console.log("processing link", i);
                                var priceId = casper.evaluate(function(i) {
                                    try {
                                        console.log("getting link", i);
                                        var link = $('#grid-prices .x-grid3-scroller table tr td div.x-grid3-cell-inner.x-grid3-col-priceId a')[i];
                                        console.log("got link", link.href);
                                        var match;

                                        if (match = link.href.match(/detailPrice\(([0-9]+)\)/)) {
                                            var priceId = match[1];
                                            //console.log("showing price", priceId);
                                            //detailPrice(priceId);
                                            return priceId;
                                        }
                                    } catch (ex) {
                                        console.error("error parsing price link", JSON.stringify(ex));
                                    }
                                }, i);

                                var uu = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".price.detail?productId=" + productId + "&priceId=" + priceId;
                                //console.log("fetching price detail page", uu);

                                // pause to not slam the sever
                                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                                casper.then(function() {
                                    console.log('Getting product prices', productId, 'sku', sku);
                                });

                                casper.thenOpen(uu, function (response) {
                                    if (response.status !== 200) {
                                        console.error('Unable to get product price detail page!', productId, 'sku', sku, priceId);
                                    } else {
                                        console.log('Got product price detail page', productId, 'sku', sku, priceId);
                                    }

                                    var price = casper.evaluate(function() {
                                        try {
                                            var p = {};
                                            p.price = parseFloat($('input[name="productPrice.price"]').val());
                                            p.typeId = parseInt($('select[name="productPrice.productPriceTypeId"] > option:selected').val()) || 0;
                                            p.commissionableVolume = parseFloat($('input[name="productPrice.commissionablePrice"]').val());
                                            p.qualifyingVolume = parseFloat($('input[name="productPrice.businessVolume"]').val());
                                            p.retailVolume = parseFloat($('input[name="productPrice.retailVolume"]').val());
                                            p.instantProfit = parseFloat($('input[name="productPrice.instantProfit"]').val());
                                            p.rebate = parseFloat($('input[name="productPrice.rebate"]').val());
                                            p.shippingSurcharge = parseFloat($('input[name="productPrice.shippingSurcharge"]').val());
                                            p.effectiveStartDate = new Date(moment($('input[name="productPrice.startDate"]').val(), 'MM/DD/YYYY').unix()*1000);
                                            p.effectiveEndDate = new Date(moment($('input[name="productPrice.endDate"]').val(), 'MM/DD/YYYY').unix()*1000);

                                            p.customerTypes = [];
                                            if ($('input[name="customerTypes.itemMapped[0].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Non-Party Customer");
                                            }
                                            if ($('input[name="customerTypes.itemMapped[1].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Consultant");
                                            }
                                            if ($('input[name="customerTypes.itemMapped[2].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Employee");
                                            }
                                            if ($('input[name="customerTypes.itemMapped[3].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Party Guest");
                                            }
                                            if ($('input[name="customerTypes.itemMapped[4].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Hostess");
                                            }
                                            if ($('input[name="customerTypes.itemMapped[5].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Fundraiser");
                                            }
                                            if ($('input[name="customerTypes.itemMapped[6].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Department");
                                            }

                                            return p;
                                        } catch (ex) {
                                            console.error("error parsing price modal", JSON.stringify(ex));
                                            this.capture('error_price_detail_'+productId+'_'+priceId+'.jpg', undefined, {
                                                format: 'jpg',
                                                quality: 100
                                            });
                                            console.error("failed to load modal in time");

                                        }
                                    });
                                    product.prices.push(price);
                                });
                            }

                            casper.then(function() {
                                console.log("product", productId, 'sku', sku, "prices", JSON.stringify(product.prices));
                            });

                        }, function() {
                            console.error("timed out waiting to get product prices");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductCategories(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".categories?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product categories', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product categories page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product categories page', productId, 'sku', sku);

                        casper.waitUntilVisible('#grid-categories .x-grid3-scroller', function() {
                            var product = productMap[productId];

                            product.categories = casper.evaluate(function() {
                                try {
                                    var categories = [];
                                    $('#grid-categories .x-grid3-scroller table tr').each(function(index, row) {
                                        var href = $(this).find('.x-grid3-cell-inner.x-grid3-col-catId a').attr('href');
                                        var match;
                                        if (match = href.match(/removeCategory\(([0-9]+)\)/)) {
                                            categories.push(parseInt(match[1]));
                                        }
                                    });
                                    return categories;
                                } catch (ex) {
                                    console.error("error while parsing product categories");
                                }
                            });
                            console.log("Categories:", JSON.stringify(product.categories));
                        }, function() {
                            console.error("timed out waiting to get product categories");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductUpsellItems(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".upsellitems?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product upsellItems', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product upsellItems page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product upsellItems page', productId, 'sku', sku);

                        casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function() {
                            var product = productMap[productId];

                            var upsellItems = casper.evaluate(function(LANGUAGE) {
                                try {
                                    var upsellItems = [];
                                    $('#simpleGrid .x-grid3-scroller table tr').each(function(index, row) {
                                        var item = {};
                                        item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        if (LANGUAGE == "en_US") {
                                            item.marketingText = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                        } else {
                                            item.marketingText_es_US = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                        }
                                        // for now, all upsell items are products with sub-types: product/kit/group
                                        item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                        item.productId = item.product;

                                        upsellItems.push(item);
                                    });
                                    return upsellItems;
                                } catch (ex) {
                                    console.error("error while parsing product upsellItems");
                                }
                            }, LANGUAGE);

                            var existingUpsellItems = existingProductUpsellItems[sku];
                            var newUpsellItems = [];

                            if (existingUpsellItems && existingUpsellItems.length > 0) {
                                console.log("[summary] existing upsell items for product", productId, 'sku', sku);
                                for (var i=0; i < existingUpsellItems.length; i++) {
                                    var p = existingUpsellItems[i];

                                    var index = -1;

                                    for (var j=0; j < upsellItems.length; j++) {
                                        var m = upsellItems[j];
                                        if (p.productId = m.productId) {
                                            console.log("[summary] found existing upsell item to update");
                                            index = j;
                                            break;
                                        }
                                    }

                                    if (index >= 0) {
                                        var m = upsellItems[index];
                                        console.log("[summary] using new upsellItem to update", JSON.stringify(m));

                                        // remove this items from the new upsellItems list
                                        upsellItems.splice(index, 1);

                                        // copy over upsellItem based on language
                                        p.marketingText = m.marketingText ? m.marketingText : p.marketingText;
                                        p.marketingText_es_US = m.marketingText_es_US ? m.marketingText_es_US : p.marketingText_es_US;

                                        console.log("[summary] saving updated upsellItem", JSON.stringify(p));
                                        newUpsellItems.push(p);
                                    } else {
                                        console.log("[summary] keeping old upsellItem", JSON.stringify(p));
                                        newUpsellItems.push(p);
                                    }
                                }
                            } else {
                                console.log("[summary] no existing upsell items", productId, 'sku', sku);
                            }

                            console.log("[summary] saving new upsell items", JSON.stringify(upsellItems));

                            for (var i=0; i < upsellItems.length; i++) {
                                var m = upsellItems[i];

                                console.log("[summary] saving new upsellItem", JSON.stringify(m));
                                newUpsellItems.push(m);
                            }

                            product.upsellItems = newUpsellItems;

                            console.log("Upsell Items:", JSON.stringify(product.upsellItems));
                        }, function() {
                            console.error("timed out waiting to get product upsell items");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductYouMayAlsoLike(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".coordinatingitems?productId=" + productId + "&formType=ymal";

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product youMayAlsoLike', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product youMayAlsoLike page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product youMayAlsoLike page', productId, 'sku', sku);

                        casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function() {
                            console.log('youMayAlsoLike loaded');
                            try {
                                var product = productMap[productId];

                                product.youMayAlsoLike = casper.evaluate(function() {
                                    try {
                                        var youMayAlsoLike = [];
                                        $('#simpleGrid .x-grid3-scroller table tr').each(function(index, row) {
                                            var item = {};
                                            item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            // for now, all YMAL items are products with sub-types: product/kit/group
                                            item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                            item.productId = item.product;

                                            youMayAlsoLike.push(item);
                                        });
                                        return youMayAlsoLike;
                                    } catch (ex) {
                                        console.error("error while parsing product youMayAlsoLike");
                                    }
                                });
                                console.log("You May Also Like Items:", JSON.stringify(product.youMayAlsoLike));
                            } catch (ex) {
                                console.error("error processing you may also like item", JSON.stringify(ex));
                            }
                        }, function() {
                            console.error("timed out waiting to get youMayAlsoLike items");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductSharedAssets(productId, sku, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".attributes?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product sharedAssets', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product sharedAssets page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product sharedAssets page', productId, 'sku', sku);

                        casper.waitUntilVisible('#gridAccessories .x-grid3-scroller', function() {
                            var product = productMap[productId];

                            product.sharedAssets = casper.evaluate(function() {
                                try {
                                    var sharedAssets = [];
                                    $('#gridAccessories .x-grid3-scroller table tr').each(function(index, row) {
                                        var item = {};
                                        var link = $(this).find('div.x-grid3-cell-inner.x-grid3-col-0 a');
                                        var match;
                                        if (match = link.attr('href').match(/deleteAsset\(([0-9]+)\)/)) {
                                            item._id = parseInt(match[1]);
                                        }
                                        item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        item.systemRef = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                        item.title = $(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html();
                                        item.description = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html();
                                        item.marketingText = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                        item.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-6').html(), 'MM/DD/YYYY').unix()*1000);
                                        item.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-7').html(), 'MM/DD/YYYY').unix()*1000);
                                        sharedAssets.push(item);
                                    });
                                    return sharedAssets;
                                } catch (ex) {
                                    console.error("error processing shared asset item", JSON.stringify(ex));
                                }
                            });
                            console.log("Shared Assets:", JSON.stringify(product.sharedAssets));
                        }, function() {
                            console.error("timed out waiting to get product shared assets");
                            //this.exit();
                        });
                    }
                });
            }

            // contained products / kit groups, this is for product kits only
            function fetchProductComponents(productId, sku) {
                var u =  BASE_SITE_URL + "/csr-admin-4/productcatalog/productkit.components?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('[summary] Getting product components', productId, 'sku', sku);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product components page!', productId, 'sku', sku);
                    } else {
                        console.log('Got product components page', productId, 'sku', sku);

                        casper.waitUntilVisible('#secondGrid .x-grid3-scroller', function() {
                            console.log('components loaded');
                            try {
                                var product = productMap[productId];

                                var ret = casper.evaluate(function() {
                                    try {
                                        var contains = [];
                                        var kitGroups = [];
                                        $('#secondGrid .x-grid3-scroller table tr').each(function(index, row) {
                                            var item = {};
                                            item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-0').html());
                                            item.quantity = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            if (item.quantity == null || isNaN(item.quantity)) {
                                                item.quantity = 1;
                                            }
                                            item.type = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html();

                                            var startDateString = $(this).find('div.x-grid3-cell-inner.x-grid3-col-6').html();
                                            var endDateString = $(this).find('div.x-grid3-cell-inner.x-grid3-col-7').html();
                                            //console.log("startDateString", startDateString);
                                            //console.log("endDateString", endDateString);

                                            item.startDate = new Date(moment(startDateString, 'MM/DD/YYYY').unix()*1000);
                                            item.endDate = new Date(moment(endDateString, 'MM/DD/YYYY').unix()*1000);

                                            //console.log("startDate", item.startDate);
                                            //console.log("endDate", item.endDate);

                                            // save this component as either a contained product or a kit group
                                            var id = $(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html();
                                            if (item.type == 'kitGroup') {
                                                item.kitGroup = id;
                                                item.kitGroupId = id;
                                                kitGroups.push(item);
                                            } else {
                                                item.product = id;
                                                item.productId = id;
                                                contains.push(item);
                                            }
                                        });
                                        return {
                                            contains: contains,
                                            kitGroups: kitGroups
                                        };
                                    } catch (ex) {
                                        console.error("error while parsing product components");
                                    }
                                });
                                product.contains = ret.contains;
                                product.kitGroups = ret.kitGroups;

                                console.log("Contains/Kit Group Items:", JSON.stringify(ret));
                            } catch (ex) {
                                console.error("error processing components", JSON.stringify(ex));
                            }
                        }, function() {
                            console.error("timed out waiting to get product components");
                            //this.exit();
                        });
                    }
                });
            }

            casper.then(function() {
                //console.log("found products", JSON.stringify(products));
            });
        }]);

        // PRODUCT GROUPS
        if (!options["skipGroups"] && !options["products"]) {
            spooky.then([{
                existingProductTypes: existingProductTypes,
                existingProductPromotionalMessages: existingProductPromotionalMessages,
                existingProductUpsellItems: existingProductUpsellItems,
                AVAILABLE_ONLY: AVAILABLE_ONLY,
                TEMP_UNAVAILABLE_ONLY: TEMP_UNAVAILABLE_ONLY,
                BASE_SITE_URL: BASE_SITE_URL,
                IMAGES_ONLY: IMAGES_ONLY,
                LANGUAGE: LANGUAGE,
                options: options
            }, function () {
                console.log("[summary] == PRODUCT GROUPS ==");

                // casperjs context here
                var casper = this;

                casper.onResourceError = function (resourceError) {
                    console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                    console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
                };

                // map of all products
                var productGroupMap = {};

                // PRODUCT GROUP LISTING
                function getProductGroupListing(pageNum) {
                    if (pageNum == null) {
                        pageNum = 1;
                    }

                    // GET PRODUCT GROUP LISTING
                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.listing?currentPage=" + pageNum + "&_changePage=Y";

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log("Loading product group listing page", pageNum, u);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product listing page!');
                            this.exit();
                        } else {
                            try {
                                console.log('Got product group listing page', pageNum);

                                casper.waitUntilVisible('div.x-grid3-cell-inner.x-grid3-col-3', function () {
                                    console.log("DOM available");

                                    var result = casper.evaluate(function (pageNum) {
                                        console.log('Evaluating product group listing page', pageNum);
                                        var productRe = /<a href="group\.detail\.baseInfo\?groupId=([^"]+)">([^<]+)<\/a>/;
                                        var match;
                                        var productGroups = [];

                                        $("#grid-example .x-grid3-scroller table tbody tr").each(function (index, row) {
                                            try {
                                                //console.log("processing product group row");
                                                var productGroupId, systemRef;
                                                var c = $(this).find("div.x-grid3-cell-inner.x-grid3-col-4").html();

                                                var status = "I";
                                                if (c.match(/\/available.gif/)) {
                                                    console.log("available");
                                                    status = "A";
                                                } else if (c.match(/\/temp-unavailable.gif/)) {
                                                    status = "T";
                                                }

                                                var c2 = $(this).find("div.x-grid3-cell-inner.x-grid3-col-3").html();
                                                if (match = productRe.exec(c2)) {
                                                    console.log("found product group", JSON.stringify(match));

                                                    // load product group detail
                                                    productGroupId = match[1];
                                                    systemRef = match[2];
                                                    console.log("[summary] Found product group", productGroupId, systemRef);
                                                    productGroups.push({
                                                        status: status,
                                                        id: productGroupId,
                                                        systemRef: systemRef
                                                    });
                                                } else {
                                                    console.error("failed to parse product group line", c2);
                                                    return;
                                                }
                                            } catch (ex) {
                                                console.error("error parsing product group listing item", JSON.stringify(ex));
                                            }
                                        });

                                        var hasNext = false;
                                        if (document.all[0].outerHTML.match(/<a class="linkActive" href="javascript:pageChange\(\d+, true\)">Next &gt;&gt;<\/a>/)) {
                                            hasNext = true;
                                        }

                                        console.log("returning from group listing page", "groups", productGroups.length, "hasNext", hasNext);
                                        return {
                                            hasNext: hasNext,
                                            productGroups: productGroups
                                        };
                                    }, pageNum);

                                    var productGroups = result.productGroups;
                                    if (IMAGES_ONLY) {
                                        console.log("[summary] getting only images for product groups");
                                        // remove items that are not existing product groups, because we won't have anything to
                                        // associate the images with
                                        var filtered = [];
                                        for (var i=0; i < productGroups.length; i++) {
                                            var productGroup = productGroups[i];
                                            productGroup.sku = productGroup.systemRef;
                                            productGroupMap[productGroup.id] = productGroup;
                                            if (existingProductTypes[productGroup.systemRef]) {
                                                console.log("[summary] updating product group images", JSON.stringify(productGroup));
                                                filtered.push(productGroup);
                                            } else {
                                                console.log("[summary] NOT updating product group images", JSON.stringify(productGroup));
                                            }
                                        }
                                        productGroups = filtered;
                                    }
                                    var hasNext = result.hasNext;

                                    for (var i=0; i < productGroups.length; i++) {
                                        var productGroup = productGroups[i];

                                        if ((AVAILABLE_ONLY == false && TEMP_UNAVAILABLE_ONLY == false)    || // everything included
                                            (TEMP_UNAVAILABLE_ONLY == false && productGroup.status == "A") || // avail && not just fetching temp unavail
                                            (TEMP_UNAVAILABLE_ONLY == true && productGroup.status == "T"))    // temp unavail && product is temp unavail
                                        {
                                            console.log("[summary] processing product group", productGroup.id, productGroup.systemRef);

                                            try {
                                                // NOTE: save the base level information first, so we could load any group system refs later
                                                if (IMAGES_ONLY) {
                                                    fetchProductGroupImages(productGroup.id, productGroup.systemRef);
                                                } else {
                                                    fetchProductGroupDetail(productGroup.id, productGroup.systemRef);
                                                    saveProductGroup(productGroup.id, productGroup.systemRef);

                                                    fetchProductGroupPromotionalMessages(productGroup.id, productGroup.systemRef);
                                                    fetchProductGroupIngredients(productGroup.id, productGroup.systemRef);
                                                    fetchProductGroupUsage(productGroup.id, productGroup.systemRef);
                                                    fetchProductGroupUpsellItems(productGroup.id, productGroup.systemRef);

                                                    if (LANGUAGE == "en_US") {
                                                        fetchProductGroupImages(productGroup.id, productGroup.systemRef);
                                                        fetchProductGroupCategories(productGroup.id, productGroup.systemRef);
                                                        fetchProductGroupYouMayAlsoLike(productGroup.id, productGroup.systemRef);
                                                        fetchProductGroupSKUs(productGroup.id, productGroup.systemRef);
                                                    }
                                                }

                                                saveProductGroup(productGroup.id, productGroup.systemRef);
                                            } catch (ex) {
                                                console.error("error while processing product group", productGroup.id, JSON.stringify(ex));
                                            }
                                        } else {
                                            console.log("[summary] skipping productGroup.available product group", productGroup.id, productGroup.systemRef);
                                            if (existingProductTypes[productGroup.id]) {
                                                // mark all productGroup.available products as unvailable

                                                if (productGroup.status == "I") {
                                                    this.emit('product.markUnavailable', productGroup.id);
                                                } else if (productGroup.status == "T") {
                                                    this.emit('product.markTempUnavailable', productGroup.id);
                                                }

                                            }
                                            this.emit('productGroup.skip', productGroup.id);
                                        }
                                    }

                                    // continue if we have more pages, else we're done
                                    if (hasNext) {
                                        // uncomment to enable multiple product group page scraping
                                        // we have another page
                                        console.log("have more group listings");
                                        getProductGroupListing(pageNum + 1);
                                    } else {
                                        console.log("no more group listings");
                                    }
                                });
                            } catch (ex) {
                                console.error("error while parsing product group listing page", JSON.stringify(ex));
                            }
                        }
                    });
                }
                getProductGroupListing()

                function saveProductGroup(productGroupId, sku) {
                    this.emit('product.process', sku);
                    casper.then(function () {
                        var json = JSON.stringify(productGroupMap[productGroupId]);
                        console.log("[summary] ====== Product Group ======");
                        console.log("[summary]", json);
                        console.log("[summary] ===========================");

                        this.emit('product.save', json);
                    });
                }

                function fetchProductGroupDetail(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.baseInfo?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group detail', productGroupId);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group detail page!', productGroupId);
                        } else {
                            console.log('Got product group detail page', productGroupId);
                            casper.waitUntilVisible('input[name="groupLocale.name"]', function () {
                                console.log("DOM available");

                                var p = productGroupMap[productGroupId];

                                var product = casper.evaluate(function (LANGUAGE) {
                                    try {
                                        var product = {};
                                        product.type = "group";
                                        var name = $('input[name="groupLocale.name"]').val();
                                        var description = $('iframe').contents().find("body").html();
                                        if (LANGUAGE == "en_US") {
                                            product.description = description;
                                            product.name = name;
                                        } else {
                                            product.description_es_US = description;
                                            product.name_es_US = name;
                                        }
                                        product.onHold = $('input[name="group.onHold"]').attr('checked') || false;
                                        product.searchable = $('input[name="group.searchable"]').attr('checked') || false;
                                        product.masterStatus = $('select[name="group.status"] > option:selected').val();
                                        product.launchId = $('input[name="group.launchId"]').val() || 0;
                                        product.startDate = new Date(moment($('input[name="group.startDate"]').val(), 'MM/DD/YYYY').unix() * 1000);
                                        product.endDate = new Date(moment($('input[name="group.endDate"]').val(), 'MM/DD/YYYY').unix() * 1000);
                                        return product;
                                    } catch (ex) {
                                        console.error("error parsing product group detail", JSON.stringify(ex));
                                    }
                                }, LANGUAGE);
                                // set the group systemRef as the ID
                                product._id = systemRef;

                                if (p) {
                                    // copy over existing
                                    if (LANGUAGE == "en_US") {
                                        p.name = product.name;
                                        p.description = product.description;
                                    } else {
                                        p.name_es_US = product.name_es_US;
                                        p.description_es_US = product.description_es_US;
                                    }
                                    p.onHold = product.onHold;
                                    p.searchable = product.searchable;
                                    p.masterStatus = product.masterStatus;
                                    p.launchId = product.launchId;
                                    p.startDate = product.startDate;
                                    p.endDate = product.endDate;
                                    console.log("Product Group:", JSON.stringify(p));
                                } else {
                                    // new product
                                    product.type = "group";
                                    productGroupMap[productGroupId] = product;
                                    console.log("Product Group:", JSON.stringify(product));
                                }

                                //console.log("Product Group:", JSON.stringify(productGroup));
                            }, function () {
                                console.error("timed out waiting to get product group detail page");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupPromotionalMessages(productGroupId, systemRef) {
                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.promomessages?groupId=" + productGroupId;
                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function() {
                        console.log('[summary] Getting product group promotional messages', productGroupId, 'systemRef', systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group promotionalMessages page!', productGroupId);
                        } else {
                            console.log('Got product group promotionalMessages page', productGroupId);

                            casper.waitUntilVisible('#grid-promomessages', function() {
                                var product = productGroupMap[productGroupId];

                                if (product == null) {
                                    console.error("fetchProductGroupPromotionalMessages(): couldn't find product group", productGroupId, 'sku', sku, "is null");
                                    return;
                                }

                                var promotionalMessages = casper.evaluate(function() {
                                    try {
                                        var promotionalMessages = [];

                                        $("#grid-promomessages .x-grid3-scroller table tr").each(function() {
                                            try {
                                                var message = {};
                                                message.message = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                                message.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html()).unix()*1000);
                                                message.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html()).unix()*1000);
                                                promotionalMessages.push(message);
                                                console.log('Got message', JSON.stringify(message));
                                            } catch (ex) {
                                                console.error('error parsing product group promotionalMessage', JSON.stringify(ex));
                                            }
                                        });

                                        return promotionalMessages;
                                    } catch (ex) {
                                        console.error('error processing promotionalMessages', JSON.stringify(ex));
                                    }
                                });

                                // create array of messages to keep & update as needed
                                var savedMessages = [];
                                var existingPromotionalMessages = existingProductPromotionalMessages[systemRef];

                                if (existingPromotionalMessages) {
                                    console.log("have promo messages", existingPromotionalMessages);
                                    for (var i=0; i < existingPromotionalMessages.length; i++) {
                                        var p = existingPromotionalMessages[i];
                                        console.log("have orig message", JSON.stringify(p));

                                        var index = -1;
                                        for (var j=0; j < promotionalMessages.length; j++) {
                                            var m = promotionalMessages[j];
                                            console.log("found existing", p.startDate, m.startDate, p.endDate, m.endDate);
                                            if (p.startDate == m.startDate && p.endDate == m.endDate) {
                                                console.log("found existing promo message to update");
                                                index = j;
                                                break;
                                            }
                                        }

                                        if (index >= 0) {
                                            var m = promotionalMessages[index];
                                            console.log("using new message to update", JSON.stringify(m));

                                            // remove this items from the new messages list
                                            promotionalMessages.splice(index, 1);

                                            // copy over message based on language
                                            if (LANGUAGE == "en_US") {
                                                p.message = m.message ? m.message : p.message;
                                            } else {
                                                p.message_es_US = m.message ? m.message : p.message;
                                            }

                                            console.log("saving updated message", JSON.stringify(p));
                                            savedMessages.push(p);
                                        } else {
                                            console.log("keeping old message", JSON.stringify(p));
                                            savedMessages.push(p);
                                        }
                                    }
                                }

                                // add all remaining messages as new

                                console.log("saving new messages");

                                for (var i=0; i < promotionalMessages.length; i++) {
                                    var m = promotionalMessages[i];
                                    var p = {};

                                    // add to the list
                                    if (LANGUAGE == "en_US") {
                                        p = {
                                            message: m.message,
                                            startDate: m.startDate,
                                            endDate: m.endDate
                                        };
                                    } else {
                                        p = {
                                            message_es_US: m.message,
                                            startDate: m.startDate,
                                            endDate: m.endDate
                                        };
                                    }

                                    console.log("saving new message", JSON.stringify(p));
                                    savedMessages.push(p);
                                }

                                product.promotionalMessages = savedMessages;

                                //console.log("Product:", JSON.stringify(product));
                            }, function() {
                                console.error("timed out waiting on product group promotionalMessages");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupImages(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.images?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group images', productGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group images page!', productGroupId, systemRef);
                        } else {
                            console.log('[summary] Got product group images page', productGroupId, systemRef);

                            casper.waitUntilVisible('#gridImages', function () {
                                var productGroup = productGroupMap[productGroupId];

                                productGroup.images = casper.evaluate(function () {
                                    var images = [];

                                    $("#gridImages .x-grid3-scroller table tr").each(function () {
                                        try {
                                            var image = {};
                                            image.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            image.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html(), 'MM/DD/YYYY').unix() * 1000);
                                            image.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html(), 'MM/DD/YYYY').unix() * 1000);
                                            image.imagePath = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4 a').attr("href");
                                            image.alt = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                            images.push(image);
                                            console.log('Got image', JSON.stringify(image));
                                        } catch (ex) {
                                            console.error('error parsing product image', JSON.stringify(ex));
                                        }
                                    });

                                    return images;
                                });

                                console.log("Product Group:", JSON.stringify(productGroup));
                            }, function () {
                                console.error("timed out waiting to get product group images");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupIngredients(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.features?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group ingredients', productGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group ingredients page!', productGroupId, systemRef);
                        } else {
                            console.log('Got product group ingredients page', productGroupId, systemRef);

                            casper.waitUntilVisible('iframe', function () {
                                var productGroup = productGroupMap[productGroupId];

                                var ingredients = casper.evaluate(function () {
                                    return $('iframe').contents().find("body").html();
                                });
                                if (LANGUAGE == "en_US") {
                                    productGroup.ingredients = ingredients;
                                } else {
                                    productGroup.ingredients_es_US = ingredients;
                                }
                                console.log("Product Group Ingredients:", ingredients);
                            }, function () {
                                console.error("timed out waiting to get product group ingredients");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupUsage(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.usage?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group usage', productGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group usage page!', productGroupId, systemRef);
                        } else {
                            console.log('Got product group usage page', productGroupId, systemRef);

                            casper.waitUntilVisible('iframe', function () {
                                var productGroup = productGroupMap[productGroupId];

                                var usage = casper.evaluate(function () {
                                    return $('iframe').contents().find("body").html();
                                });

                                if (LANGUAGE == "en_US") {
                                    productGroup.usage = usage;
                                } else {
                                    productGroup.usage_es_US = usage;
                                }
                                console.log("Usage:", usage);
                            }, function () {
                                console.error("timed out waiting to get product group usage");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupCategories(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.categories?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group categories', productGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group categories page!', productGroupId, systemRef);
                        } else {
                            console.log('Got product group categories page', productGroupId, systemRef);

                            casper.waitUntilVisible('#grid-categories .x-grid3-scroller', function () {
                                var productGroup = productGroupMap[productGroupId];

                                productGroup.categories = casper.evaluate(function () {
                                    var categories = [];
                                    $('#grid-categories .x-grid3-scroller table tr').each(function (index, row) {
                                        var href = $(this).find('.x-grid3-cell-inner.x-grid3-col-catId a').attr('href');
                                        var match;
                                        if (match = href.match(/removeCategory\(([0-9]+)\)/)) {
                                            categories.push(parseInt(match[1]));
                                        }
                                    });
                                    return categories;
                                });
                                console.log("Product Group Categories:", JSON.stringify(productGroup.categories));
                            }, function () {
                                console.error("timed out waiting to get product group categories");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupUpsellItems(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.upsell?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group upsellItems', productGroupId);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group upsellItems page!', productGroupId);
                        } else {
                            console.log('Got product group upsellItems page', productGroupId);

                            casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function () {
                                var productGroup = productGroupMap[productGroupId];

                                var upsellItems = casper.evaluate(function (LANGUAGE) {
                                    var upsellItems = [];
                                    $('#simpleGrid .x-grid3-scroller table tr').each(function (index, row) {
                                        var item = {};
                                        item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        if (LANGUAGE == "en_US") {
                                            item.marketingText = $(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html();
                                        } else {
                                            item.marketingText_es_US = $(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html();
                                        }
                                        //item.type = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                        // for now, all upsell items are products with sub-types: product/kit/group
                                        item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                        item.productId = item.product;

                                        upsellItems.push(item);
                                    });
                                    return upsellItems;
                                }, LANGUAGE);

                                var existingUpsellItems = existingProductUpsellItems[systemRef];
                                var newUpsellItems = [];

                                if (existingUpsellItems && existingUpsellItems.length > 0) {
                                    console.log("[summary] existing upsell items for product", productGroupId);
                                    for (var i=0; i < existingUpsellItems.length; i++) {
                                        var p = existingUpsellItems[i];

                                        var index = -1;

                                        for (var j=0; j < upsellItems.length; j++) {
                                            var m = upsellItems[j];
                                            if (p.productGroupId = m.productGroupId) {
                                                console.log("[summary] found existing upsell item to update");
                                                index = j;
                                                break;
                                            }
                                        }

                                        if (index >= 0) {
                                            var m = upsellItems[index];
                                            console.log("[summary] using new upsellItem to update", JSON.stringify(m));

                                            // remove this items from the new upsellItems list
                                            upsellItems.splice(index, 1);

                                            // copy over upsellItem based on language
                                            p.marketingText = m.marketingText ? m.marketingText : p.marketingText;
                                            p.marketingText_es_US = m.marketingText_es_US ? m.marketingText_es_US : p.marketingText_es_US;

                                            console.log("[summary] saving updated upsellItem", JSON.stringify(p));
                                            newUpsellItems.push(p);
                                        } else {
                                            console.log("[summary] keeping old upsellItem", JSON.stringify(p));
                                            newUpsellItems.push(p);
                                        }
                                    }
                                } else {
                                    console.log("[summary] no existing upsell items", productGroupId);
                                }

                                console.log("[summary] saving new upsell items", JSON.stringify(upsellItems));

                                for (var i=0; i < upsellItems.length; i++) {
                                    var m = upsellItems[i];

                                    console.log("[summary] saving new upsellItem", JSON.stringify(m));
                                    newUpsellItems.push(m);
                                }

                                productGroup.upsellItems = newUpsellItems;

                                console.log("Upsell Items:", JSON.stringify(productGroup.upsellItems));
                            }, function () {
                                console.error("timed out waiting to get product group upsellItems");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupYouMayAlsoLike(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.ymal?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group youMayAlsoLike', productGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group youMayAlsoLike page!', productGroupId, systemRef);
                        } else {
                            console.log('Got product group youMayAlsoLike page', productGroupId, systemRef);

                            casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function () {
                                console.log('youMayAlsoLike loaded');
                                try {
                                    var productGroup = productGroupMap[productGroupId];

                                    productGroup.youMayAlsoLike = casper.evaluate(function () {
                                        var youMayAlsoLike = [];
                                        $('#simpleGrid .x-grid3-scroller table tr').each(function (index, row) {
                                            var item = {};
                                            item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            //item.type = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html();
                                            // for now, all upsell items are products with sub-types: product/kit/group
                                            item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                            item.productId = item.product;

                                            youMayAlsoLike.push(item);
                                        });
                                        return youMayAlsoLike;
                                    });
                                    console.log("You May Also Like Items:", JSON.stringify(productGroup.youMayAlsoLike));
                                } catch (ex) {
                                    console.error("error processing you may also like item", JSON.stringify(ex));
                                }
                            }, function () {
                                console.error("timed out waiting to get product group youMayAlsoLike");
                                //this.exit();
                            });
                        }
                    });
                }

                function fetchProductGroupSKUs(productGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.skus?groupId=" + productGroupId;

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting product group SKUs', productGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get product group SKUs page!', productGroupId, systemRef);
                        } else {
                            console.log('Got product group SKUs page', productGroupId);

                            casper.waitUntilVisible('#productAdminContent #secondGrid .x-grid3-scroller', function () {
                                var productGroup = productGroupMap[productGroupId];

                                productGroup.contains = casper.evaluate(function () {
                                    try {
                                        var contains = [];
                                        $('#productAdminContent #secondGrid .x-grid3-scroller .x-grid3-row ').each(function (index, row) {
                                            var contain = {};
                                            //contain.type = $(this).find('divx-grid3-cell-inner.x-grid3-col-3').html();
                                            // for now, all product group items are products
                                            contain.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                            contain.productId = contain.product;

                                            contains.push(contain);
                                        });
                                        return contains;
                                    } catch (ex) {
                                        console.error("error processing sku", JSON.stringify(ex));
                                    }
                                });
                                console.log("SKUs:", JSON.stringify(productGroup.contains));
                            }, function () {
                                console.error("timed out waiting to get product group SKUs");
                                //this.exit();
                            });
                        }
                    });
                }

                casper.then(function () {
                    //console.log("found product groups", JSON.stringify(productGroups));
                });
            }]);
        }

        // KIT GROUPS
        if (!options["skipKitGroups"] && !options["products"]) {
            spooky.then([{
                existingProductTypes: existingProductTypes,
                AVAILABLE_ONLY: AVAILABLE_ONLY,
                BASE_SITE_URL: BASE_SITE_URL,
                LANGUAGE: LANGUAGE
            }, function () {
                console.log("[summary] == KIT GROUPS ==");

                // casperjs context here
                var casper = this;

                casper.onResourceError = function (resourceError) {
                    console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                    console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
                };

                // map of all products
                var kitGroups = {};

                // KIT GROUP LISTING
                function getKitGroupListing(pageNum) {
                    if (pageNum == null) {
                        pageNum = 1;
                    }

                    // GET PRODUCT GROUP LISTING
                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/kitgroup.listing?currentPage=" + pageNum + "&_changePage=Y";

                    // pause to not slam the sever
                    //casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log("Loading kit group listing page", pageNum, u);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get kit group listing page!');
                            this.exit();
                        } else {
                            try {
                                console.log('Got kit group listing page', pageNum);

                                var content = casper.evaluate(function () {
                                    return document.all[0].outerHTML;
                                });

                                console.log('Evaluating kit group listing page', pageNum);
                                var productRe = /<a href="kitgroup.edit\?kitGroupId=([^"]+)">([^<]+)<\/a>/g;
                                var match;

                                while (match = productRe.exec(content)) {
                                    console.log("found kit group page", JSON.stringify(match));

                                    // load product group detail
                                    var kitGroupId = match[1];
                                    var systemRef = match[2];
                                    console.log("[summary] Found kit group", kitGroupId, systemRef);

                                    try {
                                        // NOTE: save the base level information first, so we could load any group system refs later
                                        fetchKitGroupDetail(kitGroupId, systemRef);
                                        saveKitGroup(kitGroupId);
                                    } catch (ex) {
                                        console.error("error while processing kit group", productGroupId, JSON.stringify(ex));
                                    }
                                }

                                // continue if we have more pages, else we're done
                                if (content.match(/<a class="linkActive" href="javascript:pageChange\(\d+, true\)">Next &gt;&gt;<\/a>/)) {
                                    // uncomment to enable multiple product group page scraping
                                    // we have another page
                                    console.log("have more kit group listings");
                                    getKitGroupListing(pageNum + 1);
                                } else {
                                    console.log("no more kit group listings");
                                }
                            } catch (ex) {
                                console.error("error while parsing kit group listing page", JSON.stringify(ex));
                            }
                        }
                    });
                }
                getKitGroupListing()

                function saveKitGroup(kitGroupId) {
                    casper.then(function () {
                        var json = JSON.stringify(kitGroups[kitGroupId]);
                        console.log("====== Kit Group ======");
                        console.log(json);
                        console.log("===========================");

                        this.emit('kitGroup.save', json);
                    });
                }

                function fetchKitGroupDetail(kitGroupId, systemRef) {

                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/kitgroup.edit?kitGroupId=" + kitGroupId;

                    // pause to not slam the sever
                    ////casper.wait(Math.floor(Math.random() * 2000) + 500);

                    casper.then(function () {
                        console.log('[summary] Getting kit group detail', kitGroupId, systemRef);
                    });

                    casper.thenOpen(u, function (response) {
                        if (response.status !== 200) {
                            console.error('Unable to get kit group detail page!', kitGroupId, systemRef);
                        } else {
                            console.log('Got kit group detail page', kitGroupId);
                            casper.waitUntilVisible('#secondGrid .x-grid3-scroller', function () {
                                console.log("DOM available");
                                var kitGroup = {};
                                var ret = casper.evaluate(function () {
                                    try {
                                        var components = [];
                                        $('#secondGrid .x-grid3-scroller .x-grid3-row').each(function (index, row) {
                                            var component = {};
                                            component.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-0').html());
                                            component.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                            component.productId = component.product;
                                            component.startDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html(), 'MM/DD/YYYY').unix() * 1000);
                                            component.endDate = new Date(moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html(), 'MM/DD/YYYY').unix() * 1000);
                                            components.push(component);
                                        });

                                        var name = $("input[name='kitGroupLocale.name']").val();
                                        return {
                                            name: name,
                                            components: components
                                        };
                                    } catch (ex) {
                                        console.error("error parsing kit group detail", JSON.stringify(ex));
                                    }
                                });

                                // set the group systemRef as the ID
                                kitGroup._id = systemRef;

                                if (LANGUAGE == "en_US") {
                                    kitGroup.name = ret.name;
                                } else {
                                    kitGroup.name_es_US = ret.name;
                                }
                                kitGroup.components = ret.components;

                                kitGroups[kitGroupId] = kitGroup;
                                //console.log("Product Group:", JSON.stringify(kitGroup));
                            }, function () {
                                console.error("timed out waiting to get kit group detail page");
                                //this.exit();
                            });
                        }
                    });
                }

                casper.then(function () {
                    //console.log("found kit groups", JSON.stringify(kitGroups));
                });
            }]);
        }

        // SEND COMPLETE EVENT
        spooky.then(function() {
            //this.emit('done');
        });

        spooky.run();
    });

    spooky.on('category.skip', function(json) {
        skippedProducts++;
    });

    spooky.on('category.save', function(json) {
        console.log('saving category', json);
        try {
            var c = JSON.parse(json);
            var id = c._id;
            delete c._id;

            var isUpdate = false;

            // do a lookip on id, so we can detect how many are actually updates & if there are any type overwrites
            models.Category.findById(id, '_id', function(err, cc) {
                try {
                    if (err) return console.error("error loading category", err);
                    if (cc != null) {
                        console.log("found category", JSON.stringify(c));
                        isUpdate = true;
                    } else {
                        console.log("didn't find existing category", id);
                    }

                    // do a save
                    models.Category.update({_id: id}, c, {upsert: true}, function (err, numAffected, rawResponse) {
                        try {
                            if (err) return console.error("error saving category", err);
                            if (isUpdate) {
                                updatedCategories++;
                                console.log("[summary] updated category", id, updatedCategories, numAffected, rawResponse);
                            } else {
                                savedCategories++;
                                console.log("[summary] saved category", id, savedCategories, numAffected, rawResponse);
                            }

                            saveImages(id, c, "categories");
                        } catch (ex) {
                            console.error("error saving/updating category", id, JSON.stringify(ex));
                        }
                    });
                } catch (ex) {
                    console.error("error finding category before save/update", id, JSON.stringify(ex));
                }
            });
        } catch (ex) {
            console.error("error in category.save handler", JSON.stringify(ex));
        }
    });

    spooky.on('product.markUnavailable', function(id) {
        // do a lookup on id
        models.Product.findByIdAndUpdate(id, { $set: { masterStatus: 'I' }}, function(err, prod) {
            try {
                if (err) return console.error("error loading product", id, err);
                if (prod != null) {
                    console.log("marked product unvailable", prod._id);
                }
            } catch (ex) {
                console.error("error marking product unavailable", id, JSON.stringify(ex));
            }
        });
    });

    spooky.on('product.markTempUnavailable', function(id) {
        // do a lookup on id
        models.Product.findByIdAndUpdate(id, { $set: { masterStatus: 'T' }}, function(err, prod) {
            try {
                if (err) return console.error("error loading product", id, err);
                if (prod != null) {
                    console.log("marked product temp unvailable", prod._id);
                }
            } catch (ex) {
                console.error("error marking product temp unavailable", id, JSON.stringify(ex));
            }
        });
    });

    spooky.on('product.skip', function(json) {
        skippedProducts++;
    });

    spooky.on('productKit.skip', function(json) {
        skippedProducts++;
    });

    spooky.on('product.process', function(sku) {
        console.log("[summary] processing product", sku);
        processingProductComplete[sku] = false;
        totalImageFetches++;
    });

    spooky.on('product.save', function(json) {
        try {
            console.log('[summary] saving product', json);

            var p = JSON.parse(json);
            console.log('saving product object', JSON.stringify(p));
            var id = p.sku;
            delete p.id;
            delete p._id;

            console.log('[summary] saving product', id);

            var isUpdate = false;

            // do a lookup on id, so we can detect how many are actually updates & if there are any type overwrites
            models.Product.findById(id, function (err, prod) {
                try {
                    if (err) return console.error("error loading product", err);
                    if (prod != null) {
                        //console.log("found existing product", JSON.stringify(prod));
                        console.log("found existing product");
                        updatedProductIds.push(id);
                        isUpdate = true;
                        if (p.type != prod.type) {
                            console.warn("saving over another type of product", id, p.type, prod.type);
                        }
                    }

                    // do a save
                    models.Product.update({_id: id}, p, {upsert: true}, function (err, numAffected, rawResponse) {
                        try {
                            if (err) return console.error("error saving product", err, JSON.stringify(p));
                            if (p.type == "kit") {
                                if (isUpdate) {
                                    updatedProductKits++;
                                    console.log("[summary] updated product kit", id, updatedProductKits, numAffected, rawResponse);
                                } else {
                                    savedProductKits++;
                                    console.log("[summary] saved product kit", id, savedProductKits, numAffected, rawResponse);
                                }
                            } else if (p.type == "group") {
                                if (isUpdate) {
                                    updatedProductGroups++;
                                    console.log("[summary] updated product group", id, updatedProductGroups, numAffected, rawResponse);
                                } else {
                                    savedProductGroups++;
                                    console.log("[summary] saved product group", id, savedProductGroups, numAffected, rawResponse);
                                }
                            } else {
                                if (isUpdate) {
                                    updatedProducts++;
                                    console.log("[summary] updated product", id, updatedProducts, numAffected, rawResponse);
                                } else {
                                    savedProducts++;
                                    console.log("[summary] saved product", id, savedProducts, numAffected, rawResponse);
                                }
                            }

                            if (isUpdate) {
                                // print out the changes

                                models.Product.findById(id, function (err, p) {
                                    try {
                                        if (err) return console.error("error loading updated product", err);
                                        if (prod != null) {
                                            var changes = deep.diff(prod, p, function (path, key) {
                                                //console.log("[summary] key", key);
                                                if (S(key).startsWith("$") || S(key).startsWith("_") || key == "save") {
                                                    //console.log("[summary] ignoring key", key);
                                                    return true;
                                                }
                                                return false;
                                            });
                                            //console.log("original", JSON.stringify(prod));
                                            //console.log("updated", JSON.stringify(p));
                                            console.log("[summary] product changes", id, changes);
                                        }
                                    } catch (ex) {
                                        console.error("failed to re-load product to view changeset");
                                    }
                                });
                            }

                            // queue up images
                            console.log("saving images for product", id);

                            saveImages(id, p, "products").then(function () {
                                console.log("[summary] saved product images");
                                processingProductComplete[id] = true;
                                completedImageFetches++;
                                spooky.emit('doneCheck');
                            }, function (err) {
                                console.error("[summary] failed to saved product images", err);
                                processingProductComplete[id] = true;
                                completedImageFetches++;
                                spooky.emit('doneCheck');
                            });
                        } catch (ex) {
                            console.error("error saving/updating product", id, ex, JSON.stringify(ex));
                            completedImageFetches++;
                        }
                    });

                } catch (ex) {
                    console.error("error looking up product before save/update", id, JSON.stringify(ex));
                    completedImageFetches++;
                }
            });
        } catch (ex) {
            console.error("error in product.save handler", JSON.stringify(ex));
            completedImageFetches++;
        }
    });

    spooky.on('doneCheck', function() {
        //console.log('doneCheck');

        var done = true;
        for (var id in processingProductComplete) {
            if (processingProductComplete.hasOwnProperty(id)) {
                if (processingProductComplete[id] == false) {
                    console.log('[summary] not yet done', id);
                    done = false;
                    break;
                }
            }
        }

        if (done && completedImageFetches == totalImageFetches) {
            //console.log('DONE');
            this.emit('done');
        } else {
            //console.log('NOT DONE', completedImageFetches, totalImageFetches);
        }
    });

    spooky.on('kitGroup.save', function(json) {
        try {
            //console.log('saving kitGroup', json);

            var kg = JSON.parse(json);
            var id = kg._id;
            delete kg._id;

            var isUpdate = false;

            // do a lookup on id, so we can detect how many are actually updates & if there are any type overwrites
            models.KitGroup.findById(id, function(err, prod) {
                try {
                    if (err) return console.error("error loading kit group", err);
                    if (prod != null) {
                        console.log("found existing kitGroup", JSON.stringify(prod));
                        isUpdate = true;
                    }

                    // do a save
                    models.KitGroup.update({_id: id}, kg, {upsert: true}, function (err, numAffected, rawResponse) {
                        try {
                            if (err) return console.error("error saving kitGroup", err, JSON.stringify(p));
                            if (isUpdate) {
                                updatedKitGroups++;
                                console.log("updated kitGroup", id, updatedKitGroups, numAffected, rawResponse);
                            } else {
                                savedKitGroups++;
                                console.log("saved kitGroup", id, savedKitGroups, numAffected, rawResponse);
                            }
                        } catch (ex) {
                            console.error("error saving/updating kitGroup", id, JSON.stringify(ex));
                        }
                    });
                } catch (ex) {
                    console.error("error looking up kitGroup before save/update", id, JSON.stringify(ex));
                }
            });
        } catch (ex) {
            console.error("error in kitGroup.save handler", JSON.stringify(ex));
        }
    });

    function saveImages(id, item, type) {
        var d = Q.defer();

        try {
            console.log("saveImages():", type, id);
            if (item && item.images && item.images.length > 0) {
                console.log("saveImages():", type, "has", item.images.length, "images");
                var completed = 0;
                for (var j=0; j < item.images.length; j++) {
                    console.log("saveImages(): checking image", j, "for", type);
                    checkAndReplaceImage(id, j, item.images[j].imagePath, type).then(function(ret) {
                        if (ret.exists) {
                            console.log(ret.id, ret.j, "image found");
                        } else {
                            console.log(ret.id, ret.j, type, "image NOT found");
                        }
                        completed++;
                        if (completed == item.images.length) {
                            // all are complete
                            console.log("saveImages(): all images fetched");
                            d.resolve();
                        }
                    }, function(error) {
                        console.error("saveImages(): failed to save/replace image", error);
                    });
                }
            } else {
                console.error("saveImages():", type,"has no images", id);
                d.resolve();
            }
        } catch (ex) {
            console.error("saveImages(): error", ex);
            d.reject(ex);
        }

        return d.promise;
    }

    function checkAndReplaceImage(id, j, imagePath, type) {
        var d = Q.defer();

        try {
            var fileName = "/img/" + type + "/" + id + "_" + j + ".jpg";
            console.log("checkAndReplaceImage(): checking image", fileName);

            GridFS.exist({filename: fileName}, function (err, found) {
                if (err) return;

                if (found) {
                    console.log("checkAndReplaceImage(): removing old file", fileName);
                    GridFS.remove({filename: fileName}, function (err) {
                        if (err) {
                            console.error("error removing old file", fileName);
                        }

                        createFile(id, j, imagePath, type, fileName).then(function(val) {
                            d.resolve(val);
                        }, function(error) {
                            d.reject(error);
                        });
                    });
                } else {
                    createFile(id, j, imagePath, type, fileName).then(function(val) {
                        d.resolve(val);
                    }, function(error) {
                        d.reject(error);
                    });
                }
            });
        } catch (ex) {
            console.error("checkAndReplaceImage(): failed to fetch file", ex);
            d.reject();
        }

        return d.promise;
    }

    function createFile(id, j, imagePath, type, fileName) {
        var d = Q.defer();

        try {
            var url = BASE_SITE_URL + imagePath;
            console.log("createFile(): fetching image", url);

            var writestream = GridFS.createWriteStream({
                filename: fileName
            });

            request.get({
                url: url,
                strictSSL: false
            }).on('response', function(response) {
                console.log("createFile(): got response");
                if (response.statusCode != 200) {
                    console.error("createFile(): error!", response ? response.statusCode : null);
                    d.resolve({
                        id: id, j: j, exists: false
                    });
                    return;
                }

                console.log("createFile(): got product image");

                var update = {};
                update["images." + j + ".localPath"] = fileName;

                console.log("createFile(): updating product image");

                var model = models.Product;
                if (type == "categories") {
                    model = models.Category;
                }

                model.update({_id: id}, update, {upsert: true}, function (err, numAffected, rawResponse) {
                    if (err) {
                        console.error("createFile(): error updating product image path", err);
                        d.resolve({
                            id: id, j: j, exists: false
                        });
                        return;
                    }

                    console.log("createFile(): updated", update);
                    d.resolve({
                        id: id, j: j, exists: true
                    });
                });
            }).on('error', function(err) {
                console.error("createFile(): error fetching image", err);
            }).pipe(writestream);
        } catch (ex) {
            console.error("createFile(): failed to write gridfs file", ex);
        }

        return d.promise;
    }
    
    spooky.on('done', function() {
        console.log("[summary] Saved", savedCategories, "categories");
        console.log("[summary] Saved", savedProductGroups, "product groups");
        console.log("[summary] Saved", savedProducts, "products");
        console.log("[summary] Saved", savedProductKits, "product kits");
        console.log("[summary] Saved", savedKitGroups, "kit groups");

        console.log("[summary] Updated", updatedCategories, "categories");
        console.log("[summary] Updated", updatedProductGroups, "product groups");
        console.log("[summary] Updated", updatedProducts, "products");
        console.log("[summary] Updated", updatedProductKits, "product kits");
        console.log("[summary] Updated", updatedKitGroups, "kit groups");

        console.log("[summary] Skipped", skippedProductGroups, "product groups");
        console.log("[summary] Skipped", skippedProducts, "products");
        console.log("[summary] Skipped", skippedProductKits, "product kits");

        // now update availability of components, inventory numbers, etc.
        try {
            console.log("[summary] updating inventory");

            jafraClient.updateInventory(true).then(function (inventory) {
                console.log("[summary] updated inventory");

                jafraClient.processAvailabilityAndHiddenProducts(inventory, updatedProductIds).then(function (inventory) {
                    console.log("[summary] updated availability for products", updatedProductIds);
                    process.exit(0);
                }, function (err) {
                    console.error("error processing availability", err);
                    process.exit(0);
                });
            }, function (err) {
                console.error("error updating inventory", err);
                process.exit(0);
            });
        } catch (ex) {
            console.error("error updating inventory", ex);
            process.exit(0);
        }
    });

    spooky.on('error', function (e, stack) {
        console.error("general error", e);

        if (stack) {
            console.log(stack);
        }

        process.exit(0);
    });

    // Uncomment this block to see all of the things Casper has to say.
    // There are a lot.
    // He has opinions.
    spooky.on('console', function (line) {
        if (VERBOSE || (line != null && (line.indexOf("[summary]") > -1 || line.indexOf("[error]") > -1))) {
            console.log("console", line);
        }
    });

    spooky.on('log', function (log, level) {
        if (log.space === 'remote') {
            console.log("log", log.message.replace(/ \- .*/, ''), level);
        }
    });

    spooky.onResourceReceived = function(response) {
        //console.log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response));
    };

    spooky.onResourceError = function(resourceError) {
        console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
        console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
    };

    spooky.on('remote.message', function(message) {
        console.log("remote.message", message);
    });

    spooky.on('page.error', function(message, trace) {
        if (message.match(/Ext.fly\(ce\).removeClass/)) {
            return;
        }
        console.error("page.error", message, trace);
    });

});
