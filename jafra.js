'use strict';

var request = require('request');
var SHA1 = require("crypto-js/sha1");
var Q = require('q');
Q.longStackSupport = true;
var soap = require('soap');
var parseString = require('xml2js').parseString;
var fs = require('fs');
var config = require('./config/config');
var models = require('./common/models.js');
var mongoose = require('mongoose');
var randomString = require('random-string');
var moment = require('moment');
var util = require('util');

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

var GET_CONSULTANT_URL = BASE_URL + "/JOS05007P.pgm";
var CREATE_CONSULTANT_URL = BASE_URL + "/JOS05002P.pgm";
var LOOKUP_CONSULTANT_URL = BASE_URL + "/JOS05004P.pgm";
var CREATE_LEAD_URL = BASE_URL + "/JOS05005P.pgm";

var CREATE_ORDER_URL = BASE_URL + "/JCD05020P.pgm";

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

var STRIKEIRON_EMAIL_URL = 'http://ws.strikeiron.com/StrikeIron/emv6Hygiene/EMV6Hygiene/VerifyEmail';
var STRIKEIRON_EMAIL_LICENSE = "2086D15410C1B9F9FF89";
var STRIKEIRON_EMAIL_TIMEOUT = 15;

//var STRIKEIRON_ADDRESS_URL = 'http://ws.strikeiron.com/StrikeIron/NAAddressVerification6/NorthAmericanAddressVerificationService/NorthAmericanAddressVerification';
var STRIKEIRON_ADDRESS_SOAP_URL = 'http://ws.strikeiron.com/NAAddressVerification6?WSDL';
var STRIKEIRON_ADDRESS_LICENSE = "0DA72EA3199C10ABDE0B";

var PASSWORD_RESET_INTERVAL = 15 * 1000 * 60;
var MIN_INVENTORY = 10;

// pre-load categories so we can do some child category searches
var categoryToChildren = {};

function preloadCategories() {
    models.Category.find({parent: { $exists: false }, onHold: false, showInMenu: true }).sort('rank').limit(100)
    .populate({
        path: 'children',
        match: {onHold: false, showInMenu: true}
    }).exec(function (err, categories) {
        if (err) {
            console.error("error loading categories", err);
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
                //console.log(JSON.stringify(categories));

                for (var i=0; i < categories.length; i++) {
                    var category = categories[i];
                    //console.log("category", category._id);
                    var ids = _getCategoryAndChildren(category);
                    //console.log("children", ids);
                    //console.log("top level category", category._id, ids);
                    categoryToChildren[category._id] = ids;
                    //console.log("category sub-categories", category._id, ids);
                }

                //console.log("categoryToChildren", categoryToChildren);
            })
        })
    });
}

function _getCategoryAndChildren(category) {
    //console.log("processing category", category._id);
    var all = [];

    // add this category
    all.push(category._id);

    var children = category.children ? category.children : [];
    for (var i=0; i < children.length; i++) {
        var child = children[i];
        //console.log("processing category child", child._id);
        var childIds = _getCategoryAndChildren(child);
        //console.log("processing category child", child._id, childIds);
        categoryToChildren[child._id] = childIds;
        all = all.concat(childIds);
    }

    return all;
}

function authenticate(email, password) {
    //console.log("authenticating", email, password);
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
            console.error("authenticate(): error", error, response ? response.statusCode: null, body);
            if (response.statusCode == 401) {
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
        //console.log("authenticate(): success", body);

        if (body == null || body.clientId == null) {
            console.log("authenticate(): invalid return data", body, typeof body, "clientId", body.clientId);
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

            deferred.resolve({
                status: r.status,
                result: r.result
            });
        }, function (r) {
            console.error("authenticate(): failed to load client", r.result);
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
//    console.log("auth", r.status, r.result);
//}, function(r) {
//    console.error("auth", r.status, r.result);
//});

//authenticate('davidcastro@lavisual.com', 'testpass').then(function(r) {
//    console.log(r.response.statusCode, r.body);
//}, function(r) {
//    console.error(r.response.statusCode, r.body);
//});

// ?clientId=
function getClient(clientId) {
    //console.log("getClient()", clientId);
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
        console.log("getClient()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            console.error("getClient(): error", error, response.statusCode, body);
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

        if (body.id != null) {
            //console.log("getClient(): success", body);
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
//getClient(50000023).then(function(r) {
//    console.log(r.status, r.result);
//});
//getClient(50000019).then(function(r) {
//    console.log(r.body);
//});

/**
{
    "email": "jsmith@gmail.com", // required
    "password": "some password", // required
    "firstName": "John",         // required
    "lastName": "Smith",         // required
    "phone": "555-555-4432",     // required
    "dateOfBirth": "12/01/1978", // required  (optional)
    "consultantId": 4657323,     // optional
    "language": "en_US"          // optional
}
*/
function createClient(client) {
    //console.log("createClient", email, password);
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
            console.error("createClient(): error", response ? response.statusCode: null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
                console.error("createClient(): error, returning server error");
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                console.error("createClient(): error, returning generic error");
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
            console.log("createClient(): invalid return data", body, typeof body, "clientId", body.clientId);
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
        console.log("createClient(): returning success");
        var clientId = body.clientId;

        // fetch the client information & return
        getClient(clientId).then(function(r) {
            if (r.status != 200) {
                console.error("server: createClient(): failed to load client", r.result);
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
            console.error("server: createClient(): failed to load client", r.result);
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

//createClient({
//    "email": "davidcastro@lavisual.com", // required
//    "password": "testpass",      // required
//    "firstName": "David",        // required
//    "lastName": "Castro",        // required
//    "phone": "949-242-0169",     // required
//    "dateOfBirth": "12/12/1978", // optional
//    "language": "en_US"          // optional
//}).then(function(r) {
//    console.log("response", r.response.statusCode, "body", r.body);
//}, function(r) {
//    console.error("response", r.response.statusCode, "body", r.body);
//});

function getConsultant(consultantId) {
    //console.log("getConsultant()", clientId);
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
        console.log("getConsultant()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            console.error("getConsultant(): error", error, response.statusCode, body);
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

        if (body.id != null) {
            //console.log("getConsultant(): success", body);
            deferred.resolve({
                status: 200,
                result: {
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
                    errorCode: "clientLoadFailed",
                    message: "Failed to load client"
                }
            });
        }
    })

    return deferred.promise;
}

function lookupConsultant(encrypted) {
    console.log("lookupConsultant()", encrypted);
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
        console.log("lookupConsultant(): body", body);

        if (error || response.statusCode != 200) {
            console.error("lookupConsultant(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
                if (body.statusCode == 404) {
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
            console.log("lookupConsultant(): invalid return data", body, typeof body, "consultantId", body.consultantId);
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
        console.log("lookupConsultant(): exists", exists, "consultantId", body.consultantId);

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
    //console.log("createCreditCard", email, password);
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
        if (error || response.statusCode != 201) {
            console.error("createConsultant(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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
            console.log("createConsultant(): invalid return data", body, typeof body, "consultantId", body.consultantId, "orderId", body.orderId);
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
    //console.log("lookupByEmail()", clientId);
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
        console.log("lookupByEmail()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            console.error("lookupByEmail(): error", error, response.statusCode, body);
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

        if (
            (type == 1 && body.consultantId != null) ||
            (type == 2 && body.clientId != null)
        ) {
            //console.log("lookupByEmail(): success", body);
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

function createOrder(data) {
    //console.log("createOrder", data);
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
            console.error("createOrder(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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
            console.log("createOrder(): invalid return data", body, typeof body, "orderId", body.orderId, "orderId", body.orderId);
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
                if (err) return console.error("createOrder(): error saving order history record", err);
            })
        } catch (ex) {
            console.error("error saving order history record", ex);
        }


        // we should get orderId back
        deferred.resolve({
            status: 201,
            result: body
        });
    });

    return deferred.promise;
}


function createLead(lead) {
    //console.log("createLead", email, password);
    var deferred = Q.defer();

    request.post({
        url: CREATE_LEAD_URL,
        form: {
            email: lead.email,
            firstName: lead.firstName,
            lastName: lead.lastName,
            phone: lead.phone,
            language: lead.language
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
        if (error || response.statusCode != 200) {
            console.error("createLead(): error", response ? response.statusCode: null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
                console.error("createLead(): error, returning server error");
                deferred.reject({
                    status: response.statusCode,
                    result: {
                        statusCode: body.statusCode,
                        errorCode: body.errorCode,
                        message: body.message
                    }
                });
            } else {
                console.error("createLead(): error, returning generic error");
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
            console.log("createLead(): invalid return data", body, typeof body, "leadId", body.leadId);
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
        console.log("createLead(): returning success");
        var leadId = body.leadId;
        deferred.resolve({
            status: 201,
            result: body
        });
    });

    return deferred.promise;
}

function getAddresses(clientId) {
    //console.log("getAddresses()", clientId);
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
        if (error || response.statusCode != 200) {
            console.error("getAddresses(): error", error, response.statusCode, body);
            deferred.reject({error: error, response: response, body: body});
            return;
        }
        //console.log("getAddresses(): success", body);
        deferred.resolve({
            status: 200,
            result: body
        });
    });

    return deferred.promise;
}
//getAddresses(12).then(function(r) {
//    console.log(r.body);
//});

function getAddress(clientId, addressId) {
    //console.log("getAddress()", clientId);
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
        if (error || response.statusCode != 200) {
            console.error("getAddress(): error", error, response.statusCode, body);
            deferred.reject({error: error, response: response, body: body});
        }
        //console.log("getAddress(): success", body);
        deferred.resolve({response: response, body: body});
    });

    return deferred.promise;
}

// FIXME - error when requesting addressId 1200, get array instead of single address
//getAddress(12, 1200).then(function(r) {
//    console.log(r.body);
//});

function createAddress(clientId, address) {
    //console.log("createAddress", email, password);
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
            console.error("createAddress(): error", response.statusCode, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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
            console.log("createAddress(): invalid return data", body, typeof body, "addressId", body.addressId);
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

function updateAddress(clientId, addressId, address) {
    console.log("updateAddress", clientId, addressId, address);
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
            console.error("updateAddress(): error", response.statusCode, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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
        console.log("updateAddress(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });

    return deferred.promise;
}

function deleteAddress(clientId, addressId) {
    console.log("deleteAddress", clientId, addressId);
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
            console.error("deleteAddress(): error", response.statusCode, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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

        console.log("deleteAddress(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });

    return deferred.promise;
}

function validateEmail(email) {
    var deferred = Q.defer();

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
        console.log("validateEmail()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            console.error("validateEmail(): error", error, response ? response.statusCode: null, body);
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

        console.log("validateEmail(): body", body, body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult);

        if (body && body.WebServiceResponse && body.WebServiceResponse.VerifyEmailResponse &&
            body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult &&
            body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus &&
            body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus.StatusNbr)
        {
            var statusNbr = parseInt(body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus.StatusNbr);
            console.log("validateEmail(): statusNbr", statusNbr);

            if (statusNbr == 310 || statusNbr == 311 || (statusNbr >= 200 && statusNbr < 300)) {
                console.log("validateEmail(): valid");
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

    return deferred.promise;
}

function validateAddress(address) {
    console.log("validateAddress()", address);
    var deferred = Q.defer();

    var options = {
        ignoredNamespaces: {
            namespaces: ['q1', 'q2']
        }
    }

    try {
        soap.createClient(STRIKEIRON_ADDRESS_SOAP_URL, options, function(err, client) {
            var userId = STRIKEIRON_ADDRESS_LICENSE;

            console.log("license", userId);

            client.addSoapHeader({LicenseInfo: {RegisteredUser: {UserID: userId}}});

            client.NorthAmericanAddressVerification({
                "AddressLine1":address.address1,
                "AddressLine2":address.address2,
                "CityStateOrProvinceZIPOrPostalCode":address.city + " " + address.state + " " + address.zip,
                "Country":address.country,
                "Casing":"PROPER"
            }, function (error, response) {
                console.log("validateAddress(): response", error);
                if (error || response.NorthAmericanAddressVerificationResult.ServiceStatus.StatusNbr != 200) {
                    console.error("validateAddress(): error", error, "response", response);
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
                    console.log("validateAddress(): success", response.NorthAmericanAddressVerificationResult.ServiceResult.USAddress);

                    /**
                     * State, Urbanization, ZIPPlus4, ZIPCode, ZIPAddOn, CarrierRoute, PMB, PMBDesignator,
                     * DeliveryPoint, DPCheckDigit, LACS, CMRA, DPV, DPVFootnote, RDI, RecordType,
                     * CongressDistrict, County, CountyNumber, StateNumber, GeoCode
                     */
                    //console.log("getClient(): success", body);

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
                    console.log("validateAddress(): returning address", a);

                    deferred.resolve({
                        status: 200,
                        result: a
                    });
                } else {
                    console.error("validateAddress(): result was not expected", result);

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
    //console.log("getCreditCards()", clientId);
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
            console.error("getCreditCards(): error", error, response ? response.statusCode: null, body);
            deferred.reject({error: error, response: response, body: body});
            return;
        }
        //console.log("getCreditCards(): success", body);
        deferred.resolve({
            status: response.statusCode,
            result: body
        });
    });

    return deferred.promise;
}

function getCreditCard(clientId, creditCardId) {
    //console.log("getCreditCard()", clientId);
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
            console.error("getCreditCard(): error", error, response ? response.statusCode: null, body);
            deferred.reject({error: error, response: response, body: body});
        }
        //console.log("getCreditCard(): success", body);
        deferred.resolve({response: response, body: body});
    });

    return deferred.promise;
}

function createCreditCard(clientId, data) {
    //console.log("createCreditCard", email, password);
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
            console.error("createCreditCard(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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
            console.log("createCreditCard(): invalid return data", body, typeof body, "creditCardId", body.creditCardId);
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
    //console.log("updateCreditCard", email, password);
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
            console.error("updateCreditCard(): error", error, response ? response.statusCode : null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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
            console.log("updateCreditCard(): invalid return data", body, typeof body, "creditCardId", body.creditCardId);
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
    console.log("deleteCreditCard", clientId, creditCardId);
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
            console.error("deleteCreditCard(): error", response ? response.statusCode: null, body);

            if (body && body.statusCode && body.errorCode && body.message) {
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

        console.log("deleteCreditCard(): success");
        deferred.resolve({
            status: 204,
            result: null
        });
    });

    return deferred.promise;
}

function getGeocodes(zipCode) {
    console.log("getGeocodes()", zipCode);
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
        console.log("getGeocodes()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            console.error("getGeocodes(): error", error, response.statusCode, body);
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
            console.log("err", err, "result", result);

            if (err) {
                console.log("getGeocodes(): failure");
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

                console.log("getGeocodes(): success");
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

    console.log("getCalculateTax()", data);
    console.log("getCalculateTax(): products",JSON.stringify(data.products));
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
        console.log("getCalculateTax()", error, response ? response.statusCode: null, body);
        if (error || response == null || response.statusCode != 200) {
            console.error("getCalculateTax(): error", error, response ? response.statusCode: null, body);
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

        console.log("getCalculateTax(): success", body);
        deferred.resolve({
            status: 200,
            result: body
        });
        return;
    })

    return deferred.promise;
}

function requestPasswordReset(email, language) {
    console.log("requestPasswordReset()", email, language);
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
            console.error("failed to lookup password reset token", err);
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
            console.error("password reset requested too soon", tokens);
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

            console.log('requestPasswordReset(): created password reset token for ' + email);

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
                console.log("requestPasswordReset(): body", body);

                if (error || response.statusCode != 204) {
                    console.error("requestPasswordReset(): error", error, response ? response.statusCode : null, body);
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
    console.log("requestPasswordChange()", email, token);
    var deferred = Q.defer();

    var now = new Date();
    var cantBeOlderThan = new Date(now.getTime() - PASSWORD_RESET_INTERVAL);

    models.PasswordResetToken.find({email: email, token: token, created: {$gt: cantBeOlderThan}}, function(err, tokens) {
        if (err) {
            console.error("requestPasswordChange(): failed to lookup password reset token", err);
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
            console.log("requestPasswordChange(): found token", token);
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
                console.log("requestPasswordChange(): body", body);

                if (error || response.statusCode != 204) {
                    console.error("requestPasswordChange(): error", error, response ? response.statusCode : null, body);
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
            console.error("requestPasswordChange(): no token found");

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
    //console.log("getInventory()", inventoryId);
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
        console.log("getInventory()", error, response ? response.statusCode: null, body);
        if (error || response.statusCode != 200) {
            console.error("getInventory(): error", error, response.statusCode, body);
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

        if (body.availableInventory != null) {
            //console.log("getInventory(): success", body);
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
            console.error("getConfigValue(): error", error, response.statusCode);
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

function updateInventory() {
    //console.log("updateInventory()", inventoryId);
    var deferred = Q.defer();
    var now = new Date();
    var HOURS_24 = moment.duration(24, "hours");
    var HOURS_24_AGO = moment().subtract(HOURS_24);

    // FIXME - don't update everything if the inventory hasn't changed.

    getConfigValue("inventoryLastUpdated").then(function(lastUpdated) {
        console.log("getAllInventory(): inventory lastUpdated", moment(lastUpdated).toDate(), "now", now, "24 hours ago", HOURS_24_AGO.toDate());

        // if we have lastUpdated and it's less than 24 hours ago, do a fetch to the DB
        if (lastUpdated != null && (moment(lastUpdated).isAfter(HOURS_24_AGO) || FORCE_INVENTORY_CACHE)) {
            // we need to update again
            console.error("getAllInventory(): fetching inventory from the database");

            models.Inventory.find({}).exec(function (err, inventoryItems) {
                if (err) {
                    console.error("getAllInventory(): error fetching inventory from database");
                    deferred.reject(err);
                    return;
                }

                var inventory = {};
                for (var i=0; i < inventoryItems.length; i++) {
                    var inventoryItem = inventoryItems[i];
                    inventory[inventoryItem._id] = inventoryItem.available;
                }

                processAvailabilityAndHiddenProducts(inventory).then(function (inventory) {
                    deferred.resolve(inventory);
                }, function (err) {
                    console.error("getAllInventory(): processAvailabilityAndHiddenProducts(): error", err);
                    deferred.reject(err);
                })
            });

        // else fetch from the server
        } else {
            console.error("getAllInventory(): fetching inventory from JCS");
            request.get({
                url: GET_ALL_INVENTORY_URL, headers: {
                    'Accept': 'application/json, text/json', 'Authorization': AUTH_STRING
                }, agentOptions: agentOptions, strictSSL: false, json: true
            }, function (error, response, body) {
                console.log("getAllInventory()", error, response ? response.statusCode : null, body);
                if (error || response.statusCode != 200) {
                    console.error("getAllInventory(): error", error, response.statusCode, body);
                    deferred.reject();
                    return;
                }

                if (body.inventory != null) {
                    for (var key in body.inventory) {
                        if (body.inventory.hasOwnProperty(key)) {
                            models.Inventory.update({_id: key}, {available: body.inventory[key]}, {upsert: true}, function (err, numAffected, rawResponse) {
                                if (err) return console.error("getAllInventory(): error updating inventory", key, err);
                                //console.log("getAllInventory(): updated inventory for", key, "to", body.inventory[key]);
                            });
                        }
                    }

                    // save last updated to config
                    models.Config.update({_id: "inventoryLastUpdated"}, {value: moment.unix(body.lastUpdated)}, {upsert: true}, function (err, numAffected, rawResponse) {
                        if (err) return console.error("getAllInventory(): error saving lastUpdated", err);
                        console.log("getAllInventory(): saved inventory lastUpdated", lastUpdated);
                    });

                    processAvailabilityAndHiddenProducts(body.inventory).then(function (inventory) {
                        deferred.resolve(inventory);
                    }, function (err) {
                        console.error("getAllInventory(): processAvailabilityAndHiddenProducts(): error", err);
                        deferred.reject(err);
                    })
                } else {
                    console.error("getAllInventory(): invalid inventory body");
                    deferred.reject("invalid inventory body");
                }
            });
        }
    }, function(err) {
        console.error("updateInventory(): error getting config", error, response.statusCode);
        deferred.reject(err);
    });

    return deferred.promise;
}

function processAvailabilityAndHiddenProducts(allInventory) {
    var deferred = Q.defer();
    var now = new Date();

    // fetch all products, groups and kits to calculate availability
    models.Product.find({}).populate({
        path: 'contains.product',
        model: 'Product'
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup'
    }).exec(function (err, products) {
        if (err) {
            console.log("processAvailabilityAndHiddenProducts(): error getting products", err);
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

            console.log("processAvailabilityAndHiddenProducts(): loaded products for inventory calculation");
            var finalInventory = {};

            // check orders since last inventory update to subtract from the availableInventory
            getConfigValue("inventoryLastUpdated").then(function(lastUpdated) {
                console.error("getAllInventory(): inventory lastUpdated", lastUpdated);

                var orderHistoryComplete = Q.defer();

                var deductFromInventory = {};
                // if we have lastUpdated and it's less than 24 hours ago, do a fetch to the DB
                if (lastUpdated != null) {
                    var lastUpdatedDate = moment(lastUpdated).toDate();
                    console.log("processAvailabilityAndHiddenProducts(): merging order history since", lastUpdatedDate);

                    models.OrderHistory.find({
                        created: {$gte: lastUpdatedDate}
                    }).populate({
                        path: 'products.product',
                        model: 'Product'
                    }).exec(function (err, orderHistoryItems) {
                        //console.log("processAvailabilityAndHiddenProducts(): processing updates for product", product.id, updates);
                        if (err) {
                            console.log("processAvailabilityAndHiddenProducts(): error updating product inventory", err);
                            deferred.reject(err);
                            return;
                        }

                        var opts = {
                            path: 'products.product.contains.product',
                            model: 'KitGroup'
                        };

                        models.Product.populate(orderHistoryItems, opts, function (err, orderHistoryItems) {
                            console.log("processAvailabilityAndHiddenProducts(): have orderHistoryItems", orderHistoryItems);

                            // we need to remove the order amount for this product from the available
                            for (var k = 0; k < orderHistoryItems.length; k++) {
                                var orderHistoryItem = orderHistoryItems[k];
                                for (var l = 0; l < orderHistoryItem.products.length; l++) {
                                    var p = orderHistoryItem.products[l];

                                    // deduct this item
                                    deductFromInventory[p.sku] = deductFromInventory[p.sku] ? deductFromInventory[p.sku] + 1 : 1;
                                    console.log("processAvailabilityAndHiddenProducts(): deducting for purchased item", p.sku);

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
                                            console.log("processAvailabilityAndHiddenProducts(): deducting for purchased item contains", p.sku, "->", c.productId);
                                        }
                                        for (var key in p.kitSelections) {
                                            if (p.kitSelections.hasOwnProperty(key)) {
                                                var items = p.kitSelections[key];
                                                for (var n = 0; n < items.length; n++) {
                                                    var item = items[n];
                                                    deductFromInventory[item.sku] = deductFromInventory[item.sku] ? deductFromInventory[item.sku] + 1 : 1;
                                                    console.log("processAvailabilityAndHiddenProducts(): deducting for purchased item kitGroup component", p.sku, "->", item.sku);
                                                }
                                            }
                                        }
                                    }
                                }
                            }

                            orderHistoryComplete.resolve();
                        });
                    });
                } else {
                    orderHistoryComplete.resolve();
                }

                // wait for order history to be complete if available
                orderHistoryComplete.promise.then(function() {

                    for (var i = 0; i < products.length; i++) {
                        var product = products[i];
                        //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "type", product.type);

                        var availableInventory = allInventory[product.id] != null ? allInventory[product.id] : 0;
                        var unavailableComponents = false;
                        var updates = {};
                        //console.log("processAvailabilityAndHiddenProducts(): product", product.id,"availability after first check", availableInventory);

                        // ensure all the product contains have inventory, else mark as no inventory
                        if (product.contains && product.contains.length > 0) {
                            //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "contains", product.contains.length, "products");
                            var availableCount = null;

                            for (var j = 0; j < product.contains.length; j++) {
                                updates["contains." + j + ".unavailable"] = false;
                                var c = product.contains[j];
                                //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "contains", j, c);

                                if (c.product != null) {
                                    var p = c.product;

                                    // determine inventory availability for the parent product based on inventory of children
                                    //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "availability of item is", allInventory[p._id]);
                                    if (availableCount != null && allInventory[p._id] > 0) {
                                        // our availability is the availability of the least available item
                                        availableCount = allInventory[p._id] < availableCount ? allInventory[p._id] : availableCount;
                                    } else if (availableCount == null) {
                                        availableCount = allInventory[p._id];
                                    }

                                    // mark products as available/unavailable based on contains group / kits statuses
                                    // contains only products that are available status "A" and type "R" or "B"
                                    if (p.masterStatus == "A" && p.onHold == false && (p.masterType == "R" || p.masterType == "B" || p.masterType == null || type == "group")) {
                                        unavailableComponents = false;
                                    } else {
                                        //console.log("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because contained product", p.id, "is unavailable");
                                        unavailableComponents = true;
                                        updates["contains." + j + ".unavailable"] = true;
                                    }
                                } else {
                                    //console.log("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because contained product", p.id, "is not found");
                                    unavailableComponents = true;
                                    updates["contains." + j + ".unavailable"] = true;
                                }
                            }
                            availableInventory = availableCount && availableCount < availableInventory ? availableCount : availableInventory;
                            //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "availability after contains check", availableInventory);
                        }

                        // set unavailable for upsell items
                        if (product.upsellItems && product.upsellItems.length > 0) {
                            //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "upsellItems", product.upsellItems.length, "products");
                            var availableCount = null;

                            for (var j = 0; j < product.upsellItems.length; j++) {
                                updates["upsellItems." + j + ".unavailable"] = false;
                                var c = product.upsellItems[j];
                                //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "upsellItems", j, c);

                                if (c.product != null) {
                                    var p = c.product;

                                    // mark products as available/unavailable based on upsellItems group / kits statuses
                                    // upsellItems only products that are available status "A" and type "R" or "B"
                                    if (p.masterStatus == "A" && p.onHold == false && (p.masterType == "R" || p.masterType == "B" || p.masterType == null || type == "group")) {
                                        // nothing
                                    } else {
                                        //console.log("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because upsellItemed product", p.id, "is unavailable");
                                        updates["upsellItems." + j + ".unavailable"] = true;
                                    }
                                } else {
                                    //console.log("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because upsellItemed product", p.id, "is not found");
                                    updates["upsellItems." + j + ".unavailable"] = true;
                                }
                            }
                            //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "availability after upsellItems check", availableInventory);
                        }

                        // if kit components are unavailable, then available inventory = 0 too;
                        if (unavailableComponents) {
                            availableInventory = 0;
                        }

                        if (product.kitGroups && product.kitGroups.length > 0) {
                            // ensure that any kit groups have at least one available product
                            //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "contains", product.kitGroups.length, "kitGroups");
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

                                            if ((kitGroup.startDate == null || moment(kitGroup.startDate).isBefore(now)) && (kitGroup.endDate == null || moment(kitGroup.endDate).isAfter(now)) && (p.masterStatus == "A" && p.onHold == false && (p.masterType == "R" || p.masterType == "B" || p.masterType == null || type == "group"))) {
                                                // the kitgroup is in range and should be valid
                                                hasValidComponentOption = true;
                                            }
                                        } else {
                                            console.warn("processAvailabilityAndHiddenProducts(): kitGroup", kitGroup.kitGroupId, "product", component.productId, "is not found");
                                        }
                                    }

                                    // mark products as available/unavailable based on kitGroup date range and having any valid products
                                    if (!hasValidComponentOption) {
                                        //console.log("processAvailabilityAndHiddenProducts(): hiding product", product.id, "because a kitGroup product", p.id, "is not found");
                                        unavailableComponents = true;
                                        // also set this kitGroup to hidden
                                        updates["kitGroups." + j + ".unavailable"] = true;
                                    } else {
                                        updates["kitGroups." + j + ".unavailable"] = false;
                                    }

                                    //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "kitGroup", sku, "numAvailableForKitGroup", numAvailableForKitGroup);

                                    if (numAvailableForKitGroup == 0 || !hasValidComponentOption) {
                                        //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "product has 0 availability, since a kitGroup has 0 inventory");
                                        availableInventory = 0;
                                        break;
                                    } else if (availableCount != null) {
                                        availableCount = numAvailableForKitGroup < availableCount ? numAvailableForKitGroup : availableCount;
                                        //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "inventory now", availableCount);
                                    } else {
                                        availableCount = numAvailableForKitGroup;
                                        //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "inventory now", availableCount);
                                    }
                                }
                            }

                            availableInventory = availableCount && availableCount < availableInventory ? availableCount : availableInventory;
                            //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "availability after kitGroup check", availableInventory);
                        }

                        //console.log("processAvailabilityAndHiddenProducts(): product", product.id, "updating availability to", availableInventory);
                        updates["availableInventory"] = availableInventory;
                        updates["unavailableComponents"] = unavailableComponents;

                        //console.log("processAvailabilityAndHiddenProducts(): processing updates for product", product.id, updates);
                        if (deductFromInventory[product.id]) {
                            console.log("processAvailabilityAndHiddenProducts(): deducting", deductFromInventory[product.id], "for purchases of", product.id);
                            updates["availableInventory"] = availableInventory - deductFromInventory[product.id];
                        }

                        // update the product/kit/group with the resultant inventory
                        models.Product.findOneAndUpdate({
                            _id: product.id
                        }, updates, {upsert: true}, function (err, product) {
                            if (err) {
                                console.log("processAvailabilityAndHiddenProducts(): error updating product inventory", err);
                                deferred.reject(err);
                                return;
                            }

                            //console.log("processAvailabilityAndHiddenProducts(): updated inventory for product", product.type, "to", product.availableInventory);
                            finalInventory[product.id] = product.availableInventory;
                        });
                    }
                }, function(err) {
                    console.log("processAvailabilityAndHiddenProducts(): error on fetching order historys", err);
                });
            });

            deferred.resolve(finalInventory);
        });
    });

    return deferred.promise;
}

function searchProducts(searchString, loadUnavailable, skip, limit) {
    var d = Q.defer();
    var now = new Date();

    console.log("searchProducts()", searchString, loadUnavailable, skip, limit);

    var query = {$and: [
        {$text: { $search: "" + searchString }}
    ]};
    if (!loadUnavailable) {
        query["$and"] = query["$and"].concat([
            {masterStatus: "A", onHold: false, searchable: true, unavailableComponents: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ])
    }

    models.Product.find(query, {score: { $meta: "textScore" }})
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: [
            {masterStatus: "A", onHold: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ]}
    }).populate({
        path: 'contains.product',
        model: 'Product'
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup'
    }).exec(function (err, products) {
        if (err) {
            console.log("error getting products by string", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        //var opts = {
        //    path: 'kitGroups.kitGroup.components.product',
        //    model: 'Product',
        //    match: { $and: [
        //        {masterStatus: "A", onHold: false},
        //        {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
        //    ]}
        //}
        //
        //// populate components
        //models.Product.populate(products, opts, function (err, products) {

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                return (obj.product !== null);
            });
            products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                return (obj.product !== null);
            });
        }

        console.log("returning", products.length, "products");
        d.resolve(products);
        //})
    });

    return d.promise;
}

function loadProductsByCategory(categoryId, loadUnavailable, skip, limit, sort) {
    var d = Q.defer();
    var now = new Date();

    console.log("loadProductsByCategory()", categoryId, loadUnavailable, skip, limit, sort);

    var query = {$and: [
        {categories: {$in: categoryToChildren[categoryId]}}
    ]};

    if (!loadUnavailable) {
        query["$and"] = query["$and"].concat([
            {masterStatus: "A", onHold: false, searchable: true, unavailableComponents: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ])
    }

    models.Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: [
            {masterStatus: "A", onHold: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ]}
    }).populate({
        path: 'contains.product',
        model: 'Product'
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
            console.log("error getting products by category", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        //var opts = {
        //    path: 'kitGroups.kitGroup.components.product',
        //    model: 'Product',
        //    match: { $and: [
        //        {masterStatus: "A", onHold: false},
        //        {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
        //    ]}
        //}
        //
        //// populate components
        //models.Product.populate(products, opts, function (err, products) {

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                return (obj.product !== null);
            });
            products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                return (obj.product !== null);
            });
        }

        console.log("returning", products.length, "products");
        d.resolve(products);
        //})
    });

    return d.promise;
}

function loadProductsById(productIds, loadUnavailable) {
    var d = Q.defer();
    var now = new Date();

    console.log("loadProductsById()", productIds, loadUnavailable);

    var query = {$and: [
        {_id: { $in: productIds }}
    ]};

    if (!loadUnavailable) {
        query["$and"] = query["$and"].concat([
            {masterStatus: "A", onHold: false, unavailableComponents: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ])
    }

    models.Product.find(query)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: [
            {masterStatus: "A", onHold: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ]}
    }).populate({
        path: 'contains.product',
        model: 'Product'
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup'
    }).exec(function (err, products) {
        if (err) {
            console.log("error getting products by ID", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        //var opts = {
        //    path: 'kitGroups.kitGroup.components.product',
        //    model: 'Product',
        //    match: { $and: [
        //        {masterStatus: "A", onHold: false},
        //        {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
        //    ]}
        //}
        //
        //// populate components
        //models.Product.populate(products, opts, function (err, products) {

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                return (obj.product !== null);
            });
            products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                return (obj.product !== null);
            });
        }

        console.log("returning", products.length, "products");
        d.resolve(products);
        //})
    });

    return d.promise;
}

function loadProducts(loadUnavailable, skip, limit, sort) {
    var d = Q.defer();
    var now = new Date();

    console.log("loadProducts()", loadUnavailable, skip, limit, sort);

    var query = {};

    if (!loadUnavailable) {
        query = {$and: [
            {masterStatus: "A", onHold: false, searchable: true, unavailableComponents: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ]};
    }

    models.Product.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: [
            {masterStatus: "A", onHold: false},
            {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]},
            {$or: [
                {$and: [{type: "group"}, {prices: {$exists: false}}]},
                {prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{$gte: now}}}}
            ]}
        ]}
    }).populate({
        path: 'contains.product',
        model: 'Product'
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup'
    }).exec(function (err, products) {
        if (err) {
            console.log("error getting products", err);
            d.reject(err);
            return;
        }

        products = products ? products : [];

        // filter out upsellItems and youMailAlsoLike that aren't available
        for (var i=0; i < products; i++) {
            products[i].upsellItems = products[i].upsellItems.filter(function (obj, index) {
                return (obj.product !== null);
            });
            products[i].youMayAlsoLike = products[i].youMayAlsoLike.filter(function (obj, index) {
                return (obj.product !== null);
            });
        }

        console.log("returning", products.length, "products");
        d.resolve(products);
    });

    return d.promise;
}

function loadProductById(productId, loadUnavailable) {
    var d = Q.defer();
    var now = new Date();

    console.log("loadProductById()", productId, loadUnavailable);

    var query = {$and: [
        {_id: productId}
    ]};

    if (!loadUnavailable) {
        query["$and"] = query["$and"].concat([
            { masterStatus: "A", onHold: false, unavailableComponents: false },
            { $or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group" }]},
            { $or: [
                { $and: [{type: "group"}, {prices: {$exists: false }}]},
                { prices: {$elemMatch: {"effectiveStartDate":{ $lte: now }, "effectiveEndDate":{ $gte: now }}}}
            ]}
        ]);
    }

    models.Product.find(query).populate({
        path: 'upsellItems.product youMayAlsoLike.product',
        model: 'Product',
        match: { $and: [
            { masterStatus: "A", onHold: false},
            { $or: [{masterType: "R"}, { masterType: {$exists: false}, type:"group" }]},
            { $or: [
                { $and: [{type: "group"}, {prices: {$exists: false}}]},
                { prices: {$elemMatch: {"effectiveStartDate":{$lte: now}, "effectiveEndDate":{ $gte: now }}}}
            ]}
        ]}
    }).populate({
        path: 'contains.product',
        model: 'Product'
    }).populate({
        path: 'kitGroups.kitGroup',
        model: 'KitGroup'
    }).exec(function (err, products) {
        if (err) {
            console.error("error populating product", err);
            d.reject({
                statusCode: 500,
                errorCode: "productLookupFailed",
                errorMessage: "Failed to lookup product"
            });
            return;
        }
        if (products.length == 1) {
            console.log("returning", products.length, "products");

            //var opts = {
            //    path: 'kitGroups.kitGroup.components.product',
            //    model: 'Product',
            //    match: { $and: [
            //        {masterStatus: "A", onHold: false},
            //        {$or: [{masterType: "R"}, {masterType: {$exists: false}, type:"group"}]}
            //    ]}
            //}
            //
            //// populate components
            //models.Product.populate(products, opts, function (err, products) {
            console.log("returning", products.length, "products");

            // TMP
            //console.log('products:', products);
            products[0].upsellItems = products[0].upsellItems.filter(function (obj, index) {
                return (obj.product !== null);
            });
            products[0].youMayAlsoLike = products[0].youMayAlsoLike.filter(function (obj, index) {
                return (obj.product !== null);
            });
            console.log('products (filtered null upsells):', products);
            d.resolve(products[0]);
            //})

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

// EXPORTS
exports.preloadCategories = preloadCategories;

exports.authenticate = authenticate;
exports.getClient = getClient;
exports.createClient = createClient;
exports.createConsultant = createConsultant;
exports.getConsultant = getConsultant;
exports.lookupConsultant = lookupConsultant;
exports.lookupConsultantByEmail = lookupConsultantByEmail;
exports.lookupClientByEmail = lookupClientByEmail;
exports.createLead = createLead;

exports.createOrder = createOrder;

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

exports.loadProducts = loadProducts;
exports.searchProducts = searchProducts;
exports.loadProductsByCategory = loadProductsByCategory;
exports.loadProductsById = loadProductsById;
exports.loadProductById = loadProductById;
