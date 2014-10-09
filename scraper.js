/**
 * This file contains a scraping application that will scrape the site located at BASE_SITE_URL below
 * and store all resulting data into mongodb
 *
 */
var Spooky = require('spooky');
var S = require('string');

var models = require('./common/models.js');

models.onError(function(err) {
    console.error("error connecting to the database", err);
})

models.onReady(function() {
    console.log('Connected to database');

    var savedCategories = 0;
    var savedProducts = 0;
    var savedProductKits = 0;
    var savedProductGroups = 0
    var savedKitGroups = 0

    var updatedCategories = 0;
    var updatedProducts = 0;
    var updatedProductKits = 0;
    var updatedProductGroups = 0
    var updatedKitGroups = 0

    var existingProducts = {};
    var AVAILABLE_ONLY = false;
    var BASE_SITE_URL = process.env.BASE_SITE_URL || "https://stageadmin.jafra.com";
    var USERNAME = process.env.USERNAME || "jafra_test";
    var PASSWORD = process.env.PASSWORD || "lavisual1";

    console.log("base url", BASE_SITE_URL);
    console.log("username", USERNAME);
    console.log("password", PASSWORD);

    // load up the known products / product groups, so we can prioritize loading new ones
    models.Product.find({}, '_id', function(err, products) {
        if (err) return console.error("error loading products", err);
        if (products != null) {
            for (var i=0; i < products.length; i++) {
                var id = products[i]._id;
                existingProducts[id] = 1;
            }
        }
    });

    // DEBUGGING
    //models.Product.findOne({_id: "11345"}).populate('contains.product').populate('kitGroups.kitGroup').exec(function(err, product) {
    //    console.log("got loaded product", JSON.stringify(product));
    //});
    //return;

    var spooky = new Spooky({
        child: {
            transport: 'http',
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

        spooky.start();

        // LOGIN
        spooky.then([{
            existingProducts: existingProducts,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL,
            USERNAME: USERNAME,
            PASSWORD: PASSWORD
        }, function() {
            console.log("== LOGIN ==");

            // casperjs context here
            var casper = this;

            casper.onResourceReceived = function(response) {
                //console.log('Response (#' + response.id + ', stage "' + response.stage + '"): ' + JSON.stringify(response));
            };
            casper.onResourceError = function(resourceError) {
                console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
            };

            var login_url = BASE_SITE_URL + '/csr-admin/security-admin/login';

            console.log("login url", login_url);

            // LOGIN
            var data = "pagechanged=N&tab=&redirectPage=%2Fadmin&userid=" + USERNAME + "&password=" + PASSWORD;
            casper.open(login_url, {
                method: 'post',
                data: data
            }).then(function(response) {
                    console.log('response', JSON.stringify(response));
                    if (response.status !== 200) {
                        console.error('Unable to login!', response.status);
                        this.exit();
                    } else {
                        console.log('Logged in');
                    }
                });

            // MANAGE SKUS
            var manage_skus_url = BASE_SITE_URL + '/csr-admin-4/productcatalog/product.listing?adminUserId=86&language=en_US';

            casper.thenOpen(manage_skus_url, function(response) {
                if (response.status !== 200) {
                    console.error('Unable to get Manage SKUs!', response.status);
                    this.exit();
                } else {
                    console.log('Got Manage SKUs');
                }
            });
        }]);


        // CATEGORIES
        spooky.then([{
            existingProducts: existingProducts,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL
        }, function () {
            console.log("== CATEGORIES ==");

            // casperjs context here
            var casper = this;

            casper.onResourceError = function(resourceError) {
                console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
            };

            var categories = [];

            function Category() {
            }

            var categories_url = BASE_SITE_URL + '/csr-admin-4/productcatalog/product-category.listing';

            try {
                casper.thenOpen(categories_url, function(response) {
                    if (response.status !== 200) {
                        console.error('Unable to get categories!', response.status);
                        this.exit();
                    } else {
                        console.log('Got categories page');

                        casper.waitUntilVisible('#categoryListing', function() {
                            console.log("got category listing");
                        });

                        casper.then(function() {
                            // open all children, so they render
                            function expandChildren() {
                                console.log("expandChildren()");

                                var notExpanded = casper.evaluate(function() {
                                    var content = $('#categoryListing table.categoryListingTable > tbody > tr:nth-child(2) table').html();
                                    if (content.match(/<img class="pc-parentCategoryNode" src="\/csr-admin-4\/images\/en_US\/productcatalog\/icons\/plus.gif" alt="">/)) {
                                        return true;
                                    }
                                    return false;
                                });

                                if (notExpanded) {
                                    console.log("expandChildren(): not expanded");
                                    // expand all categories
                                    casper.evaluate(function() {
                                        try {
                                            console.log("expanding sub-categories");
                                            // expand children
                                            $("img[src$='/csr-admin-4/images/en_US/productcatalog/icons/plus.gif'].pc-parentCategoryNode").click();
                                        } catch (ex) {
                                            console.error("error expanding sub-categories", JSON.stringify(ex));
                                        }
                                    });
                                    casper.wait(1000, function() {
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

                        casper.then(function() {
                            console.log("processing categories");

                            // get all the categories
                            categories = casper.evaluate(function() {
                                /**
                                 * @param {string=} rows
                                 * @param {number=} level
                                 */
                                function getCategories(rows, level) {
                                    if (level == null) {
                                        level = 0;
                                    }
                                    var indent = "";
                                    for (var i=0; i < (level?level:0); i++) {
                                        indent += "  ";
                                    }
                                    //console.log(indent, "getCategories("+level+"): START");
                                    try {
                                        var categories = [];
                                        if (rows == null) {
                                            console.log(indent, "getCategories("+level+"): getting initial categories");
                                            rows = $('#categoryListing table.categoryListingTable > tbody > tr > td > table > tbody > tr');
                                        }
                                        var category = null;
                                        rows.each(function(index, row) {
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
                                                    name: name,
                                                    rank: rank,
                                                    onHold: onHold,
                                                    showInMenu: showInMenu,
                                                    searchable: searchable
                                                };
                                                categories.push(category);
                                                console.log(indent, "getCategories("+level+"): category found:", name, id, rank, onHold, showInMenu, searchable);
                                            } else if (isSubCategory && category != null) {
                                                //console.log(indent, "getCategories("+level+"): getting children categories");
                                                // we have a sub-category
                                                var childRows = $(this).find("> td > div > table > tbody > tr");
                                                //console.log("childRows", childRows.length);

                                                var children = getCategories(childRows, level+1);

                                                // save the parent category id into the children
                                                for (var i=0; i < children.length; i++) {
                                                    children[i].parent = category._id;
                                                }
                                                category.children = children;
                                                category = null;
                                            }
                                        });
                                        //console.log(indent, "getCategories("+level+"): END");
                                        return categories;
                                    } catch (ex) {
                                        console.error(indent, "getCategories("+level+"): error getting category", JSON.stringify(ex));
                                    }
                                }
                                return getCategories();
                            });

                            console.log("got categories");
                            for (var i=0; i < categories.length; i++) {
                                // get more category details
                                saveCategoryDetail(categories[i]);

                                // save
                                saveCategory(categories[i]);
                            }
                        });
                    }
                });

                function saveCategoryDetail(category) {
                    var categoryId = category._id;
                    var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product-category.detail?action=edit&categoryId="+categoryId;
                    console.log("Loading category detail");

                    casper.thenOpen(u, function(response) {
                        if (response.status !== 200) {
                            console.error('Unable to get category detail page!');
                            this.exit();
                        } else {
                            console.log('Got category detail page');

                            var detail = casper.evaluate(function() {
                                var detail = {};
                                detail.startDate = moment($('input[name="category.startDate"]').val(), 'MM/DD/YYYY').unix();
                                detail.endDate = moment($('input[name="category.endDate"]').val(), 'MM/DD/YYYY').unix();

                                // images
                                var images = [];

                                $("#gridImages .x-grid3-scroller table tr").each(function() {
                                    try {
                                        var image = {};
                                        image.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        image.startDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html(), 'MM/DD/YYYY').unix();
                                        image.endDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html(), 'MM/DD/YYYY').unix();
                                        image.imagePath = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4 a').attr("href");
                                        image.alt = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                        images.push(image);
                                        console.log('Got image', JSON.stringify(image));
                                    } catch (ex) {
                                        console.error('error parsing category image', JSON.stringify(ex));
                                    }
                                });
                                detail.images = images;

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
                            });
                            category.startDate = detail.startDate;
                            category.endDate = detail.endDate;
                            category.images = detail.images;
                            category.customerTypes = detail.customerTypes;
                        }
                    });
                }

                function saveCategory(category) {
                    casper.then(function() {
                        // handle parent, if any
                        if (category.children) {
                            var ids = [];
                            for (var i=0; i < category.children.length; i++) {
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


        // PRODUCTS & KITS
        spooky.then([{
            existingProducts: existingProducts,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL
        }, function () {
            console.log("== PRODUCTS ==");

            // casperjs context here
            var casper = this;

            casper.onResourceError = function(resourceError) {
                console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
            };

            // map of all products
            var products = {};
            var newProducts = [];
            var updateProducts = [];
            var unavailableProducts = [];

            // PRODUCT LISTING
            function getProductListing(pageNum, kits) {
                if (pageNum == null) {
                    pageNum = 1;
                }

                // GET PRODUCT LISTING
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(kits?'kit':'')+".listing?currentPage=" + pageNum + "&_changePage=Y&searchById=8";

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
                        console.log('Got product listing page', pageNum);

                        casper.waitUntilVisible('#gridProducts .x-grid3-scroller table tbody tr', function() {
                            try {
                                console.log("Evaluating product "+(kits?'kit':'')+" listing page", pageNum);
                                var products = casper.evaluate(function() {
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
                                                product.available = true;
                                            } else {
                                                //console.log("unavailable");
                                                product.available = false;
                                            }
                                            var c2 = $(this).find("div.x-grid3-cell-inner.x-grid3-col-3").html();
                                            if (match = productRe.exec(c2)) {
                                                product.id = match[2];
                                                product.sku = match[3];
                                                products.push(product);
                                            } else {
                                                console.error("failed to parse product line");
                                            }
                                        });
                                        //console.log("returning products", JSON.stringify(products));
                                        return products;
                                    } catch (ex) {
                                        console.error("error parsing product "+(kits?'kit':'')+" listing page", JSON.stringify(ex));
                                    }
                                });

                                for (var i=0; i < products.length; i++) {
                                    var product = products[i];
                                    //console.log("found product page", JSON.stringify(product));

                                    if (AVAILABLE_ONLY == false || product.available == true) {
                                        // add to the list to be fetched if new
                                        if (existingProducts[product.sku] == 1) {
                                            console.log("found updated product"+(kits?' kit':''), product.id);
                                            updateProducts.push({id: product.id, sku: product.sku, isKit: kits});
                                            // else add to the list to be updated later
                                        } else {
                                            console.log("found new product"+(kits?' kit':''), product.id);
                                            newProducts.push({id: product.id, sku: product.sku, isKit: kits});
                                        }
                                    } else {
                                        console.log("skipping unavailable product"+(kits?' kit':''), JSON.stringify(product));
                                        // mark it as unavailable in the database too, since we now know it's unavailable
                                        if (existingProducts[product.id] == 1) {
                                            unavailableProducts.push(product.id);
                                        }
                                    }
                                }

                                var content = casper.evaluate(function() {
                                    return document.all[0].outerHTML;
                                });

                                // continue if we have more pages, else we're done
                                if (content.match(/\[Next\]/)) {
                                    // uncomment to enable multiple product page scraping
                                    // we have another page
                                    getProductListing(pageNum+1, kits);
                                }
                            } catch (ex) {
                                console.error("error evaluating product listing", pageNum, JSON.stringify(ex));
                            }
                        }, function() {
                            console.error("timed out waiting to get product listing");
                            this.exit();
                        });
                    }
                });
            }

            // get regular products
            getProductListing(1, false);

            // get kits
            getProductListing(1, true);


            casper.then(function() {
                console.log("got all products & kits, get product listings");

                var allProducts = newProducts.concat(updateProducts);

                // go through the products and fetch product/kit details
                processAllProducts(allProducts);

                // mark all unavailable products as unvailable
                for (var i=0; i < unavailableProducts.length; i++) {
                    this.emit('product.markUnavailable', unavailableProducts[i]);
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

                        fetchProductDetail(productId, sku, isKit);
                        fetchProductImages(productId, isKit);
                        fetchProductIngredients(productId, isKit);
                        fetchProductUsage(productId, isKit);
                        fetchProductPrices(productId, isKit);
                        fetchProductCategories(productId, isKit);
                        fetchProductUpsellItems(productId, isKit);
                        fetchProductYouMayAlsoLike(productId, isKit);
                        fetchProductSharedAssets(productId, isKit);

                        // only for kits
                        if (isKit) {
                            fetchProductComponents(productId);
                        }

                        saveProduct(productId);
                    } catch (ex) {
                        console.error("error processing product", productId, JSON.stringify(ex));
                    }
                }
            }

            function saveProduct(productId) {
                casper.then(function() {
                    var json = JSON.stringify(products[productId]);
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
                    console.log('Getting product detail', productId, 'sku', sku, 'isKit', isKit);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product detail page!', productId);
                    } else {
                        try {
                            console.log('Got product detail page', productId, sku, isKit);
                            casper.waitUntilVisible('input[name=formalName_en_US]', function() {
                                console.log("DOM available");
                                var product = casper.evaluate(function() {
                                    try {
                                        var product = {};
                                        product.name = $('input[name=formalName_en_US]').val();
                                        product.description = $('iframe[name=ext-gen49]').contents().find("body").html();
                                        product.quantity = $('input[name="sellingQty_en_US"]').val();
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
                                });
                                product.type = isKit ? "kit" : "product";
                                product._id = sku;

                                products[productId] = product;
                                console.log("Product:", JSON.stringify(product));
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

            function fetchProductImages(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".images?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product images', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product images page!', productId);
                    } else {
                        console.log('Got product images page', productId);

                        casper.waitUntilVisible('#gridImages', function() {
                            var product = products[productId];

                            product.images = casper.evaluate(function() {
                                try {
                                    var images = [];

                                    $("#gridImages .x-grid3-scroller table tr").each(function() {
                                        try {
                                            var image = {};
                                            image.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            image.startDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html(), 'MM/DD/YYYY').unix();
                                            image.endDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html(), 'MM/DD/YYYY').unix();
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

            function fetchProductIngredients(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".features?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product ingredients', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product ingredients page!', productId);
                    } else {
                        console.log('Got product ingredients page', productId);

                        casper.waitUntilVisible('iframe', function() {
                            var product = products[productId];

                            product.ingredients = casper.evaluate(function() {
                                try {
                                    return $('iframe').contents().find("body").html();
                                } catch (ex) {
                                    console.error("error while parsing product ingredients", JSON.stringify(ex));
                                }
                            });
                            console.log("Ingredients:", product.ingredients);
                        }, function() {
                            console.error("timed out waiting to get product ingredients");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductUsage(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".usage?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product usage', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product usage page!', productId);
                    } else {
                        console.log('Got product usage page', productId);

                        casper.waitUntilVisible('iframe', function() {
                            var product = products[productId];

                            product.usage = casper.evaluate(function() {
                                try {
                                    return $('iframe').contents().find("body").html();
                                } catch (ex) {
                                    console.error("error while parsing product usage", JSON.stringify(ex));
                                }
                            });
                            console.log("Usage:", product.usage);
                        }, function() {
                            console.error("timed out waiting to get product usage");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductPrices(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".prices?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product prices', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product prices page!', productId);
                    } else {
                        console.log('Got product prices page', productId);

                        casper.waitUntilVisible('#grid-prices .x-grid3-scroller', function() {
                            var product = products[productId];
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
                                casper.evaluate(function(i) {
                                    try {
                                        console.log("getting link", i);
                                        var link = $('#grid-prices .x-grid3-scroller table tr td div.x-grid3-cell-inner.x-grid3-col-priceId a')[i];
                                        console.log("got link", link.href);
                                        var match;
                                        if (match = link.href.match(/detailPrice\(([0-9]+)\)/)) {
                                            var priceId = match[1];
                                            console.log("showing price", priceId);
                                            detailPrice(priceId);
                                        }
                                    } catch (ex) {
                                        console.error("error parsing price link", JSON.stringify(ex));
                                    }
                                }, i);
                                casper.waitForSelector('.x-window iframe', function() {
                                    console.log("price modal loaded for product", productId);
                                    var price = casper.evaluate(function() {
                                        try {
                                            var contents = $('.x-window iframe').contents();
                                            var p = {};
                                            p.price = parseFloat(contents.find('input[name="productPrice.price"]').val());
                                            p.typeId = parseInt(contents.find('select[name="productPrice.productPriceTypeId"] > option:selected').val()) || 0;
                                            p.commissionableVolume = parseFloat(contents.find('input[name="productPrice.commissionablePrice"]').val());
                                            p.qualifyingVolume = parseFloat(contents.find('input[name="productPrice.businessVolume"]').val());
                                            p.retailVolume = parseFloat(contents.find('input[name="productPrice.retailVolume"]').val());
                                            p.instantProfit = parseFloat(contents.find('input[name="productPrice.instantProfit"]').val());
                                            p.rebate = parseFloat(contents.find('input[name="productPrice.rebate"]').val());
                                            p.shippingSurcharge = parseFloat(contents.find('input[name="productPrice.shippingSurcharge"]').val());
                                            p.effectiveStartDate = moment(contents.find('input[name="productPrice.startDate"]').val(), 'MM/DD/YYYY').unix();
                                            p.effectiveEndDate = moment(contents.find('input[name="productPrice.endDate"]').val(), 'MM/DD/YYYY').unix();

                                            p.customerTypes = [];
                                            if (contents.find('input[name="customerTypes.itemMapped[0].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Non-Party Customer");
                                            }
                                            if (contents.find('input[name="customerTypes.itemMapped[1].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Consultant");
                                            }
                                            if (contents.find('input[name="customerTypes.itemMapped[2].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Employee");
                                            }
                                            if (contents.find('input[name="customerTypes.itemMapped[3].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Party Guest");
                                            }
                                            if (contents.find('input[name="customerTypes.itemMapped[4].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Hostess");
                                            }
                                            if (contents.find('input[name="customerTypes.itemMapped[5].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Fundraiser");
                                            }
                                            if (contents.find('input[name="customerTypes.itemMapped[6].customerType"]').attr('checked')) {
                                                p.customerTypes.push("Department");
                                            }

                                            return p;
                                        } catch (ex) {
                                            console.error("error parsing price modal", JSON.stringify(ex));
                                        }
                                    });
                                    product.prices.push(price);
                                }, function() {
                                    this.capture('error_modal'+i+'.jpg', undefined, {
                                        format: 'jpg',
                                        quality: 100
                                    });
                                    console.error("failed to load modal in time");
                                });
                            }
                            casper.then(function() {
                                console.log("product", productId, "prices", JSON.stringify(product.prices));
                            });
                        }, function() {
                            console.error("timed out waiting to get product prices");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductCategories(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".categories?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product categories', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product categories page!', productId);
                    } else {
                        console.log('Got product categories page', productId);

                        casper.waitUntilVisible('#grid-categories .x-grid3-scroller', function() {
                            var product = products[productId];

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

            function fetchProductUpsellItems(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".upsellitems?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product upsellItems', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product upsellItems page!', productId);
                    } else {
                        console.log('Got product upsellItems page', productId);

                        casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function() {
                            var product = products[productId];

                            product.upsellItems = casper.evaluate(function() {
                                try {
                                    var upsellItems = [];
                                    $('#simpleGrid .x-grid3-scroller table tr').each(function(index, row) {
                                        var item = {};
                                        item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        item.marketingText = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                        // for now, all upsell items are products with sub-types: product/kit/group
                                        item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();

                                        upsellItems.push(item);
                                    });
                                    return upsellItems;
                                } catch (ex) {
                                    console.error("error while parsing product upsellItems");
                                }
                            });
                            console.log("Upsell Items:", JSON.stringify(product.upsellItems));
                        }, function() {
                            console.error("timed out waiting to get product upsell items");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductYouMayAlsoLike(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".coordinatingitems?productId=" + productId + "&formType=ymal";

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product youMayAlsoLike', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product youMayAlsoLike page!', productId);
                    } else {
                        console.log('Got product youMayAlsoLike page', productId);

                        casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function() {
                            console.log('youMayAlsoLike loaded');
                            try {
                                var product = products[productId];

                                product.youMayAlsoLike = casper.evaluate(function() {
                                    try {
                                        var youMayAlsoLike = [];
                                        $('#simpleGrid .x-grid3-scroller table tr').each(function(index, row) {
                                            var item = {};
                                            item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            // for now, all YMAL items are products with sub-types: product/kit/group
                                            item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();

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

            function fetchProductSharedAssets(productId, isKit) {
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/product"+(isKit?'kit':'')+".attributes?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product sharedAssets', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product sharedAssets page!', productId);
                    } else {
                        console.log('Got product sharedAssets page', productId);

                        casper.waitUntilVisible('#gridAccessories .x-grid3-scroller', function() {
                            var product = products[productId];

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
                                        item.startDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-6').html(), 'MM/DD/YYYY').unix();
                                        item.endDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-7').html(), 'MM/DD/YYYY').unix();
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
            function fetchProductComponents(productId) {
                var u =  BASE_SITE_URL + "/csr-admin-4/productcatalog/productkit.components?productId=" + productId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product components', productId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product components page!', productId);
                    } else {
                        console.log('Got product components page', productId);

                        casper.waitUntilVisible('#secondGrid .x-grid3-scroller', function() {
                            console.log('components loaded');
                            try {
                                var product = products[productId];

                                var ret = casper.evaluate(function() {
                                    try {
                                        var contains = [];
                                        var kitGroups = [];
                                        $('#secondGrid .x-grid3-scroller table tr').each(function(index, row) {
                                            var item = {};
                                            item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-0').html());
                                            item.quantity = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                            item.type = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html();

                                            // save this component as either a contained product or a kit group
                                            var id = $(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html();
                                            if (item.type == 'kitGroup') {
                                                item.kitGroup = id;
                                                kitGroups.push(item);
                                            } else {
                                                item.product = id;
                                                contains.push(item);
                                            }

                                            item.startDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-6').html(), 'MM/DD/YYYY').unix();
                                            item.endDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-7').html(), 'MM/DD/YYYY').unix();
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
        spooky.then([{
            existingProducts: existingProducts,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL
        }, function () {
            console.log("== PRODUCT GROUPS ==");

            // casperjs context here
            var casper = this;

            casper.onResourceError = function(resourceError) {
                console.error('Unable to load resource (#' + resourceError.id + 'URL:' + resourceError.url + ')');
                console.error('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
            };

            // map of all products
            var productGroups = {};

            function ProductGroup() {
            }

            // PRODUCT GROUP LISTING
            function getProductGroupListing(pageNum) {
                if (pageNum == null) {
                    pageNum = 1;
                }

                // GET PRODUCT GROUP LISTING
                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.listing?currentPage=" + pageNum + "&_changePage=Y";

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log("Loading product group listing page", pageNum, u);
                });

                casper.thenOpen(u, function(response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product listing page!');
                        this.exit();
                    } else {
                        try {
                            console.log('Got product group listing page', pageNum);

                            var content = casper.evaluate(function() {
                                return document.all[0].outerHTML;
                            });

                            console.log('Evaluating product group listing page', pageNum);
                            var productRe = /<a href="group\.detail\.baseInfo\?groupId=([^"]+)">([^<]+)<\/a>/g;
                            var match;

                            while (match = productRe.exec(content)) {
                                console.log("found product group page", JSON.stringify(match));

                                // load product group detail
                                var productGroupId = match[1];
                                var systemRef = match[2];

                                try {
                                    // NOTE: save the base level information first, so we could load any group system refs later
                                    fetchProductGroupDetail(productGroupId, systemRef);
                                    saveProductGroup(productGroupId);

                                    fetchProductGroupImages(productGroupId);
                                    fetchProductGroupIngredients(productGroupId);
                                    fetchProductGroupUsage(productGroupId);
                                    fetchProductGroupCategories(productGroupId);
                                    fetchProductGroupUpsellItems(productGroupId);
                                    fetchProductGroupYouMayAlsoLike(productGroupId);
                                    fetchProductGroupSKUs(productGroupId);

                                    saveProductGroup(productGroupId);
                                } catch (ex) {
                                    console.error("error while processing product group", productGroupId, JSON.stringify(ex));
                                }
                            }

                            // continue if we have more pages, else we're done
                            if (content.match(/<a class="linkActive" href="javascript:pageChange\(\d+, true\)">Next &gt;&gt;<\/a>/)) {
                                // uncomment to enable multiple product group page scraping
                                // we have another page
                                console.log("have more group listings");
                                getProductGroupListing(pageNum+1);
                            } else {
                                console.log("no more group listings");
                            }
                        } catch (ex) {
                            console.error("error while parsing product group listing page", JSON.stringify(ex));
                        }
                    }
                });
            }
            getProductGroupListing()

            function saveProductGroup(productGroupId) {
                casper.then(function() {
                    var json = JSON.stringify(productGroups[productGroupId]);
                    console.log("====== Product Group ======");
                    console.log(json);
                    console.log("===========================");

                    this.emit('product.save', json);
                });
            }

            function fetchProductGroupDetail(productGroupId, systemRef) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.baseInfo?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group detail', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group detail page!', productGroupId);
                    } else {
                        console.log('Got product group detail page', productGroupId);
                        casper.waitUntilVisible('input[name="groupLocale.name"]', function() {
                            console.log("DOM available");
                            var product = casper.evaluate(function() {
                                try {
                                    var product = {};
                                    product.type = "group";
                                    product.name = $('input[name="groupLocale.name"]').val();
                                    product.description = $('iframe').contents().find("body").html();
                                    product.onHold = $('input[name="group.onHold"]').attr('checked') || false;
                                    product.searchable = $('input[name="group.searchable"]').attr('checked') || false;
                                    product.masterStatus = $('select[name="group.status"] > option:selected').val();
                                    product.launchId = $('input[name="group.launchId"]').val() || 0;
                                    product.startDate = moment($('input[name="group.startDate"]').val(), 'MM/DD/YYYY').unix();
                                    product.endDate = moment($('input[name="group.endDate"]').val(), 'MM/DD/YYYY').unix();
                                    return product;
                                } catch (ex) {
                                    console.error("error parsing product group detail", JSON.stringify(ex));
                                }
                            });
                            // set the group systemRef as the ID
                            product._id = systemRef;

                            productGroups[productGroupId] = product;
                            //console.log("Product Group:", JSON.stringify(productGroup));
                        }, function() {
                            console.error("timed out waiting to get product group detail page");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupImages(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.images?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group images', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group images page!', productGroupId);
                    } else {
                        console.log('Got product group images page', productGroupId);

                        casper.waitUntilVisible('#gridImages', function() {
                            var productGroup = productGroups[productGroupId];

                            productGroup.images = casper.evaluate(function() {
                                var images = [];

                                $("#gridImages .x-grid3-scroller table tr").each(function() {
                                    try {
                                        var image = {};
                                        image.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        image.startDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html(), 'MM/DD/YYYY').unix();
                                        image.endDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html(), 'MM/DD/YYYY').unix();
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
                            //console.log("Product Group:", JSON.stringify(productGroup));
                        }, function() {
                            console.error("timed out waiting to get product group images");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupIngredients(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.features?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group ingredients', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group ingredients page!', productGroupId);
                    } else {
                        console.log('Got product group ingredients page', productGroupId);

                        casper.waitUntilVisible('iframe', function() {
                            var productGroup = productGroups[productGroupId];

                            productGroup.ingredients = casper.evaluate(function() {
                                return $('iframe').contents().find("body").html();
                            });
                            console.log("Product Group Ingredients:", productGroup.ingredients);
                        }, function() {
                            console.error("timed out waiting to get product group ingredients");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupUsage(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.usage?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group usage', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group usage page!', productGroupId);
                    } else {
                        console.log('Got product group usage page', productGroupId);

                        casper.waitUntilVisible('iframe', function() {
                            var productGroup = productGroups[productGroupId];

                            productGroup.usage = casper.evaluate(function() {
                                return $('iframe').contents().find("body").html();
                            });
                            console.log("Usage:", productGroup.usage);
                        }, function() {
                            console.error("timed out waiting to get product group usage");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupCategories(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.categories?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group categories', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group categories page!', productGroupId);
                    } else {
                        console.log('Got product group categories page', productGroupId);

                        casper.waitUntilVisible('#grid-categories .x-grid3-scroller', function() {
                            var productGroup = productGroups[productGroupId];

                            productGroup.categories = casper.evaluate(function() {
                                var categories = [];
                                $('#grid-categories .x-grid3-scroller table tr').each(function(index, row) {
                                    var href = $(this).find('.x-grid3-cell-inner.x-grid3-col-catId a').attr('href');
                                    var match;
                                    if (match = href.match(/removeCategory\(([0-9]+)\)/)) {
                                        categories.push(parseInt(match[1]));
                                    }
                                });
                                return categories;
                            });
                            console.log("Product Group Categories:", JSON.stringify(productGroup.categories));
                        }, function() {
                            console.error("timed out waiting to get product group categories");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupUpsellItems(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.upsell?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group upsellItems', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group upsellItems page!', productGroupId);
                    } else {
                        console.log('Got product group upsellItems page', productGroupId);

                        casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function() {
                            var productGroup = productGroups[productGroupId];

                            productGroup.upsellItems = casper.evaluate(function() {
                                var upsellItems = [];
                                $('#simpleGrid .x-grid3-scroller table tr').each(function(index, row) {
                                    var item = {};
                                    item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                    item.marketingText = $(this).find('div.x-grid3-cell-inner.x-grid3-col-3').html();
                                    //item.type = $(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html();
                                    // for now, all upsell items are products with sub-types: product/kit/group
                                    item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();

                                    upsellItems.push(item);
                                });
                                return upsellItems;
                            });
                            console.log("Upsell Items:", JSON.stringify(productGroup.upsellItems));
                        }, function() {
                            console.error("timed out waiting to get product group upsellItems");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupYouMayAlsoLike(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.ymal?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group youMayAlsoLike', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group youMayAlsoLike page!', productGroupId);
                    } else {
                        console.log('Got product group youMayAlsoLike page', productGroupId);

                        casper.waitUntilVisible('#simpleGrid .x-grid3-scroller', function() {
                            console.log('youMayAlsoLike loaded');
                            try {
                                var productGroup = productGroups[productGroupId];

                                productGroup.youMayAlsoLike = casper.evaluate(function() {
                                    var youMayAlsoLike = [];
                                    $('#simpleGrid .x-grid3-scroller table tr').each(function(index, row) {
                                        var item = {};
                                        item.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-1').html());
                                        //item.type = $(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html();
                                        // for now, all upsell items are products with sub-types: product/kit/group
                                        item.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();

                                        youMayAlsoLike.push(item);
                                    });
                                    return youMayAlsoLike;
                                });
                                console.log("You May Also Like Items:", JSON.stringify(productGroup.youMayAlsoLike));
                            } catch (ex) {
                                console.error("error processing you may also like item", JSON.stringify(ex));
                            }
                        }, function() {
                            console.error("timed out waiting to get product group youMayAlsoLike");
                            //this.exit();
                        });
                    }
                });
            }

            function fetchProductGroupSKUs(productGroupId) {

                var u = BASE_SITE_URL + "/csr-admin-4/productcatalog/group.detail.skus?groupId=" + productGroupId;

                // pause to not slam the sever
                //casper.wait(Math.floor(Math.random() * 2000) + 500);

                casper.then(function() {
                    console.log('Getting product group SKUs', productGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get product group SKUs page!', productGroupId);
                    } else {
                        console.log('Got product group SKUs page', productGroupId);

                        casper.waitUntilVisible('#productAdminContent #secondGrid .x-grid3-scroller', function() {
                            var productGroup = productGroups[productGroupId];

                            productGroup.contains = casper.evaluate(function() {
                                try {
                                    var products = [];
                                    $('#productAdminContent #secondGrid .x-grid3-scroller .x-grid3-row ').each(function(index, row) {
                                        var product = {};
                                        //product.type = $(this).find('divx-grid3-cell-inner.x-grid3-col-3').html();
                                        // for now, all product group items are products
                                        product.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();

                                        products.push(product);
                                    });
                                    return products;
                                } catch (ex) {
                                    console.error("error processing sku", JSON.stringify(ex));
                                }
                            });
                            console.log("SKUs:", JSON.stringify(productGroup.contains));
                        }, function() {
                            console.error("timed out waiting to get product group SKUs");
                            //this.exit();
                        });
                    }
                });
            }

            casper.then(function() {
                //console.log("found product groups", JSON.stringify(productGroups));
            });
        }]);


        // KIT GROUPS
        spooky.then([{
            existingProducts: existingProducts,
            AVAILABLE_ONLY: AVAILABLE_ONLY,
            BASE_SITE_URL: BASE_SITE_URL
        }, function () {
            console.log("== KIT GROUPS ==");

            // casperjs context here
            var casper = this;

            casper.onResourceError = function(resourceError) {
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

                casper.then(function() {
                    console.log("Loading kit group listing page", pageNum, u);
                });

                casper.thenOpen(u, function(response) {
                    if (response.status !== 200) {
                        console.error('Unable to get kit group listing page!');
                        this.exit();
                    } else {
                        try {
                            console.log('Got kit group listing page', pageNum);

                            var content = casper.evaluate(function() {
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
                                getKitGroupListing(pageNum+1);
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
                casper.then(function() {
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

                casper.then(function() {
                    console.log('Getting kit group detail', kitGroupId);
                });

                casper.thenOpen(u, function (response) {
                    if (response.status !== 200) {
                        console.error('Unable to get kit group detail page!', kitGroupId);
                    } else {
                        console.log('Got kit group detail page', kitGroupId);
                        casper.waitUntilVisible('#secondGrid .x-grid3-scroller', function() {
                            console.log("DOM available");
                            var kitGroup = {};
                            kitGroup.components = casper.evaluate(function() {
                                try {
                                    var components = [];
                                    $('#secondGrid .x-grid3-scroller .x-grid3-row').each(function(index, row) {
                                        var component = {};
                                        component.rank = parseInt($(this).find('div.x-grid3-cell-inner.x-grid3-col-0').html());
                                        component.product = $(this).find('div.x-grid3-cell-inner.x-grid3-col-2').html();
                                        component.startDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-4').html(), 'MM/DD/YYYY').unix();
                                        component.endDate = moment($(this).find('div.x-grid3-cell-inner.x-grid3-col-5').html(), 'MM/DD/YYYY').unix();
                                        components.push(component);
                                    });
                                    return components;
                                } catch (ex) {
                                    console.error("error parsing kit group detail", JSON.stringify(ex));
                                }
                            });
                            // set the group systemRef as the ID
                            kitGroup._id = systemRef;

                            kitGroups[kitGroupId] = kitGroup;
                            //console.log("Product Group:", JSON.stringify(kitGroup));
                        }, function() {
                            console.error("timed out waiting to get kit group detail page");
                            //this.exit();
                        });
                    }
                });
            }

            casper.then(function() {
                //console.log("found kit groups", JSON.stringify(kitGroups));
            });
        }]);

        // SEND COMPLETE EVENT
        spooky.then(function() {
            this.emit('done');
        });

        spooky.run();
    });

    spooky.on('category.save', function(json) {
        //console.log('saving category', json);
        try {
            var p = JSON.parse(json);
            var id = p._id;
            delete p._id;

            var isUpdate = false;

            // do a lookip on id, so we can detect how many are actually updates & if there are any type overwrites
            models.Category.findById(id, '_id', function(err, c) {
                try {
                    if (err) return console.error("error loading category", err);
                    if (c != null) {
                        //console.log("found category", JSON.stringify(c));
                        isUpdate = true;
                    }
                } catch (ex) {
                    console.error("error finding category before save/update", id, JSON.stringify(ex));
                }
            });

            // do a save
            models.Category.update({_id: id}, p, {upsert: true}, function (err, numAffected, rawResponse) {
                try {
                    if (err) return console.error("error saving category", err, JSON.stringify(p));
                    if (isUpdate) {
                        updatedCategories++;
                        console.log("updated category", updatedCategories, numAffected, rawResponse);
                    } else {
                        savedCategories++;
                        console.log("saved category", savedCategories, numAffected, rawResponse);
                    }
                } catch (ex) {
                    console.error("error saving/updating category", id, JSON.stringify(ex));
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

    spooky.on('product.save', function(json) {
        try {
            //console.log('saving product', json);

            var p = JSON.parse(json);
            var id = p._id;
            delete p._id;

            var isUpdate = false;

            // do a lookup on id, so we can detect how many are actually updates & if there are any type overwrites
            models.Product.findById(id, 'type', function(err, prod) {
                try {
                    if (err) return console.error("error loading product", err);
                    if (prod != null) {
                        console.log("found existing product", JSON.stringify(prod));
                        isUpdate = true;
                        if (p.type != prod.type) {
                            console.warn("saving over another type of product", p._id, p.type, prod.type);
                        }
                    }
                } catch (ex) {
                    console.error("error looking up product before save/update", id, JSON.stringify(ex));
                }
            });

            // do a save
            models.Product.update({_id: id}, p, {upsert: true}, function (err, numAffected, rawResponse) {
                try {
                    if (err) return console.error("error saving product", err, JSON.stringify(p));
                    if (p.type == "kit") {
                        if (isUpdate) {
                            updatedProductKits++;
                            console.log("updated product kit", id, updatedProductKits, numAffected, rawResponse);
                        } else {
                            savedProductKits++;
                            console.log("saved product kit", id, savedProductKits, numAffected, rawResponse);
                        }
                    } else if (p.type == "group") {
                        if (isUpdate) {
                            updatedProductGroups++;
                            console.log("updated product group", id, updatedProductGroups, numAffected, rawResponse);
                        } else {
                            savedProductGroups++;
                            console.log("saved product group", id, savedProductGroups, numAffected, rawResponse);
                        }
                    } else {
                        if (isUpdate) {
                            updatedProducts++;
                            console.log("updated product", id, updatedProducts, numAffected, rawResponse);
                        } else {
                            savedProducts++;
                            console.log("saved product", id, savedProducts, numAffected, rawResponse);
                        }
                    }
                } catch (ex) {
                    console.error("error saving/updating product", id, JSON.stringify(ex));
                }
            });
        } catch (ex) {
            console.error("error in product.save handler", JSON.stringify(ex));
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
                } catch (ex) {
                    console.error("error looking up kitGroup before save/update", id, JSON.stringify(ex));
                }
            });

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
            console.error("error in kitGroup.save handler", JSON.stringify(ex));
        }
    });

    spooky.on('done', function() {
        console.log("Saved", savedCategories, "categories");
        console.log("Saved", savedProductGroups, "product groups");
        console.log("Saved", savedProducts, "products");
        console.log("Saved", savedProductKits, "product kits");
        console.log("Saved", savedKitGroups, "kit groups");
        console.log("Updated", updatedCategories, "categories");
        console.log("Updated", updatedProductGroups, "product groups");
        console.log("Updated", updatedProducts, "products");
        console.log("Updated", updatedProductKits, "product kits");
        console.log("Updated", updatedKitGroups, "kit groups");

        process.exit(0);
    });

    spooky.on('error', function (e, stack) {
        console.error("general error", e);

        if (stack) {
            console.log(stack);
        }
    });

    // Uncomment this block to see all of the things Casper has to say.
    // There are a lot.
    // He has opinions.
    spooky.on('console', function (line) {
        console.log("console", line);
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
