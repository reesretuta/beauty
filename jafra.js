'use strict';

var config = require('./config/config');

var request = require('request');
var SHA1 = require("crypto-js/sha1");
var Q = require('q');
Q.longStackSupport = true;
var soap = require('soap');
var parseString = require('xml2js').parseString;
var fs = require('fs');
var models = require('./common/models.js');
var mongoose = require('mongoose');
var randomString = require('random-string');
var moment = require('moment');
var util = require('util');
//var toposort = require('toposort');

var port = process.env.PORT || 8090;
var BASE_URL = "https://" + (process.env.JCS_API_URL || config.jcs_api_ip) + "/cgidev2";
var BASE_URL2 = "https://" + (process.env.JCS_API_URL || config.jcs_api_ip) + "/WEBCGIPR";
var FORCE_INVENTORY_CACHE = process.env.FORCE_INVENTORY_CACHE || false;

var agentOptions = {
    rejectUnauthorized: true,
    secureProtocol: 'TLSv1_method'
};

var USERNAME = process.env.JCS_API_USERNAME || "CDIAPI";
var PASSWORD = process.env.JCS_API_PASSWORD || "JCSAPI";
var AUTH_STRING = "Basic " + new Buffer(USERNAME + ":" + PASSWORD).toString("base64");

var AUTHENTICATE_URL = BASE_URL + "/JCD05001P.pgm";
var GET_CLIENT_URL = BASE_URL + "/JCD05007P.pgm";
var CREATE_CLIENT_URL = BASE_URL + "/JCD05002P.pgm";
var UPDATE_CLIENT_URL = BASE_URL + '/JCD05003P.pgm';

var GET_CONSULTANT_URL = BASE_URL + "/JOS05007P.pgm";
var CREATE_CONSULTANT_URL = BASE_URL + "/JOS05002P.pgm";
var LOOKUP_CONSULTANT_URL = BASE_URL + "/JOS05004P.pgm";
var CREATE_LEAD_URL = BASE_URL + "/JOS05005P.pgm";

var CREATE_ORDER_URL = BASE_URL + "/JCD05020P.pgm";
var GET_ORDER_HISTORY_URL = BASE_URL + "/JCD05013P.pgm";

var GET_ADDRESSES_URL = BASE_URL + "/JCD05005P.pgm";
var GET_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";
var CREATE_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";
var UPDATE_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";
var DELETE_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";

var GET_CREDIT_CARDS_URL = BASE_URL + "/JCD05008P.pgm";
var GET_CREDIT_CARD_URL = BASE_URL + "/JCD05008P.pgm";
var CREATE_CREDIT_CARD_URL = BASE_URL + "/JCD05008P.pgm";
var UPDATE_CREDIT_CARD_URL = BASE_URL + "/JCD05008P.pgm";
var DELETE_CREDIT_CARD_URL = BASE_URL + "/JCD05008P.pgm";
var GET_ALL_INVENTORY_URL = BASE_URL + "/JCD05012P.pgm";
var GET_INVENTORY_URL = BASE_URL + "/JCD05021P.pgm"; // productId=<productId>

var GET_GEOCODES_URL = BASE_URL2 + "/JNS0002R.pgm";
var GET_SALES_TAX_URL = BASE_URL + "/JCD05022P.pgm";

var LOOKUP_CLIENT_CONSULTANT_URL = BASE_URL + "/JCD05011P.pgm";
var PASSWORD_RESET_REQUEST_URL = BASE_URL + "/JCD05009P.pgm";
var PASSWORD_RESET_CHANGE_URL = BASE_URL + "/JCD05010P.pgm";

var STRIKEIRON_VALIDATE = process.env.STRIKEIRON_VALIDATE == "false" ? false : true;
var STRIKEIRON_EMAIL_URL = 'http://ws.strikeiron.com/StrikeIron/emv6Hygiene/EMV6Hygiene/VerifyEmail';
var STRIKEIRON_EMAIL_LICENSE = "2086D15410C1B9F9FF89";
var STRIKEIRON_EMAIL_TIMEOUT = 15;

//console.log("STRIKEIRON_VALIDATE", STRIKEIRON_VALIDATE);

//var STRIKEIRON_ADDRESS_URL = 'http://ws.strikeiron.com/StrikeIron/NAAddressVerification6/NorthAmericanAddressVerificationService/NorthAmericanAddressVerification';
var STRIKEIRON_ADDRESS_SOAP_URL = 'http://ws.strikeiron.com/NAAddressVerification6?WSDL';
var STRIKEIRON_ADDRESS_LICENSE = "0DA72EA3199C10ABDE0B";

var API_BASE_URL = 'http://localhost:' + port + '/api';
var API_PRODUCTS_URL = API_BASE_URL + "/products";

var PASSWORD_RESET_INTERVAL = 15 * 1000 * 60;
var MIN_INVENTORY = 1;

// pre-load categories so we can do some child category searches
var categoryToChildren = {};

var logger;

exports.setLogger = function(l) {
    logger = l;
    if (logger.debug == null) {
        logger.debug = logger.log;
    }
}

function preloadCategories() {
    models.Category.find({parent: { $exists: false }, onHold: false, showInMenu: true }).sort('rank').limit(100)
    .populate({
        path: 'children',
        match: {onHold: false, showInMenu: true}
    }).exec(function (err, categories) {
        if (err) {
            logger.error("error loading categories", err);
            return;
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

            // populate all levels
            models.Category.populate(categories, opts, function (err, categories) {
                //logger.debug(JSON.stringify(categories));

                for (var i=0; i < categories.length; i++) {
                    var category = categories[i];
                    //logger.debug("category", category._id);
                    var ids = _getCategoryAndChildren(category);
                    //logger.debug("children", ids);
                    //logger.debug("top level category", category._id, ids);
                    categoryToChildren[category._id] = ids;
                    //logger.debug("category sub-categories", category._id, ids);
                }

                //logger.debug("categoryToChildren", categoryToChildren);
            })
        })
    });
}

function _getCategoryAndChildren(category) {
    //logger.debug("processing category", category._id);
    var all = [];

    // add this category
    all.push(category._id);

    var children = category.children ? category.children : [];
    for (var i=0; i < children.length; i++) {
        var child = children[i];
        //logger.debug("processing category child", child._id);
        var childIds = _getCategoryAndChildren(child);
        //logger.debug("processing category child", child._id, childIds);
        categoryToChildren[child._id] = childIds;
        all = all.concat(childIds);
    }

    return all;
}

function authenticate(email, password) {
    //logger.debug("authenticating", email, password);
    var deferred = Q.defer();

    request.post({
        url: AUTHENTICATE_URL,
        form: {
            email: email,
            password: password
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            logger.error("authenticate(): error", error, response ? response.statusCode: null, body);
            if (response && response.statusCode == 401) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: "invalidCredentials",
                        message: "Invalid Credentials"
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "authenticationInvalidResponse",
                        message: "Failed to authenticate"
                    }
                });
            }
            return;
        }
        //logger.debug("authenticate(): success", body);

        if (body == null || body.clientId == null) {
            logger.debug("authenticate(): invalid return data", body, typeof body, "clientId", body.clientId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "authenticationReturnDataInvalid",
                    message: "Failed to get client ID from authentication"
                }
            });
            return;
        }

        // we should get clientId back
        var clientId = body.clientId;

        // fetch the client information & return
        getClient(clientId).then(function(r) {
            // this is a bug fix
            if (typeof r.result.creditCards == 'string') {
                r.result.creditCards = [];
            }

            // get order history
            models.OrderHistory.find({clientId: clientId})
            .sort({created:-1})
            .limit(1)
            .exec(function (err, orders) {
                if (err) {
                    logger.debug("error getting order history by client id", err);
                }

                orders = orders ? orders : [];

                if (orders[0]) {
                    r.result.lastUsedCreditCardId = orders[0].creditCardId;
                    r.result.lastUsedShippingAddressId = orders[0].shippingAddressId;
                    r.result.lastUsedBillingAddressId = orders[0].billingAddressId;
                    r.result.lastUsedConsultantId = orders[0].consultantId;
                }

                deferred.resolve({
                    status: r.status, result: r.result
                });
            });
        }, function (r) {
            logger.error("authenticate(): failed to load client", r.result);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "authenticationLoadFailed",
                    message: "Failed to load client details after authenticate"
                }
            });
        });
    });

    return deferred.promise;
}
//authenticate('vilchis40@gmail.com', 'ferrari').then(function(r) {
//    logger.debug("auth", r.status, r.result);
//}, function(r) {
//    logger.error("auth", r.status, r.result);
//});

//authenticate('davidcastro@lavisual.com', 'testpass').then(function(r) {
//    logger.debug(r.response.statusCode, r.body);
//}, function(r) {
//    logger.error(r.response.statusCode, r.body);
//});

// ?clientId=
function getClient(clientId) {
    //logger.debug("getClient()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_CLIENT_URL,
        qs: {
            clientId: clientId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("getClient()", error, response ? response.statusCode: null, body);
        if (error || response == null || response.statusCode != 200) {
            logger.error("getClient(): error", error, response ? response.statusCode: null, body);

            if (response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "clientInvalidResponse",
                        message: "Failed to get client"
                    }
                });
            }

            return;
        }

        if (body.id != null) {
            //logger.debug("getClient(): success", body);
            deferred.resolve({
                status: 200,
                result: body
            });
        } else {
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "clientLoadFailed",
                    message: "Failed to load client"
                }
            });
        }
    })

    return deferred.promise;
}

function createClient(client) {
    var deferred = Q.defer();

    request.post({
        url: CREATE_CLIENT_URL,
        form: {
            email: client.email,
            password: client.password,
            firstName: client.firstName,
            lastName: client.lastName,
            dateOfBirth: client.dateOfBirth,
            consultantId: client.consultantId,
            language: client.language
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 201) {
            logger.error("createClient(): error", response ? response.statusCode: null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
                logger.error("createClient(): error, returning server error");
                if (response && response.statusCode) {
                    deferred.reject({
                        status: response.statusCode,
                        result: {
                            statusCode: body.statusCode,
                            errorCode: body.errorCode,
                            message: body.message
                        }
                    });
                } else {
                    deferred.reject({
                        status: 500,
                        result: {
                            statusCode: 500,
                            errorCode: "createClientInvalidResponse",
                            message: "Failed to create client"
                        }
                    });
                }
            } else {
                logger.error("createClient(): error, returning generic error");
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createClientFailed",
                        message: "Failed to create client"
                    }
                });
            }
            return;
        }

        if (body == null || body.clientId == null) {
            logger.debug("createClient(): invalid return data", body, typeof body, "clientId", body.clientId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "createClientReturnDataInvalid",
                    message: "Failed to get client ID from create"
                }
            });
            return;
        }

        // we should get clientId back
        logger.debug("createClient(): returning success");
        var clientId = body.clientId;

        // fetch the client information & return
        getClient(clientId).then(function(r) {
            if (r.status != 200) {
                logger.error("server: createClient(): failed to load client", r.result);
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "failedToLoadClient",
                        errorMessage: "Failed to lookup newly created client"
                    }
                });
                return;
            }

            deferred.resolve({
                status: 201,
                result: r.result
            });
        }, function (r) {
            logger.error("server: createClient(): failed to load client", r.result);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "failedToLoadClient",
                    errorMessage: "Failed to lookup newly created client"
                }
            });
        });

    });

    return deferred.promise;
}

// update existing client on jafra servers
function updateClient(clientId, client) {
    logger.debug('updateClientclient(): client:', client);
    var deferred = Q.defer();
    
    var data = {};
    data.clientId = clientId;
    client.password ? data.password = client.password : null;
    client.firstName ? data.firstName = client.firstName : null;
    client.lastName ? data.lastName = client.lastName : null;
    client.email ? data.email = client.email : null;
    client.language ? data.language = client.language : null;
    client.phone ? data.phone = client.phone : null;
    
    request.post({
        url: UPDATE_CLIENT_URL,
        form: data,
        headers: {
            'Content-Type'  : 'application/x-www-form-urlencoded',
            'Authorization' : AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug('jafraClient(): updateClient(): response.statusCode:', response.statusCode);
        if (error || response.statusCode !== 204) {
            logger.error('updateClient(): error:', response ? response.statusCode: null, body);
            if (body && body.statusCode && body.errorCode && body.message) {
                if (response && response.statusCode) {
                    deferred.reject({
                        status: response.statusCode,
                        result: {
                            statusCode: body.statusCode,
                            errorCode: body.errorCode,
                            message: body.message
                        }
                    });
                } else {
                    deferred.reject({
                        status: 500,
                        result: {
                            statusCode: 500,
                            errorCode: 'updateClientInvalidResponse',
                            message: 'Failed to update client'
                        }
                    });
                }
            } else {
                logger.error('updateClient(): error, returning generic error', error, body);
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: 'updateClientFailed',
                        message: 'Failed to update client'
                    }
                });
            }
            return;
        }
        deferred.resolve({
            status : 204,
            result : {}
        });
    });
    return deferred.promise;
}

// ...
function getConsultant(consultantId) {
    //logger.debug("getConsultant()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_CONSULTANT_URL,
        qs: {
            consultantId: consultantId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("getConsultant()", error, response ? response.statusCode: null, body);
        if (error || response == null || response.statusCode != 200) {
            logger.error("getConsultant(): error", error, response ? response.statusCode: null, body);
            if (response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "getConsultantInvalidResponse",
                        message: "Failed to get consultant"
                    }
                });
            }
            return;
        }

        if (body.id != null) {
            //logger.debug("getConsultant(): success", body);
            deferred.resolve({
                status: 200,
                result: {
                    id: consultantId,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email
                }
            });
        } else {
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "consultantLoadFailed",
                    message: "Failed to load consultant"
                }
            });
        }
    })

    return deferred.promise;
}

function lookupConsultant(encrypted) {
    logger.debug("lookupConsultant()", encrypted);
    var deferred = Q.defer();

    request.post({
        url: LOOKUP_CONSULTANT_URL,
        form: {
            "valToDecrypt": encrypted
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("lookupConsultant(): body", body);

        if (error || response.statusCode != 200) {
            logger.error("lookupConsultant(): error", error, response ? response.statusCode : null, body);

            if (response && response.statusCode) {
                if (response.statusCode == 404) {
                    // not found
                    deferred.reject({
                        status: 200,
                        result: {
                            statusCode: 200,
                            errorCode: "consultantNotFound",
                            message: "Consultant not found"
                        }
                    });
                } else {
                    deferred.reject({
                        status: response.statusCode,
                        result: {
                            exists: false
                        }
                    });
                }
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "lookupConsultantFailed",
                        message: "Failed to lookup consultant"
                    }
                });
            }
            return;
        }

        if (body == null || body.consultantId == null) {
            logger.debug("lookupConsultant(): invalid return data", body, typeof body, "consultantId", body.consultantId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "lookupConsultantReturnDataInvalid",
                    message: "Failed to get consultant ID from lookup"
                }
            });
            return;
        }

        var exists = body.consultantId > 0;
        logger.debug("lookupConsultant(): exists", exists, "consultantId", body.consultantId);

        // we should get consultantId back
        deferred.resolve({
            status: 200,
            result: {
                exists: exists
            }
        });
    });

    return deferred.promise;
}

function createConsultant(encrypted) {
    //logger.debug("createCreditCard", email, password);
    var deferred = Q.defer();

    request.post({
        url: CREATE_CONSULTANT_URL,
        form: {
            "valToDecrypt": encrypted
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response == null || response.statusCode != 201) {
            logger.error("createConsultant(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                if (body.errorCode == 409) {
                    deferred.reject({
                        status: response.statusCode,
                        result: {
                            statusCode: body.statusCode,
                            errorCode: "accountAlreadyExists",
                            message: "Account already exists"
                        }
                    });
                } else {
                    deferred.reject({
                        status: response.statusCode,
                        result: {
                            statusCode: body.statusCode,
                            errorCode: body.errorCode,
                            message: body.message
                        }
                    });
                }
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createConsultantFailed",
                        message: "Failed to create consultant"
                    }
                });
            }
            return;
        }

        if (body == null || body.consultantId == null || body.orderId == null) {
            logger.debug("createConsultant(): invalid return data", body, typeof body, "consultantId", body.consultantId, "orderId", body.orderId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "createConsultantReturnDataInvalid",
                    message: "Failed to get consultant ID from create"
                }
            });
            return;
        }

        // we should get consultantId back
        deferred.resolve({
            status: 201,
            result: body
        });
    });

    return deferred.promise;
}

function lookupConsultantByEmail(email) {
    return lookupByEmail(email, 1);
}

function lookupClientByEmail(email) {
    return lookupByEmail(email, 2);
}

function lookupByEmail(email, type) {
    //logger.debug("lookupByEmail()", clientId);
    var deferred = Q.defer();

    request.get({
        url: LOOKUP_CLIENT_CONSULTANT_URL,
        qs: {
            email: email,
            type: type
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("lookupByEmail()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            logger.error("lookupByEmail(): error", error, response ? response.statusCode: null, body);
            if (response && response.statusCode && body) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createClientInvalidResponse",
                        message: "Failed to create client"
                    }
                });
            }
            return;
        }

        if (
            (type == 1 && body.consultantId != null) ||
            (type == 2 && body.clientId != null)
        ) {
            //logger.debug("lookupByEmail(): success", body);
            deferred.resolve({
                status: 204,
                result: null
            });
        } else {
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "lookupByEmailFailed",
                    message: "Failed to lookup by email"
                }
            });
        }
    })

    return deferred.promise;
}

function createOrder(data, session) {
    //logger.debug("createOrder", data);
    var deferred = Q.defer();

    request.post({
        url: CREATE_ORDER_URL,
        form: {
            "firstName": data.firstName,
            "lastName": data.lastName,
            "clientId": data.clientId,
            "consultantId": data.consultantId,
            "language": data.language,
            "billingAddressId": data.billingAddressId,
            "shippingAddressId": data.shippingAddressId,
            "creditCardId": data.creditCardId,
            "source": data.source,
            "total": data.total,
            "products": JSON.stringify(data.products)
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 201) {
            logger.error("createOrder(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createOrderFailed",
                        message: "Failed to create order"
                    }
                });
            }
            return;
        }

        if (body == null || body.orderId == null || body.orderId == null) {
            logger.debug("createOrder(): invalid return data", body, typeof body, "orderId", body.orderId, "orderId", body.orderId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "createOrderReturnDataInvalid",
                    message: "Failed to get order ID from create"
                }
            });
            return;
        }

        // save the transaction locally
        try {
            data.orderId = body.orderId;
            for (var i=0; i < data.products.length; i++) {
                // save out the skus to product for references
                var product = data.products[i];
                product.product = product.sku;
            }
            var orderHistory = new models.OrderHistory(data);

            orderHistory.save(function (err) {
                if (err) return logger.error("createOrder(): error saving order history record", err);

                // else update the latest session data
                session.client.lastUsedCreditCardId = data.creditCardId;
                session.client.lastUsedShippingAddressId = data.shippingAddressId;
                session.client.lastUsedBillingAddressId = data.billingAddressId;
                session.client.lastUsedConsultantId = data.consultantId;
            })
        } catch (ex) {
            logger.error("error saving order history record", ex);
        }


        // we should get orderId back
        deferred.resolve({
            status: 201,
            result: body
        });
    });

    return deferred.promise;
}

function getOrderHistory(clientId) {
    logger.debug("getOrderHistory()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_ORDER_HISTORY_URL,
        qs: {
            clientId: clientId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("getOrderHistory()", error, response ? response.statusCode: null, body);
        if (error || response == null || response.statusCode != 200) {
            logger.error("getOrderHistory(): error", error, response ? response.statusCode: null, body);
            if (response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "getOrderHistoryInvalidResponse",
                        message: "Failed to get order history"
                    }
                });
            }
            return;
        }

        if (Array.isArray(body)) {
            //logger.debug("getOrderHistory(): success", body);
            deferred.resolve({
                status: 200,
                result: body
            });
        } else {
            deferred.resolve({
                status: 200,
                result: []
            });
        }
    })

    return deferred.promise;
}

function createLead(lead) {
    //logger.debug("createLead", email, password);
    var data, deferred = Q.defer();
    data = {
        email: lead.email,
        firstName: lead.firstName,
        lastName: lead.lastName,
        phone: lead.phone,
        language: lead.language,
    };
    if (lead.type) {
        data.type = lead.type;
    }
    request.post({
        url: CREATE_LEAD_URL,
        form: data,
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            logger.error("createLead(): error", response ? response.statusCode: null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                logger.error("createLead(): error, returning server error");
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                logger.error("createLead(): error, returning generic error");
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createLeadFailed",
                        message: "Failed to create lead"
                    }
                });
            }
            return;
        }

        if (body == null || body.leadId == null) {
            logger.debug("createLead(): invalid return data", body, typeof body, "leadId", body.leadId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "createLeadReturnDataInvalid",
                    message: "Failed to get lead ID from create"
                }
            });
            return;
        }

        // we should get leadId back
        logger.debug("createLead(): returning success");
        var leadId = body.leadId;
        deferred.resolve({
            status: 201,
            result: body
        });
    });

    return deferred.promise;
}

function getAddresses(clientId) {
    //logger.debug("getAddresses()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_ADDRESSES_URL,
        qs: {
            clientId: clientId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response == null || response.statusCode != 200) {
            logger.error("getAddresses(): error", error, response? response.statusCode : null, body);
            deferred.reject({error: error, response: response, body: body});
            return;
        }
        //logger.debug("getAddresses(): success", body);
        deferred.resolve({
            status: 200,
            result: body
        });
    });

    return deferred.promise;
}
//getAddresses(12).then(function(r) {
//    logger.debug(r.body);
//});

function getAddress(clientId, addressId) {
    //logger.debug("getAddress()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_ADDRESS_URL,
        qs: {
            clientId: clientId,
            addressId: addressId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response == null || response.statusCode != 200) {
            logger.error("getAddress(): error", error, response ? response.statusCode : null, body);
            deferred.reject({error: error, response: response, body: body});
        }
        //logger.debug("getAddress(): success", body);
        deferred.resolve({response: response, body: body});
    });

    return deferred.promise;
}

// FIXME - error when requesting addressId 1200, get array instead of single address
//getAddress(12, 1200).then(function(r) {
//    logger.debug(r.body);
//});

function createAddress(clientId, address) {
    //logger.debug("createAddress", email, password);
    var deferred = Q.defer();

    request.post({
        url: CREATE_ADDRESS_URL,
        qs: {
            clientId: clientId
        },
        form: {
            "name": address.name,
            "address1": address.address1,
            "address2": address.address2,
            "city": address.city,
            "state": address.state,
            "zip": address.zip,
            "country": address.country,
            "phone": address.phone,
            "geocode": address.geocode,
            "county" : address.county,
            "stateDescription": address.state
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 201) {
            logger.error("createAddress(): error", response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createAddressFailed",
                        message: "Failed to create client"
                    }
                });
            }
            return;
        }

        if (body == null || body.addressId == null) {
            logger.debug("createAddress(): invalid return data", body, typeof body, "addressId", body.addressId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "createAddressReturnDataInvalid",
                    message: "Failed to get address ID from create"
                }
            });
            return;
        }

        // we should get addressId back
        address.id = body.addressId;
        deferred.resolve({
            status: 201,
            result: address
        });
    });

    return deferred.promise;
}

//rees
function updateName(clientId, newName){
    var deferred = Q.defer();
    request.put({
        url: UPDATE_CLIENT_URL,
        qs: {
            clientId: clientId
        },
        form: {
            "firstName": name.firstName,
            "lastName": name.lastName
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true        
    }, function(error, response, body){
        
        
        console.log(body);
        
        // we should get nothing back
        logger.debug("updateAddress(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });
        
    return deferred.promise;
}

function updateAddress(clientId, addressId, address) {
    logger.debug("updateAddress", clientId, addressId, address);
    var deferred = Q.defer();

    request.post({
        url: UPDATE_ADDRESS_URL,
        qs: {
            clientId: clientId,
            addressId: addressId
        },
        form: {
            "name": address.name,
            "address1": address.address1,
            "address2": address.address2,
            "city": address.city,
            "state": address.state,
            "zip": address.zip,
            "country": address.country,
            "phone": address.phone,
            "geocode": address.geocode,
            "stateDescription": address.state,
            "county" : address.county
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 204) {
            logger.error("updateAddress(): error", response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "updateAddressFailed",
                        message: "Failed to update address"
                    }
                });
            }
            return;
        }

        // we should get nothing back
        logger.debug("updateAddress(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });

    return deferred.promise;
}

function deleteAddress(clientId, addressId) {
    logger.debug("deleteAddress", clientId, addressId);
    var deferred = Q.defer();

    request.del({
        url: DELETE_ADDRESS_URL,
        qs: {
            clientId: clientId,
            addressId: addressId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 204) {
            logger.error("deleteAddress(): error", response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "deleteAddressFailed",
                        message: "Failed to delete address"
                    }
                });
            }
            return;
        }

        logger.debug("deleteAddress(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });

    return deferred.promise;
}

function validateEmail(email) {
    var deferred = Q.defer();

    if (STRIKEIRON_VALIDATE) {
        request.get({
            url: STRIKEIRON_EMAIL_URL,
            qs: {
                "LicenseInfo.RegisteredUser.UserID": STRIKEIRON_EMAIL_LICENSE,
                "VerifyEmail.Email": email,
                "VerifyEmail.Timeout": STRIKEIRON_EMAIL_TIMEOUT,
                "format": "json"
            },
            headers: {
                'Accept': 'application/json, text/json'
            },
            json: true
        }, function (error, response, body) {
            logger.debug("validateEmail()", error, response ? response.statusCode: null, body);
            if (error || response.statusCode != 200) {
                logger.error("validateEmail(): error", error, response ? response.statusCode: null, body);
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "validateEmailAddressFailed",
                        message: "Unknown error while validating email address"
                    }
                });
                return;
            }

            /**
             * { "WebServiceResponse":
             * {
             *   "@xmlns":"http://ws.strikeiron.com",
             *   "SubscriptionInfo":{
             *      "@xmlns":"http://ws.strikeiron.com",
             *      "LicenseStatusCode":"0",
             *      "LicenseStatus":"Valid license key",
             *      "LicenseActionCode":"0",
             *      "LicenseAction":"Decremented hit count",
             *      "RemainingHits":"999884804",
             *      "Amount":"0"
             *    },
             *    "VerifyEmailResponse":{
             *      "@xmlns":"http://www.strikeiron.com/",
             *      "VerifyEmailResult":{
             *        "ServiceStatus":{
             *          "StatusNbr":"200",
             *          "StatusDescription":"Email Valid"
             *        },
             *        "ServiceResult":{
             *          "Reason":{
             *            "Code":"201",
             *            "Description":"Mailbox Confirmed"
             *          },
             *          "HygieneResult":"Safe US",
             *          "NetProtected":"false",
             *          "NetProtectedBy":null,
             *          "SourceIdentifier":null,
             *          "Email":"arimus@gmail.com",
             *          "LocalPart":"arimus",
             *          "DomainPart":"gmail.com",
             *          "IronStandardCertifiedTimestamp":"2014-10-04T01:45:41.587",
             *          "DomainKnowledge":null,
             *          "AddressKnowledge":{
             *            "StringKeyValuePair":{
             *              "Key":"Cached",
             *              "Value":"true"
             *            }
             *          }
             *        }
             *      }
             *    }
             *  }
             *}
             */

            logger.debug("validateEmail(): body", body, body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult);

            if (body && body.WebServiceResponse && body.WebServiceResponse.VerifyEmailResponse &&
                body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult &&
                body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus &&
                body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus.StatusNbr)
            {
                var statusNbr = parseInt(body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus.StatusNbr);
                logger.debug("validateEmail(): statusNbr", statusNbr);

                if (statusNbr == 310 || statusNbr == 311 || statusNbr == 200 || statusNbr == 202 || statusNbr == 203 || statusNbr == 210 || statusNbr == 260) {
                    logger.debug("validateEmail(): valid");
                    deferred.resolve({
                        status: 200,
                        result: body
                    });
                    return;
                }
            }

            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "invalidEmailAddress",
                    message: "Invalid email address"
                }
            });
        });
    } else {
        logger.debug("validateEmail(): not validating");
        deferred.resolve({
            status: 200,
            result: {}
        });
    }


    return deferred.promise;
}

function validateAddress(address) {
    logger.debug("validateAddress()", address);
    var deferred = Q.defer();

    var options = {
        ignoredNamespaces: {
            namespaces: ['q1', 'q2']
        }
    }

    try {
        soap.createClient(STRIKEIRON_ADDRESS_SOAP_URL, options, function(err, client) {
            var userId = STRIKEIRON_ADDRESS_LICENSE;

            logger.debug("license", userId);

            client.addSoapHeader({LicenseInfo: {RegisteredUser: {UserID: userId}}});

            client.NorthAmericanAddressVerification({
                "AddressLine1":address.address1,
                "AddressLine2":address.address2,
                "CityStateOrProvinceZIPOrPostalCode":address.city + " " + address.state + " " + address.zip,
                "Country":address.country,
                "Casing":"PROPER"
            }, function (error, response) {
                logger.debug("validateAddress(): response", error);
                if (error || response.NorthAmericanAddressVerificationResult.ServiceStatus.StatusNbr != 200) {
                    logger.error("validateAddress(): error", error, "response", response);
                    deferred.reject({
                        status: 500,
                        result: {
                            statusCode: 500,
                            errorCode: "validateAddressFailed",
                            message: response.NorthAmericanAddressVerificationResult.ServiceStatus.StatusDescription
                        }
                    });
                    return;
                }
                /**
                 * 200 Found
                 210 The batch operation completed successfully
                 211 The batch verification operation completed with
                 partial success
                 304 Address Not Found
                 305 Address is ambiguous
                 310 The batch operation was unsuccessful
                 401 At least one address required for batch operation.
                 402 City or ZIP Code is Invalid
                 500 Internal Error
                 */
                if (response && response.NorthAmericanAddressVerificationResult &&
                    response.NorthAmericanAddressVerificationResult.ServiceResult &&
                    response.NorthAmericanAddressVerificationResult.ServiceResult.USAddress &&
                    response.NorthAmericanAddressVerificationResult.ServiceStatus.StatusNbr == 200)
                {
                    logger.debug("validateAddress(): success", response.NorthAmericanAddressVerificationResult.ServiceResult.USAddress);

                    /**
                     * State, Urbanization, ZIPPlus4, ZIPCode, ZIPAddOn, CarrierRoute, PMB, PMBDesignator,
                     * DeliveryPoint, DPCheckDigit, LACS, CMRA, DPV, DPVFootnote, RDI, RecordType,
                     * CongressDistrict, County, CountyNumber, StateNumber, GeoCode
                     */
                    //logger.debug("getClient(): success", body);

                    var usAddress = response.NorthAmericanAddressVerificationResult.ServiceResult.USAddress;

                    var address1 = "";
                    if (usAddress.RecordType != 'P') {
                        address1 += usAddress.StreetNumber.length > 0 ? usAddress.StreetNumber + " " : "";
                        address1 += usAddress.PreDirection.length > 0 ? usAddress.PreDirection + " " : "";
                        address1 += usAddress.StreetName.length > 0 ? usAddress.StreetName + " " : "";
                        address1 += usAddress.StreetType.length > 0 ? usAddress.StreetType + " " : "";
                        address1 += usAddress.PostDirection.length > 0 ? usAddress.PostDirection + " " : "";
                        address1 = address1.trim();
                    } else {
                        // PO Box
                        address1 += usAddress.StreetName.length > 0 ? usAddress.StreetName + " " : "";
                        address1 += usAddress.StreetNumber.length > 0 ? usAddress.StreetNumber + " " : "";
                        address1 = address1.trim();
                    }

                    // in some cases, PO box comes back as addressline1, so use that if it's available and
                    // the alternative isn't
                    if (address1 == "" && usAddress.AddressLine1 != null) {
                        address1 = usAddress.AddressLine1;
                    }

                    var address2 = "";
                    address2 += usAddress.Extension.length > 0 ? usAddress.Extension + " " : "";
                    address2 += usAddress.ExtensionNumber.length > 0 ? usAddress.ExtensionNumber + " " : "";
                    address2 = address2.trim();

                    var a = {
                        name: address.name,
                        address1: address1,
                        address2: address2,
                        city: usAddress.City.length > 0 ? usAddress.City : "",
                        county: usAddress.County.length > 0 ? usAddress.County : "",
                        state: usAddress.State.length > 0 ? usAddress.State : "",
                        stateDescription: usAddress.State.length > 0 ? usAddress.State : "",
                        zip: usAddress.ZIPCode.length > 0 ? usAddress.ZIPCode : "",
                        country: "US",
                        geocode: "000000",
                        phone: address.phone
                    };
                    logger.debug("validateAddress(): returning address", a);

                    deferred.resolve({
                        status: 200,
                        result: a
                    });
                } else {
                    logger.error("validateAddress(): result was not expected", result);

                    deferred.reject({
                        status: 500,
                        result: {
                            statusCode: 500,
                            errorCode: "invalidAddress",
                            message: "Invalid Address"
                        }
                    });
                }
            });
        });
    } catch (ex) {
        deferred.reject({
            status: 500,
            result: {
                statusCode: 500,
                errorCode: "errorValidatingAddress",
                message: "Error while validating address"
            }
        });
    }
    return deferred.promise;
}

//2451 Townsgate Rd., Westlake Village 91361

function getCreditCards(clientId) {
    //logger.debug("getCreditCards()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_CREDIT_CARDS_URL,
        qs: {
            clientId: clientId
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
            logger.error("getCreditCards(): error", error, response ? response.statusCode: null, body);
            deferred.reject({error: error, response: response, body: body});
            return;
        }
        //logger.debug("getCreditCards(): success", body);
        deferred.resolve({
            status: response ? response.statusCode : 500,
            result: body
        });
    });

    return deferred.promise;
}

function getCreditCard(clientId, creditCardId) {
    //logger.debug("getCreditCard()", clientId);
    var deferred = Q.defer();

    request.get({
        url: GET_CREDIT_CARD_URL,
        qs: {
            clientId: clientId,
            cardId: creditCardId
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
            logger.error("getCreditCard(): error", error, response ? response.statusCode: null, body);
            deferred.reject({error: error, response: response, body: body});
        }
        //logger.debug("getCreditCard(): success", body);
        deferred.resolve({response: response, body: body});
    });

    return deferred.promise;
}

function createCreditCard(clientId, data) {
    //logger.debug("createCreditCard", email, password);
    var deferred = Q.defer();

    request.post({
        url: CREATE_CREDIT_CARD_URL,
        qs: {
            clientId: clientId
        },
        form: {
            "valToDecrypt": data
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 201) {
            logger.error("createCreditCard(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createCreditCardFailed",
                        message: "Failed to create credit card"
                    }
                });
            }
            return;
        }

        if (body == null || body.id == null) {
            logger.debug("createCreditCard(): invalid return data", body, typeof body, "creditCardId", body.creditCardId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "createCreditCardReturnDataInvalid",
                    message: "Failed to get credit card ID from create"
                }
            });
            return;
        }

        // we should get creditCardId back
        deferred.resolve({
            status: 201,
            result: body
        });
    });

    return deferred.promise;
}

function updateCreditCard(clientId, creditCardId, data) {
    //logger.debug("updateCreditCard", email, password);
    var deferred = Q.defer();

    request.post({
        url: UPDATE_CREDIT_CARD_URL,
        qs: {
            clientId: clientId,
            cardId: creditCardId
        },
        form: {
            "valToDecrypt": data
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 201) {
            logger.error("updateCreditCard(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "updateCreditCardFailed",
                        message: "Failed to update credit card"
                    }
                });
            }
            return;
        }

        if (body == null || body.id == null) {
            logger.debug("updateCreditCard(): invalid return data", body, typeof body, "creditCardId", body.creditCardId);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "updateCreditCardReturnDataInvalid",
                    message: "Failed to get credit card ID from update"
                }
            });
            return;
        }

        // we should get creditCardId back
        deferred.resolve({
            status: 200,
            result: body
        });
    });

    return deferred.promise;
}

function deleteCreditCard(clientId, creditCardId) {
    logger.debug("deleteCreditCard", clientId, creditCardId);
    var deferred = Q.defer();

    request.del({
        url: DELETE_CREDIT_CARD_URL,
        qs: {
            clientId: clientId,
            cardId: creditCardId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 204) {
            logger.error("deleteCreditCard(): error", response ? response.statusCode: null, body);

            if (body && body.statusCode && body.errorCode && body.message && response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "deleteCreditCardFailed",
                        message: "Failed to delete creditCard"
                    }
                });
            }
            return;
        }

        logger.debug("deleteCreditCard(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });

    return deferred.promise;
}

function getGeocodes(zipCode) {
    logger.debug("getGeocodes()", zipCode);
    var deferred = Q.defer();

    request.get({
        url: GET_GEOCODES_URL,
        qs: {
            MEN_H: "JNS0007X",
            zipCode_h: zipCode
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        try {
            logger.debug("getGeocodes()", error, response ? response.statusCode: null, body);
            if (error || response == null || response.statusCode != 200) {
                logger.error("getGeocodes(): error", error, response ? response.statusCode: null, body);
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
                return;
            }

            /* Example:
            <?xml version="1.0" encoding='iso-8859-1'?>
            <VERTEX>
                <VERTEXLIST>
                    <LIST ZIPCODE = "91361" GEOCODE = "050377000" CITYCODE = "" CITYDES = "WESTLAKE VILLAGE" COUNTYCODE = "" COUNTYDES = "LOS ANGELES" STATECODE = "CA" STATEDES = "CALIFORNIA" ZIPSTART = "91361" ZIPEND = "91361" ERROR = ""></LIST>
                    <LIST ZIPCODE = "91361" GEOCODE = "051113590" CITYCODE = "" CITYDES = "THOUSAND OAKS" COUNTYCODE = "" COUNTYDES = "VENTURA" STATECODE = "CA" STATEDES = "CALIFORNIA" ZIPSTART = "91361" ZIPEND = "91361" ERROR = ""></LIST>
                    <LIST ZIPCODE = "91361" GEOCODE = "051113590" CITYCODE = "" CITYDES = "WESTLAKE VILLAGE" COUNTYCODE = "" COUNTYDES = "VENTURA" STATECODE = "CA" STATEDES = "CALIFORNIA" ZIPSTART = "91361" ZIPEND = "91361" ERROR = ""></LIST>
                </VERTEXLIST>
            </VERTEX>
            */

            // parse the list of geocodes
            parseString(body, function (err, result) {
                logger.debug("err", err, "result", result);

                if (err) {
                    logger.debug("getGeocodes(): failure");
                    deferred.reject({
                        status: 500,
                        result: {
                            statusCode: 500,
                            errorCode: "geocodeListFailed",
                            message: "Failed to list geocodes"
                        }
                    });
                    return;
                }

                if (result && result.VERTEX && Array.isArray(result.VERTEX.VERTEXLIST)) {
                    var list = result.VERTEX.VERTEXLIST[0].LIST;
                    var cities = [];
                    for (var i=0; i < list.length; i++) {
                        cities.push(list[i]["$"]);
                    }

                    logger.debug("getGeocodes(): success");
                    deferred.resolve({
                        status: 200,
                        result: cities
                    });
                    return;
                }

                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "geocodeListFailed",
                        message: "Failed to list geocodes"
                    }
                });
            });
        } catch (ex) {
            logger.error("getGeocodes(): error", ex);
        }
    })

    return deferred.promise;
}

function calculateSalesTax(data) {
    /*
     {
         "clientId":<clientId>,   //Required in CD OE
         "consultantId":<consultantId>, //Required
         "geocode" : <geocode>,         //Required
         "typeOrder": <tipeOrder>,      //Required
         "source"   : <source>          //Required
         "products" : []                //Required
     }
     */

    logger.debug("getCalculateTax()", data);
    logger.debug("getCalculateTax(): products",JSON.stringify(data.products));
    var deferred = Q.defer();

    request.post({
        url: GET_SALES_TAX_URL,
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        form: {
            clientId: data.clientId,
            consultantId: data.consultantId,
            geocode: data.geocode,
            typeOrder: data.typeOrder,
            source: data.source,
            products: JSON.stringify(data.products)
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("getCalculateTax()", error, response ? response.statusCode: null, body);
        if (error || response == null || response.statusCode != 200) {
            logger.error("getCalculateTax(): error", error, response ? response.statusCode: null, body);
            deferred.reject({
                status: response ? response.statusCode : 500,
                result: {
                    statusCode: response ? response.statusCode : 500,
                    errorCode: body.errorCode ? body.errorCode : "unknownError",
                    message: body.message ? body.message : "Unknown Error"
                }
            });
            return;
        }

        /* Example:
         {
         "SubTotal": 10.50,
         "SH": 5.00,
         "TaxRate": 10.50,
         "TotalBeforeTax": 15.50,
         "TaxAmount": 2.25,
         "Total": 17.75
         }
         */

        logger.debug("getCalculateTax(): success", body);
        deferred.resolve({
            status: 200,
            result: body
        });
        return;
    })

    return deferred.promise;
}

function requestPasswordReset(email, language) {
    logger.debug("requestPasswordReset()", email, language);
    var deferred = Q.defer();

    if (!email || !language) {
        deferred.reject({
            status: 500,
            result: {
                statusCode: 500,
                errorCode: "passwordResetRequestFailed",
                message: "Failed to request password reset"
            }
        });
        return;
    }

    var now = new Date();
    var mustBeOlderThan = new Date(now.getTime() - PASSWORD_RESET_INTERVAL);

    // make sure this user hasn't done a password reset in past N minutes
    models.PasswordResetToken.find({email: email, created: {$gt: mustBeOlderThan}}, function(err, tokens) {
        if (err) {
            logger.error("failed to lookup password reset token", err);
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "passwordResetRequestFailed",
                    message: "Failed to request password reset"
                }
            });
            return;
        }

        if (tokens && tokens.length > 0) {
            logger.error("password reset requested too soon", tokens);
            deferred.reject({
                status: 409,
                result: {
                    statusCode: 409,
                    errorCode: "passwordResetTokenAlreadyCreated",
                    message: "Password reset request for account too soon (try again later)"
                }
            });
            return;
        }

        var token = randomString({length: 32});

        mongoose.model('PasswordResetToken').create({
            email: email,
            language: language,
            token: token
        }, function(error, user) {
            if (error) {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "passwordResetRequestFailed",
                        message: "Failed to request password reset"
                    }
                });
                return;
            }

            logger.debug('requestPasswordReset(): created password reset token for ' + email);

            request.post({
                url: PASSWORD_RESET_REQUEST_URL,
                form: {
                    email: email,
                    token: token,
                    url: config.password_reset_url,
                    language: language
                },
                headers: {
                    'Content-Type' : 'application/x-www-form-urlencoded',
                    'Accept': 'application/json, text/json',
                    'Authorization': AUTH_STRING
                },
                agentOptions: agentOptions,
                strictSSL: false,
                json: true
            }, function (error, response, body) {
                logger.debug("requestPasswordReset(): body", body);

                if (error || response == null || response.statusCode != 204) {
                    logger.error("requestPasswordReset(): error", error, response ? response.statusCode : null, body);
                    deferred.reject({
                        status: 500,
                        result: {
                            statusCode: 500,
                            errorCode: "passwordResetRequestFailed",
                            message: "Failed to request password reset"
                        }
                    });
                    return;
                }

                deferred.resolve({
                    status: 204,
                    result: null
                });
            });
        });
    });

    return deferred.promise;
}

function requestPasswordChange(email, password, token) {
    logger.debug("requestPasswordChange()", email, token);
    var deferred = Q.defer();

    var now = new Date();
    var cantBeOlderThan = new Date(now.getTime() - PASSWORD_RESET_INTERVAL);

    models.PasswordResetToken.find({email: email, token: token, created: {$gt: cantBeOlderThan}}, function(err, tokens) {
        if (err) {
            logger.error("requestPasswordChange(): failed to lookup password reset token", err);
            deferred.reject({
                status: 500, result: {
                    statusCode: 500,
                    errorCode: "passwordResetRequestFailed",
                    message: "Failed to request password reset"
                }
            });
            return;
        }

        if (tokens && tokens.length > 0) {
            logger.debug("requestPasswordChange(): found token", token);
            request.post({
                url: PASSWORD_RESET_CHANGE_URL,
                form: {
                    email: email,
                    password: password
                }, headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json, text/json',
                    'Authorization': AUTH_STRING
                }, agentOptions: agentOptions, strictSSL: false, json: true
            }, function (error, response, body) {
                logger.debug("requestPasswordChange(): body", body);

                if (error || response == null || response.statusCode != 204) {
                    logger.error("requestPasswordChange(): error", error, response ? response.statusCode : null, body);
                    deferred.reject({
                        status: 500, result: {
                            statusCode: 500,
                            errorCode: "passwordResetChangeFailed",
                            message: "Failed to change password"
                        }
                    });
                    return;
                }

                deferred.resolve({
                    status: 204, result: null
                });
            });
        } else {
            logger.error("requestPasswordChange(): no token found");

            deferred.reject({
                status: 500, result: {
                    statusCode: 500,
                    errorCode: "passwordResetTokenExpired",
                    message: "Password Reset token expired"
                }
            });
        }
    });

    return deferred.promise;
}

function getInventory(inventoryId) {
    //logger.debug("getInventory()", inventoryId);
    var deferred = Q.defer();

    request.get({
        url: GET_INVENTORY_URL,
        qs: {
            inventoryId: inventoryId
        },
        headers: {
            'Accept': 'application/json, text/json',
            'Authorization': AUTH_STRING
        },
        agentOptions: agentOptions,
        strictSSL: false,
        json: true
    }, function (error, response, body) {
        logger.debug("getInventory()", error, response ? response.statusCode: null, body);
        if (error || response == null | response.statusCode != 200) {
            logger.error("getInventory(): error", error, response ? response.statusCode: null, body);
            if (response && response.statusCode) {
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });            } else {
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "getInventoryInvalidResponse",
                        message: "Failed to get inventory"
                    }
                });
            }
            return;
        }

        if (body.availableInventory != null) {
            //logger.debug("getInventory(): success", body);
            deferred.resolve({
                status: 200,
                result: {
                    isAvailable: (body.availableInventory >= MIN_INVENTORY)
                }
            });
        } else {
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "inventoryLoadFailed",
                    message: "Failed to load inventory"
                }
            });
        }
    });

    return deferred.promise;
}

function getConfigValue(key) {
    var deferred = Q.defer();
    models.Config.findOne({_id: key}).exec(function (err, config) {
        if (err) {
            logger.error("getConfigValue(): error", error, response ? response.statusCode : null);
            deferred.reject(err);
            return;
        }
        if (!config) {
            deferred.resolve(null);
        } else {
            deferred.resolve(config.value);
        }
    });
    return deferred.promise;
}

function updateInventory(noProcessing) {
    logger.debug("updateInventory()", noProcessing);
    var deferred = Q.defer();
    var now = new Date();
    var HOURS_24 = moment.duration(24, "hours");
    var HOURS_24_AGO = moment().subtract(HOURS_24);

    // FIXME - don't update everything if the inventory hasn't changed.

    getConfigValue("inventoryLastUpdated").then(function(lastUpdated) {
        logger.debug("getAllInventory(): inventory lastUpdated", moment.unix(lastUpdated).toDate(), "now", now, "24 hours ago", HOURS_24_AGO.toDate());

        // if we have lastUpdated and it's less than 24 hours ago, do a fetch to the DB
        if (lastUpdated != null && (moment.unix(lastUpdated).isAfter(HOURS_24_AGO) || FORCE_INVENTORY_CACHE)) {
            // we need to update again
            logger.debug("getAllInventory(): fetching inventory from the database");

            models.Inventory.find({}).exec(function (err, inventoryItems) {
                if (err) {
                    logger.error("getAllInventory(): error fetching inventory from database");
                    deferred.reject(err);
                    return;
                }

                var inventory = {};
                for (var i=0; i < inventoryItems.length; i++) {
                    var inventoryItem = inventoryItems[i];
                    inventory[inventoryItem._id] = inventoryItem.available;
                }

                if (!noProcessing) {
                    logger.debug("getAllInventory(): processing");
                    processAvailabilityAndHiddenProducts(inventory).then(function (inventory) {
                        deferred.resolve(inventory);
                    }, function (err) {
                        logger.error("getAllInventory(): processAvailabilityAndHiddenProducts(): error", err);
                        deferred.reject(err);
                    })
                } else {
                    deferred.resolve(inventory);
                }
            });

        // else fetch from the server
        } else {
            logger.debug("getAllInventory(): fetching inventory from JCS");
            request.get({
                url: GET_ALL_INVENTORY_URL,
                headers: {
                    'Accept': 'application/json, text/json', 'Authorization': AUTH_STRING
                },
                agentOptions: agentOptions,
                strictSSL: false,
                json: true
            }, function (error, response, body) {
                logger.debug("getAllInventory()", error, response ? response.statusCode : null, body);
                if (error || response == null || response.statusCode != 200) {
                    logger.error("getAllInventory(): error", error, response ? response.statusCode : null, body);

                    // just load inventory from DB anyways & process
                    models.Inventory.find({}).exec(function (err, inventoryItems) {
                        if (err) {
                            logger.error("getAllInventory(): error fetching inventory from database");
                            deferred.reject(err);
                            return;
                        }

                        var inventory = {};
                        for (var i=0; i < inventoryItems.length; i++) {
                            var inventoryItem = inventoryItems[i];
                            inventory[inventoryItem._id] = inventoryItem.available;
                        }

                        if (!noProcessing) {
                            logger.debug("getAllInventory(): processing");
                            processAvailabilityAndHiddenProducts(inventory).then(function (inventory) {
                                deferred.resolve(inventory);
                            }, function (err) {
                                logger.error("getAllInventory(): processAvailabilityAndHiddenProducts(): error", err);
                                deferred.reject(err);
                            })
                        } else {
                            deferred.resolve(inventory);
                        }
                    });
                    return;
                }

                if (body && body.inventory != null) {
                    var count = 0;
                    var updated = 0;
                    for (var key in body.inventory) {
                        if (body.inventory.hasOwnProperty(key)) {
                            count++;
                        }
                    }

                    // set everything to 0
                    models.Inventory.update({}, {available:0}, {multi: true}, function (err, numAffected, rawResponse) {
                        if (err) return logger.error("getAllInventory(): error resetting inventory", key, err);

                        // now update inventories with response values
                        for (var key in body.inventory) {
                            models.Inventory.update({_id: key}, {available: body.inventory[key]}, {upsert: true}, function (err, numAffected, rawResponse) {
                                if (err) return logger.error("getAllInventory(): error updating inventory", key, err);
                                //logger.debug("getAllInventory(): updated inventory for", key, "to", body.inventory[key]);
                                updated++;

                                // once we've saved everything, update the config lastUpdated timestamp
                                if (count == updated) {
                                    // save last updated to config
                                    var d = moment.unix(body.lastUpdated);
                                    models.Config.update({_id: "inventoryLastUpdated"}, {value: body.lastUpdated}, {upsert: true}, function (err, numAffected, rawResponse) {
                                        if (err) {
                                            return logger.error("getAllInventory(): error saving lastUpdated", err);
                                            deferred.reject(err);
                                            return;
                                        }
                                        logger.debug("getAllInventory(): saved inventory lastUpdated", body.lastUpdated, d.toDate());

                                        if (!noProcessing) {
                                            logger.debug("getAllInventory(): processing inventory", JSON.stringify(body.inventory));
                                            processAvailabilityAndHiddenProducts(body.inventory).then(function (inventory) {
                                                deferred.resolve(inventory);
                                            }, function (err) {
                                                logger.error("getAllInventory(): processAvailabilityAndHiddenProducts(): error", err);
                                                deferred.reject(err);
                                            })
                                        } else {
                                            deferred.resolve(body.inventory);
                                        }
                                    });
                                }
                            });
                        }
                    });
                } else {
                    logger.error("getAllInventory(): invalid inventory body");
                    deferred.reject("invalid inventory body");
                }
            });
        }
    }, function(err) {
        logger.error("updateInventory(): error getting config", error, response ? response.statusCode : null);
        deferred.reject(err);
    });

    return deferred.promise;
}

function processAvailabilityAndHiddenProducts(allInventory, ids) {
    var deferred = Q.defer();
    var now = new Date();

    var query = {};
    if (ids) {
        if (!Array.isArray(ids)) {
            ids = [ids];
        }
        query = {_id:{$in:ids}}
    }

    // fetch all products, groups and kits to calculate availability
    models.Product.find(query).populate({
        path: 'contains.product',
        model: 'Product'
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup'
    }).exec(function (err, products) {
        if (err) {
            logger.error("processAvailabilityAndHiddenProducts(): error getting products", err);
            deferred.reject(err);
            return;
        }

        var opts = {
            path: 'kitGroups.kitGroup.components.product',
            model: 'Product'
        }

        // FIXME - save kitGroup product IDs and component product IDs, so we have them when populate wipes them out (already done in scraper)

        // populate components
        models.Product.populate(products, opts, function (err, products) {

            logger.debug("processAvailabilityAndHiddenProducts(): loaded products for inventory calculation");
            var finalInventory = {};

            // check orders since last inventory update to subtract from the availableInventory
            getConfigValue("inventoryLastUpdated").then(function(lastUpdated) {
                logger.debug("getAllInventory(): inventory lastUpdated", lastUpdated);

                var orderHistoryComplete = Q.defer();

                var deductFromInventory = {};
                // if we have lastUpdated and it's less than 24 hours ago, do a fetch to the DB
                if (lastUpdated != null) {
                    var lastUpdatedDate = moment.unix(lastUpdated).toDate();
                    logger.debug("processAvailabilityAndHiddenProducts(): merging order history since", lastUpdatedDate);

                    models.OrderHistory.find({
                        created: {$gte: lastUpdatedDate}
                    }).populate({
                        path: 'products.product',
                        model: 'Product'
                    }).exec(function (err, orderHistoryItems) {
                        //logger.debug("processAvailabilityAndHiddenProducts(): processing updates for product", product.id, updates);
                        if (err) {
                            logger.error("processAvailabilityAndHiddenProducts(): error updating product inventory", err);
                            deferred.reject(err);
                            return;
                        }

                        var opts = {
                            path: 'products.product.contains.product',
                            model: 'KitGroup'
                        };

                        models.Product.populate(orderHistoryItems, opts, function (err, orderHistoryItems) {
                            if (!orderHistoryItems) {
                                orderHistoryItem = [];
                            }
                            logger.debug("processAvailabilityAndHiddenProducts(): have", orderHistoryItems.length, "orderHistoryItems");

                            if (err) {
                                logger.error("processAvailabilityAndHiddenProducts(): error updating product inventory", err);
                                deferred.reject(err);
                                return;
                            }

                            // we need to remove the order amount for this product from the available
                            for (var k = 0; k < orderHistoryItems.length; k++) {
                                var orderHistoryItem = orderHistoryItems[k];
                                for (var l = 0; l < orderHistoryItem.products.length; l++) {
                                    var p = orderHistoryItem.products[l];

                                    // deduct this item
                                    deductFromInventory[p.sku] = deductFromInventory[p.sku] ? deductFromInventory[p.sku] + 1 : 1;
                                    logger.debug("processAvailabilityAndHiddenProducts(): deducting for purchased item", p.sku);

                                    /**
                                     *        {
                                            "sku" : "19376",
                                            "qty" : 1,
                                            "kitSelections" : {
                                                "NUPL193761" : [
                                                    {
                                                        "name" : "Amor - Full Coverage Lipstick",
                                                        "sku" : "15602"
                                                    }
                                                ],
                                                "NUPL19376" : [
                                                    {
                                                        "name" : "Black - Eye Pencil",
                                                        "sku" : "15730"
                                                    }
                                                ]
                                            },
                                            "product" : "19376",
                                            "_id" : ObjectId("5482a3613e8b4d00007df2ac")
                                        }
                                     */
                                    if (p.product != null) {
                                        for (var m = 0; m < p.product.contains.length; m++) {
                                            var c = p.product.contains[m];
                                            deductFromInventory[c.productId] = deductFromInventory[c.productId] ? deductFromInventory[c.productId] + 1 : 1;
                                            logger.debug("processAvailabilityAndHiddenProducts(): deducting for purchased item contains", p.sku, "->", c.productId);
                                        }
                                        for (var key in p.kitSelections) {
                                            if (p.kitSelections.hasOwnProperty(key)) {
                                                var items = p.kitSelections[key];
                                                for (var n = 0; n < items.length; n++) {
                                                    var item = items[n];
                                                    deductFromInventory[item.sku] = deductFromInventory[item.sku] ? deductFromInventory[item.sku] + 1 : 1;
                                                    logger.debug("processAvailabilityAndHiddenProducts(): deducting for purchased item kitGroup component", p.sku, "->", item.sku);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            logger.debug("processAvailabilityAndHiddenProducts(): orderHistoryComplete");
                            orderHistoryComplete.resolve();
                        });
                    });
                } else {
                    orderHistoryComplete.resolve();
                }

                // wait for order history to be complete if available
                orderHistoryComplete.promise.then(function() {
                    try {
                        // first, let's order processing of products best we can to shove dependencies earlier into the list

                        //// build a map of deps for each product, which may affect it's inventory
                        //logger.debug("processAvailabilityAndHiddenProducts(): building product dep map");
                        //var productDeps = [];
                        //var productMap = {};
                        //for (var i = 0; i < products.length; i++) {
                        //    var product = products[i];
                        //    productMap[product.id] = product;
                        //    var deps = [];
                        //    if (product.contains) {
                        //        for (var j=0; j < product.contains.length; j++) {
                        //            productDeps.push([product.id, product.contains[j].product]);
                        //        }
                        //    }
                        //    if (product.kitGroups) {
                        //        for (var j=0; j < product.kitGroups.length; j++) {
                        //            var kitGroup = product.kitGroups[j];
                        //            if (kitGroup.kitGroup && kitGroup.kitGroup.components) {
                        //                for (var k = 0; k < kitGroup.kitGroup.components.length; k++) {
                        //                    var component = kitGroup.kitGroup.components[k];
                        //                    productDeps.push([product.id, component.product]);
                        //                }
                        //            }
                        //        }
                        //    }
                        //}
                        //
                        //// do the topological sort for deps, so we fetch items depended on before those
                        //logger.debug("processAvailabilityAndHiddenProducts(): processing product dep map");
                        //var sortedDeps = toposort(productDeps).reverse();
                        //logger.debug("processAvailabilityAndHiddenProducts(): product deps", sortedDeps);
                        //var productsSorted = [];
                        //for (var i = 0; i < sortedDeps; i++) {
                        //    var id = sortedDeps[i];
                        //    var product = productMap[id]
                        //    productsSorted.push(product);
                        //}
                        //products = productsSorted;

                        var updateCount = 0;
                        for (var i = 0; i < products.length; i++) {
                            var product = products[i];
                            logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "type", product.type);

                            var availableInventory = allInventory[product.id] != null ? allInventory[product.id] : -1;
                            var unavailableComponents = false;
                            var fixedComponentInventoryDepleted = false;
                            var updates = {};
                            logger.debug("processAvailabilityAndHiddenProducts(): product", product.id,"availability after first check", availableInventory);

                            var groupHasComponentWithInventory = false;
                            var groupHasAvailableComponent = false;

                            // ensure all the product contains for a kit have inventory, else mark as no inventory
                            // inventory for a group is the sum of all inventories for items inside
                            if (product.contains && product.contains.length > 0) {
                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "contains", product.contains.length, "products");
                                var availableCount = null;

                                for (var j = 0; j < product.contains.length; j++) {
                                    updates["contains." + j + ".unavailable"] = false;
                                    var c = product.contains[j];
                                    //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "contains", j, c);

                                    if (c.product != null) {
                                        var p = c.product;
                                        allInventory[p._id] = allInventory[p._id] ? allInventory[p._id] : 0;
                                        updates["contains." + j + ".availableInventory"] = allInventory[p._id];

                                        // if there are no components left, then there is no inventory
                                        if (allInventory[p._id] <= MIN_INVENTORY && product.type != "group") {
                                            logger.debug("processAvailabilityAndHiddenProducts(): product", product.id,"availability for fixed component <= MIN_INVENTORY", allInventory[p._id]);
                                            availableCount = 0;
                                            availableInventory = 0;
                                            fixedComponentInventoryDepleted = true;
                                            break;
                                        } else if (product.type == "group") {
                                            groupHasComponentWithInventory = true;
                                        }

                                        // determine inventory availability for the parent product based on lowest inventory of children
                                        //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "availability of item", p.id,"is", allInventory[p._id]);

                                        if (product.type == "kit") {
                                            if (availableCount != null && allInventory[p._id] > 0) {
                                                // our availability is the availability of the least available item
                                                availableCount = allInventory[p._id] < availableCount ? allInventory[p._id] : availableCount;
                                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id,"availability after contains check", availableCount, "component", p._id,"inventory", allInventory[p._id]);
                                            } else if (availableCount == null) {
                                                availableCount = allInventory[p._id];
                                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id,"availability after contains check", availableCount, "component", p._id,"inventory", allInventory[p._id]);
                                            }
                                        }

                                        // mark products as available/unavailable based on contains group / kits statuses
                                        // contains only products that are available status "A" and type "R" or "B"
                                        if ((p.masterStatus == "A" || p.masterStatus == "T") && (p.masterType == "R" || p.masterType == "B" || product.type == "group")) {
                                            // products leave alone

                                            // mark onhold components as unavailable, even if everything else is correct
                                            if (p.onHold == true) {
                                                updates["contains." + j + ".unavailable"] = true;
                                            // groups add to count
                                            } else if (product.type == "group") {
                                                // only if product in the group is available do we add to the sum for of inventories for product in a group
                                                availableCount += allInventory[p._id];
                                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id,"availability after contains added", availableCount);

                                                //logger.debug("processAvailabilityAndHiddenProducts(): product group", product.id, "component", p._id, "not on hold");
                                                groupHasAvailableComponent = true;
                                            }
                                        } else {
                                            //logger.debug("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because contained product", p.id, "is unavailable");
                                            updates["contains." + j + ".unavailable"] = true;
                                            if (product.type != "group") {
                                                unavailableComponents = true;
                                            }
                                        }
                                    } else {
                                        //logger.debug("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because contained product", p.id, "is not found");
                                        updates["contains." + j + ".unavailable"] = true;
                                        if (product.type != "group") {
                                            unavailableComponents = true;
                                        }
                                    }
                                }

                                if (product.type == "kit") {
                                    availableInventory = availableCount && (availableInventory == -1 || availableCount < availableInventory) ? availableCount : availableInventory;
                                } else {
                                    availableInventory = availableCount ? availableCount : 0;
                                }
                                logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "this product inventory", allInventory[p._id], "availableCount", availableCount, "availability after contains check", availableInventory);
                            }

                            if (product.type == "group") {
                                if (!groupHasComponentWithInventory) {
                                    logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "has no component with inventory");
                                    availableCount = 0;
                                    availableInventory = 0;
                                    fixedComponentInventoryDepleted = true;
                                }

                                // group has no available components, so it should be unavailable
                                if (!groupHasAvailableComponent || product.contains == null || product.contains.length == 0) {
                                    logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "is a group with no components");
                                    unavailableComponents = true;
                                }
                            }

                            // set unavailable for upsell items
                            if (product.upsellItems && product.upsellItems.length > 0) {
                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "upsellItems", product.upsellItems.length, "products");
                                var availableCount = null;

                                for (var j = 0; j < product.upsellItems.length; j++) {
                                    updates["upsellItems." + j + ".unavailable"] = false;
                                    var c = product.upsellItems[j];
                                    //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "upsellItems", j, c);

                                    if (c.product != null) {
                                        var p = c.product;

                                        // mark products as available/unavailable based on upsellItems group / kits statuses
                                        // upsellItems only products that are available status "A" and type "R" or "B"
                                        if (p.masterStatus == "A" && p.onHold == false && (p.masterType == "R" || p.masterType == "B" || p.masterType == null || type == "group")) {
                                            // nothing
                                        } else {
                                            //logger.debug("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because upsellItemed product", p.id, "is unavailable");
                                            updates["upsellItems." + j + ".unavailable"] = true;
                                        }
                                    } else {
                                        //logger.debug("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because upsellItemed product", p.id, "is not found");
                                        updates["upsellItems." + j + ".unavailable"] = true;
                                    }
                                }
                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "availability after upsellItems check", availableInventory);
                            }

                            // if kit components are unavailable, then available inventory = 0 too;
                            if (unavailableComponents) {
                                availableInventory = 0;
                            }

                            logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "availability before kitgroups check", availableInventory);

                            if (product.kitGroups && product.kitGroups.length > 0) {
                                // ensure that any kit groups have at least one available product
                                //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "contains", product.kitGroups.length, "kitGroups");
                                var availableCount = null;
                                for (var j = 0; j < product.kitGroups.length; j++) {
                                    var numAvailableForKitGroup = 0;
                                    var kitGroup = product.kitGroups[j];
                                    if (kitGroup.kitGroup && kitGroup.kitGroup.components) {
                                        var hasValidComponentOption = false;
                                        for (var k = 0; k < kitGroup.kitGroup.components.length; k++) {
                                            var component = kitGroup.kitGroup.components[k];
                                            if (component.product) {
                                                var p = component.product;
                                                var sku = p.sku;
                                                if (allInventory[sku] > 0) {
                                                    numAvailableForKitGroup += allInventory[sku];
                                                }

                                                // ensure all valid kit groups (in date range) have at least one available product
                                                //     status "A" and type "R" or "B"
                                                //
                                                //"kitGroups" : [{
                                                //    "kitGroup" : {type: String, ref: 'KitGroup'},
                                                //    "rank" : Number,
                                                //    "quantity" : Number,
                                                //    "startDate" : { type: Date, default: null },
                                                //    "endDate" : { type: Date, default: null }
                                                //}],
                                                //...
                                                //"components" : [{
                                                //    "product" : {type: String, ref: 'Product'},
                                                //    "rank" : Number,
                                                //    "startDate" : { type: Date, default: null },
                                                //    "endDate" : { type: Date, default: null }
                                                //}]

                                                if ((kitGroup.startDate == null || moment(kitGroup.startDate).isBefore(now)) &&
                                                    (kitGroup.endDate == null || moment(kitGroup.endDate).isAfter(now)) &&
                                                    ((p.masterStatus == "A" || p.masterStatus == "T") && (p.masterType == "R" || p.masterType == "B" || type == "group")))
                                                {
                                                    // the kitgroup is in range and should be valid
                                                    hasValidComponentOption = true;
                                                } else {
                                                    //logger.debug("processAvailabilityAndHiddenProducts(): component is unavailable", component)
                                                }
                                            } else {
                                                logger.warn("processAvailabilityAndHiddenProducts(): kitGroup", kitGroup.kitGroupId, "product", component.productId, "is not found");
                                            }
                                        }

                                        // mark products as available/unavailable based on kitGroup date range and having any valid products
                                        if (!hasValidComponentOption) {
                                            //logger.debug("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because a kitGroup product", p.id, "is not found");
                                            unavailableComponents = true;
                                            // also set this kitGroup to hidden
                                            updates["kitGroups." + j + ".unavailable"] = true;
                                        } else {
                                            updates["kitGroups." + j + ".unavailable"] = false;
                                        }

                                        //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "kitGroup", sku, "numAvailableForKitGroup", numAvailableForKitGroup);

                                        if (numAvailableForKitGroup == 0 || !hasValidComponentOption) {
                                            //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "product has 0 availability, since a kitGroup has 0 inventory");
                                            availableInventory = 0;
                                            break;
                                        } else if (availableCount != null) {
                                            availableCount = numAvailableForKitGroup < availableCount ? numAvailableForKitGroup : availableCount;
                                            //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "inventory now", availableCount);
                                        } else {
                                            availableCount = numAvailableForKitGroup;
                                            //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "inventory now", availableCount);
                                        }
                                    }
                                }

                                //availableInventory = availableCount && availableCount < availableInventory ? availableCount : availableInventory;
                                // only process inventory based on kit group components if there were no missing fixed components
                                if (!fixedComponentInventoryDepleted) {
                                    if (product.type == "kit") {
                                        availableInventory = availableCount && (availableInventory == -1 || availableCount < availableInventory) ? availableCount : availableInventory;
                                    } else {
                                        availableInventory = availableCount ? availableCount : 0;
                                    }
                                }
                                logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "availability after kitGroup check", availableInventory);
                            }

                            if (availableInventory == -1) {
                                availableInventory = 0;
                            }

                            //logger.debug("processAvailabilityAndHiddenProducts(): product", product.id, "updating availability to", availableInventory);
                            updates["availableInventory"] = availableInventory;
                            updates["unavailableComponents"] = unavailableComponents;

                            //logger.debug("processAvailabilityAndHiddenProducts(): processing updates for product", product.id, updates);
                            if (deductFromInventory[product.id]) {
                                logger.debug("processAvailabilityAndHiddenProducts(): deducting", deductFromInventory[product.id], "for purchases of", product.id);
                                updates["availableInventory"] = availableInventory - deductFromInventory[product.id];
                            }

                            // remove minInventory so we have the number we can rely on
                            updates["availableInventory"] = updates["availableInventory"] - MIN_INVENTORY >= 0 ? updates["availableInventory"] - MIN_INVENTORY: 0;

                            // update the product/kit/group with the resultant inventory
                            models.Product.findOneAndUpdate({
                                _id: product.id
                            }, updates, {upsert: true}, function (err, product) {
                                updateCount++;

                                if (err) {
                                    logger.error("processAvailabilityAndHiddenProducts(): error updating product inventory", err);
                                    deferred.reject(err);
                                    return;
                                }

                                //logger.debug("processAvailabilityAndHiddenProducts(): updated inventory for product", product.type, "to", product.availableInventory);
                                finalInventory[product.id] = product.availableInventory;

                                if (updateCount == products.length) {
                                    logger.debug("processAvailabilityAndHiddenProducts(): all products updated, returning");
                                    deferred.resolve(finalInventory);
                                }
                            });
                        }
                    } catch (ex) {
                        logger.error("processAvailabilityAndHiddenProducts(): error processing products", ex);
                        deferred.reject(ex);
                    }
                }, function(err) {
                    logger.error("processAvailabilityAndHiddenProducts(): error on fetching order historys", err);
                    deferred.reject(err);
                });
            }, function (err) {
                if (err) {
                    logger.error("processAvailabilityAndHiddenProducts(): error getting config", err);
                    deferred.reject(err);
                    return;
                }
            });
        });
    });

    return deferred.promise;
}

function getAvailableProductCriteria(loadComponents) {
    console.log("getAvailableProductCriteria(", loadComponents, ")");
    var now = new Date();

    var requireSearchable = !loadComponents;

    var types = ["R"];
    if (loadComponents) {
        types.push("B");
    }

    var availableProductCriteria = [
        {onHold: false, unavailableComponents: false},
        {$or: [
            {masterType: {$in: types}},
            {$and: [
                {type:"group"},
                {$or: [{"startDate":{$eq:null}}, {"startDate":{$lte: now}}]},
                {$or: [{"endDate":{$eq:null}}, {"endDate":{$gt: now}}]}
            ]}
        ]},
        {$or: [
            {masterStatus: "A", prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}},
            {masterStatus: "A", type: "group"},
            {masterStatus: "T", promotionalMessages: {$elemMatch: {"startDate":{$lte: now}, "endDate":{$gte: now}}}}
            // TODO - OR masterStatus: "T", and valid promo message exists
            // TODO - OR type: "group", and valid promo message exists
        ]}
    ];

    if (requireSearchable == null || requireSearchable) {
        availableProductCriteria.unshift({searchable:true});
    }

    return availableProductCriteria;
}

function getAvailableStarterKitCriteria() {
    var availableStarterKitCriteria = [
        {masterType:"K", masterStatus:"A", type: "kit" }
    ];
    return availableStarterKitCriteria;
}

function getAvailableProductOrStarterKitCriteria() {
    var criteria = {$or:[
        getAvailableProductCriteria(),
        getAvailableStarterKitCriteria()
    ]};
    return criteria;
}

function getProductAsKitComponentCriteria() {
    var availableKitComponentsCriteria = [
        {masterStatus:"A", unavailableComponents: false},
        {$or:[{masterType: "R"}, {masterType: "B"}, {type: "group"}]},
    ];
    return availableKitComponentsCriteria;
}

function getComponentsCriteria(loadUnavailable) {
    var now = new Date();

    var componentsCriteria = {};

    if (!loadUnavailable) {
        componentsCriteria = {unavailableComponents: false};
    }
    return componentsCriteria;
}

function getKitGroupComponentsCriteria() {
    var now = new Date();
    var kitGroupComponentCriteria = [
        // in date range
        {$or: [{"startDate":{$eq:null}}, {"startDate":{$lte: now}}]},
        {$or: [{"endDate":{$eq:null}}, {"endDate":{$gt: now}}]}
    ];

    return kitGroupComponentCriteria;
}

function searchProducts(searchString, loadUnavailable, skip, limit, count) {
    var d = Q.defer();
    var now = new Date();

    logger.debug("searchProducts()", searchString, loadUnavailable, skip, limit);

    var query = {$and: [
        {$text: { $search: "" + searchString }}
    ]};
    if (!loadUnavailable) {
        query["$and"] = query["$and"].concat(getAvailableProductCriteria())
    }

    models.Product.find(query, {score: { $meta: "textScore" }})
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: getAvailableProductCriteria()}
    }).populate({
        path: 'contains.product',
        model: 'Product',
        match: getComponentsCriteria(loadUnavailable)
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup',
        match: { $and: getKitGroupComponentsCriteria()}
    }).exec(function (err, products)    {
        if (err) {
            logger.debug("error getting products by string", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        if (count) {
            d.resolve({count:products.length});
            return;
        }

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            if (products[i].contains) {
                products[i].contains = products[i].contains.filter(function (obj, index) {
                    return (
                    obj.product != null && obj.unavailable == false &&
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
                if (products[i].type == "group" && (products[i].contains == null || products[i].contains.length == 0)) {
                    products.splice(i, 1);
                    continue;
                }
            }
            if (products[i].promotionalMessages) {
                products[i].promotionalMessages = products[i].promotionalMessages.filter(function (obj, index) {
                    return (
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
            }
            if (products[i].upsellItems) {
                products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
            if (products[i].youMayAlsoLike) {
                products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
        }

        logger.debug("returning", products.length, "products");
        d.resolve(products);
    });

    return d.promise;
}

function loadProductsByCategory(categoryId, loadUnavailable, skip, limit, sort) {
    var d = Q.defer();
    var now = new Date();

    logger.debug("loadProductsByCategory()", categoryId, loadUnavailable, skip, limit, sort);

    var query = {$and: [
        {categories: {$in: categoryToChildren[categoryId]}}
    ]};

    if (!loadUnavailable) {
        query["$and"] = query["$and"].concat(getAvailableProductCriteria());
    }

    models.Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: getAvailableProductCriteria()}
    }).populate({
        path: 'contains.product',
        model: 'Product',
        match: getComponentsCriteria(loadUnavailable)
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup',
        match: { $and: getKitGroupComponentsCriteria()}
    }).exec(function (err, products) {
        if (err) {
            logger.debug("error getting products by category", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            if (products[i].contains) {
                products[i].contains = products[i].contains.filter(function (obj, index) {
                    return (
                    obj.product != null && obj.unavailable == false &&
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
                if (products[i].type == "group" && (products[i].contains == null || products[i].contains.length == 0)) {
                    products.splice(i, 1);
                    continue;
                }
            }
            if (products[i].promotionalMessages) {
                products[i].promotionalMessages = products[i].promotionalMessages.filter(function (obj, index) {
                    return (
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
            }
            if (products[i].upsellItems) {
                products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
            if (products[i].youMayAlsoLike) {
                products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
        }

        logger.debug("returning", products.length, "products");
        d.resolve(products);
    });

    return d.promise;
}

function loadProductsById(productIds, loadComponents, loadUnavailable, loadStarterKits, loadStarterKitsOnly, count) {
    var d = Q.defer();
    var now = new Date();

    logger.debug("loadProductsById()", productIds, loadComponents, loadUnavailable, loadStarterKits, loadStarterKitsOnly);

    var query = {$and: [
        {_id: { $in: productIds }}
    ]};

    if (!loadUnavailable && !loadStarterKitsOnly) {
        query["$and"] = query["$and"].concat(getAvailableProductCriteria(loadComponents));
    } else if (loadStarterKitsOnly) {
        query["$and"] = query["$and"].concat(getAvailableStarterKitCriteria());
    } else if (loadStarterKits) {
        query["$and"] = query["$and"].concat(getAvailableProductOrStarterKitCriteria());
    }

    models.Product.find(query)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: getAvailableProductCriteria()}
    }).populate({
        path: 'contains.product',
        model: 'Product',
        match: getComponentsCriteria(loadUnavailable)
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup',
        match: { $and: getKitGroupComponentsCriteria()}
    }).exec(function (err, products) {
        if (err) {
            logger.debug("error getting products by ID", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        if (count) {
            d.resolve({count:products.length});
            return;
        }

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            if (products[i].contains) {
                products[i].contains = products[i].contains.filter(function (obj, index) {
                    return (
                    obj.product != null && obj.unavailable == false &&
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
                if (products[i].type == "group" && (products[i].contains == null || products[i].contains.length == 0)) {
                    products.splice(i, 1);
                    continue;
                }
            }
            if (products[i].promotionalMessages) {
                products[i].promotionalMessages = products[i].promotionalMessages.filter(function (obj, index) {
                    return (
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
            }
            if (products[i].upsellItems) {
                products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
            if (products[i].youMayAlsoLike) {
                products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
        }

        logger.debug("loadProductsById(): returning", products.length, "products");
        d.resolve(products);
    });

    return d.promise;
}

function loadProducts(loadUnavailable, loadComponents, skip, limit, sort, count) {
    var d = Q.defer();
    var now = new Date();

    logger.debug("loadProducts()", loadUnavailable, loadComponents, skip, limit, sort);

    var query = {};

    if (!loadUnavailable && !loadComponents) {
        query["$and"] = query["$and"] = getAvailableProductCriteria();
    } else if (loadComponents) {
        query["$and"] = query["$and"] = getProductAsKitComponentCriteria();
    }

    models.Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: getAvailableProductCriteria()}
    }).populate({
        path: 'contains.product',
        model: 'Product',
        match: getComponentsCriteria(loadUnavailable)
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup',
        match: { $and: getKitGroupComponentsCriteria()}
    }).exec(function (err, products) {
        if (err) {
            logger.debug("error getting products", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        if (count) {
            d.resolve({count:products.length});
            return;
        }

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            if (products[i].contains) {
                products[i].contains = products[i].contains.filter(function (obj, index) {
                    return (
                    obj.product != null && obj.unavailable == false &&
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
                if (products[i].type == "group" && (products[i].contains == null || products[i].contains.length == 0)) {
                    products.splice(i, 1);
                    continue;
                }
            }
            if (products[i].promotionalMessages) {
                products[i].promotionalMessages = products[i].promotionalMessages.filter(function (obj, index) {
                    return (
                    (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                    (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                    );
                });
            }
            if (products[i].upsellItems) {
                products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
            if (products[i].youMayAlsoLike) {
                products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                    return (obj.product != null && obj.unavailable == false);
                });
            }
        }

        logger.debug("returning", products.length, "products");
        d.resolve(products);
    });

    return d.promise;
}

function loadProductById(productId, loadUnavailable, loadStarterKit, loadStarterKitOnly) {
    var d = Q.defer();
    var now = new Date();

    logger.debug("loadProductById()", productId, loadUnavailable, loadStarterKit, loadStarterKitOnly);

    var query = {$and: [
        {_id: productId}
    ]};

    if (!loadUnavailable && !loadStarterKit && !loadStarterKitOnly) {
        logger.debug("loadProductById(): getAvailableProductCriteria");
        query["$and"] = query["$and"].concat(getAvailableProductCriteria());
    } else if (loadStarterKitOnly) {
        logger.debug("loadProductById(): getAvailableStarterKitCriteria");
        query["$and"] = query["$and"].concat(getAvailableStarterKitCriteria());
    } else if (loadStarterKit) {
        logger.debug("loadProductById(): getAvailableProductOrStarterKitCriteria");
        query["$and"] = query["$and"].concat(getAvailableProductOrStarterKitCriteria());
    }

    models.Product.find(query).populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: getAvailableProductCriteria()}
    }).populate({
        path: 'contains.product',
        model: 'Product',
        match: getComponentsCriteria(loadUnavailable)
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup',
        match: { $and: getKitGroupComponentsCriteria()}
    }).exec(function (err, products) {
        if (err) {
            logger.error("error populating product", err);
            d.reject({
                statusCode: 500,
                errorCode: "productLookupFailed",
                errorMessage: "Failed to lookup product"
            });
            return;
        }

        if (products.length == 1) {
            logger.debug("returning", products.length, "products");

            var opts = {
                path: 'kitGroups.kitGroup.components.product',
                model: 'Product'
            }

            // populate components
            models.Product.populate(products, opts, function (err, products) {
                if (err) {
                    logger.error("error populating product kitGroup components", err);
                    d.reject({
                        statusCode: 500,
                        errorCode: "productLookupFailed",
                        errorMessage: "Failed to lookup product"
                    });
                    return;
                }

                //logger.debug("loadProductsById(): got products", products);


                //logger.debug('products:', products);
                if (products[0].contains) {
                    products[0].contains = products[0].contains.filter(function (obj, index) {
                        return (
                        obj.product != null && obj.unavailable == false &&
                        (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                        (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                        );
                    });
                    if (products[0].type == "group" && (products[0].contains == null || products[0].contains.length == 0)) {
                        d.reject({
                            statusCode: 404,
                            errorCode: "productNotFound",
                            errorMessage: "Product not found"
                        });
                        return;
                    }
                }
                if (products[0].promotionalMessages) {
                    products[0].promotionalMessages = products[0].promotionalMessages.filter(function (obj, index) {
                        return (
                            (obj.startDate == null || (obj.startDate != null && moment(obj.startDate).isBefore(now))) &&
                            (obj.endDate == null || (obj.endDate != null && moment(obj.endDate).isAfter(now)))
                        );
                    });
                }
                if (products[0].upsellItems) {
                    products[0].upsellItems = products[0].upsellItems.filter(function (obj, index) {
                        return (obj.product != null && obj.unavailable == false);
                    });
                }
                if (products[0].youMayAlsoLike) {
                    products[0].youMayAlsoLike = products[0].youMayAlsoLike.filter(function (obj, index) {
                        return (obj.product != null && obj.unavailable == false);
                    });
                }
                d.resolve(products[0]);

                //logger.debug('product', products[0]);

                return;
            });
            return;
        }
        d.reject({
            statusCode: 404,
            errorCode: "productNotFound",
            errorMessage: "Product not found"
        });
    });

    return d.promise;
}

// API

function getProducts(loadUnavailable, loadComponents, skip, limit, sort) {
    var d = Q.defer();

    logger.debug("getProducts()", loadUnavailable, loadComponents, skip, limit, sort);

    request.get({
        url: API_PRODUCTS_URL,
        qs: {
            loadUnavailble: loadUnavailable,
            loadComponents: loadComponents,
            skip: skip,
            limit: limit,
            sort: sort
        },
        headers: {
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        logger.debug("getProducts()", error, response ? response.statusCode: null);
        if (error || response == null || response.statusCode != 200) {
            logger.error("getProducts(): error", error, response ? response.statusCode: null);

            if (response && response.statusCode) {
                d.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: response.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                d.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "createClientInvalidResponse",
                        message: "Failed to create client"
                    }
                });
            }
            return;
        }

        if (body != null) {
            //logger.debug("getProducts(): success", body);
            d.resolve({
                status: 200,
                result: body
            });
        } else {
            logger.debug("getProducts(): no products");
            d.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "getProductsFailed",
                    message: "Failed to get products"
                }
            });
        }
    })

    return d.promise;
}



// EXPORTS
exports.preloadCategories = preloadCategories;

exports.authenticate = authenticate;
exports.getClient = getClient;
exports.createClient = createClient;
exports.updateClient = updateClient;

exports.createConsultant = createConsultant;
exports.getConsultant = getConsultant;
exports.lookupConsultant = lookupConsultant;
exports.lookupConsultantByEmail = lookupConsultantByEmail;
exports.lookupClientByEmail = lookupClientByEmail;
exports.createLead = createLead;

exports.createOrder = createOrder;
exports.getOrderHistory = getOrderHistory;

exports.getAddresses = getAddresses;
exports.getAddress = getAddress;
exports.createAddress = createAddress;
exports.updateAddress = updateAddress;
exports.deleteAddress = deleteAddress;

exports.validateEmail = validateEmail;
exports.validateAddress = validateAddress;

exports.getCreditCards = getCreditCards;
exports.getCreditCard = getCreditCard;
exports.createCreditCard = createCreditCard;
exports.updateCreditCard = updateCreditCard;
exports.deleteCreditCard = deleteCreditCard;

exports.getGeocodes = getGeocodes;
exports.calculateSalesTax = calculateSalesTax;

exports.requestPasswordReset = requestPasswordReset;
exports.requestPasswordChange = requestPasswordChange;

exports.getInventory = getInventory;
exports.updateInventory = updateInventory;
exports.processAvailabilityAndHiddenProducts = processAvailabilityAndHiddenProducts;

exports.loadProducts = loadProducts;
exports.searchProducts = searchProducts;
exports.loadProductsByCategory = loadProductsByCategory;
exports.loadProductsById = loadProductsById;
exports.loadProductById = loadProductById;

exports.getProducts = getProducts;
