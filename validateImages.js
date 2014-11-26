var models = require('./common/models.js');
var request = require('request');
var fs = require('fs');
var Q = require('Q');
var Grid = require('gridfs-stream');
var GridFS = Grid(models.mongoose.connection.db, models.mongoose.mongo);

var USERNAME = process.env.JCS_API_USERNAME || "CDIAPI";
var PASSWORD = process.env.JCS_API_PASSWORD || "JCSAPI";
var AUTH_STRING = "Basic " + new Buffer(USERNAME + ":" + PASSWORD).toString("base64");

var agentOptions = {
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_method'
};

// load up the known products / product groups, so we can prioritize loading new ones
var now = new Date();
models.Product.find({
    $and: [
        {masterStatus: "A", onHold: false},
        {masterType: "R"},
        {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
    ]
}, '_id images', function(err, products) {
    if (err) return console.error("error loading products", err);
    if (products != null) {
        for (var i=0; i < products.length; i++) {
            var product = products[i];
            var id = product._id;
            //console.log("checking images for product", product._id);
            if (product.images && product.images.length > 0) {
                //console.log("has", product.images.length, "images");
                for (var j=0; j < product.images.length; j++) {
                    //console.log("checking image", j, "for product");
                    checkImage(id, j, product.images[j].imagePath).then(function(ret) {
                        try {
                            if (ret.exists) {
                                //console.log(ret.id, ret.j, "image found");
                            } else {
                                console.log(ret.id, ret.j, "image NOT found");
                            }
                        } catch (ex) {
                            console.error(ex);
                        }
                    }, function(error) {
                        console.error(error);
                    });
                }
            } else {
                console.error(id, "has no images");
            }
        }
    }
});

function checkImage(id, j, imagePath) {
    var d = Q.defer();

    try {
        var url = "https://admin.jafra.com" + imagePath;
        //console.log("fetching image", url);

        var fileName = "img/products/" + id + "_" + j + ".jpg";

        var writestream = GridFS.createWriteStream({
            filename: fileName
        });
        //writestream.on('close', function (file) {
        //    callback(null, file);
        //});

        request.get({
            url: url
        }, function (error, response, body) {
            if (error || response.statusCode != 200) {
                console.log("error!", response.statusCode);
                d.resolve({
                    id: id, j: j, exists: false
                });
                return;
            }

            console.log("got product");

            var update = {};
            update["images." + j + ".localPath"] = fileName;


            console.log("updating product");

            models.Product.update({_id: id}, update, {upsert: true}, function (err, numAffected, rawResponse) {
                if (err) {
                    console.error("error updating product image path");
                    return;
                }

                console.log("updated", update);
            });

            console.log("success");
            d.resolve({
                id: id, j: j, exists: true
            });
        }).pipe(writestream);
    } catch (ex) {
        console.error("failed to fetch file", ex);
        d.reject();
    }

    return d.promise;
}
