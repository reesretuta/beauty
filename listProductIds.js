var models = require('./common/models.js');
var request = require('request');

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
}, '_id', function(err, products) {
    if (err) return console.error("error loading products", err);
    if (products != null) {
        for (var i=0; i < products.length; i++) {
            var id = products[i]._id;
            fetch(id);
        }
    }
});

function fetch(id) {
    request.get({
        url: "https://189.206.20.52/cgidev2/JCD05021P.pgm",
        qs: {
            productId: id
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            if (response.statusCode == 404) {
                console.log(id, "not found");
            } else {
                console.log(id, "error", error);
            }
            return;
        }

        console.log(id, "available", body.availableInventory);
    })
}
