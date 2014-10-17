'use strict';

var request = require('request');
var SHA1 = require("crypto-js/sha1");
var Q = require('q');
var soap = require('soap');
var parseString = require('xml2js').parseString;

var BASE_URL = "http://" + (process.env.JCS_API_URL || "189.206.20.52") + ":8091/cgidev2";
var BASE_URL2 = "http://" + (process.env.JCS_API_URL || "189.206.20.52") + ":8091/WEBCGIPR";

var AUTHENTICATE_URL = BASE_URL + "/JCD05001P.pgm";
var GET_CLIENT_URL = BASE_URL + "/JCD05007P.pgm";
var CREATE_CLIENT_URL = BASE_URL + "/JCD05002P.pgm";

var GET_CONSULTANT_URL = BASE_URL + "/JOS05007P.pgm";
var CREATE_CONSULTANT_URL = BASE_URL + "/JOS05002P.pgm";
var LOOKUP_CONSULTANT_URL = BASE_URL + "/JOS05004P.pgm";
//var CREATE_LEAD_URL = BASE_URL + "/JOS05005P.pgm";

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
var GET_INVENTORY_URL = BASE_URL + "/JCD05021P.pgm"; // productId=<productId>

var GET_GEOCODES_URL = BASE_URL2 + "/JNS0002R.pgm";
var GET_SALES_TAX_URL = BASE_URL + "/JCD05022P.pgm";

var STRIKEIRON_EMAIL_URL = 'http://ws.strikeiron.com/StrikeIron/emv6Hygiene/EMV6Hygiene/VerifyEmail';
var STRIKEIRON_EMAIL_LICENSE = "2086D15410C1B9F9FF89";
var STRIKEIRON_EMAIL_TIMEOUT = 15;

//var STRIKEIRON_ADDRESS_URL = 'http://ws.strikeiron.com/StrikeIron/NAAddressVerification6/NorthAmericanAddressVerificationService/NorthAmericanAddressVerification';
var STRIKEIRON_ADDRESS_SOAP_URL = 'http://ws.strikeiron.com/NAAddressVerification6?WSDL';
var STRIKEIRON_ADDRESS_LICENSE = "0DA72EA3199C10ABDE0B";

// NOTE: for now, get URLs all take query string params

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
            'Accept': 'application/json'
        },
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            console.error("authenticate(): error", error, response.statusCode, body);
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
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        console.log("getClient()", error, response.statusCode, body);
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
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 201) {
            console.error("createClient(): error", response.statusCode, body);

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
        console.debug("createClient(): returning success");
        var clientId = body.clientId;
        deferred.resolve({
            status: 201,
            result: body
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
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        console.log("getConsultant()", error, response.statusCode, body);
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
            'Accept': 'application/json, text/json'
        },
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
            'Accept': 'application/json, text/json'
        },
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

function createLead(lead) {

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
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            console.error("getAddresses(): error", error, response.statusCode, body);
            deferred.reject({error: error, response: response, body: body});
        }
        //console.log("getAddresses(): success", body);
        deferred.resolve({response: response, body: body});
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
            'Accept': 'application/json, text/json'
        },
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
            'Accept': 'application/json, text/json'
        },
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
            "geocode": "00000",
            "stateDescription": "California",
            "county" : "Los Angeles"
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json'
        },
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
            'Accept': 'application/json, text/json'
        },
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
        console.log("validateEmail()", error, response.statusCode, body);
        if (error || response.statusCode != 200) {
            console.error("validateEmail(): error", error, response.statusCode, body);
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

                    var a = {
                        name: address.name,
                        address1: usAddress.AddressLine1.length > 0 ? usAddress.AddressLine1 : "",
                        address2: usAddress.AddressLine2.length > 0 ? usAddress.AddressLine2 : "",
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
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            console.error("getCreditCards(): error", error, response.statusCode, body);
            deferred.reject({error: error, response: response, body: body});
        }
        //console.log("getCreditCards(): success", body);
        deferred.resolve({response: response, body: body});
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
            creditCardId: creditCardId
        },
        headers: {
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
            console.error("getCreditCard(): error", error, response.statusCode, body);
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
            'Accept': 'application/json, text/json'
        },
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

        if (body == null || body.creditCardId == null) {
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
            result: body.creditCardId
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
            creditCardId: creditCardId
        },
        form: {
            "valToDecrypt": data
        },
        headers: {
            'Content-Type' : 'application/x-www-form-urlencoded',
            'Accept': 'application/json, text/json'
        },
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

        if (body == null || body.creditCardId == null) {
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
            status: 204,
            result: body.creditCardId
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
            creditCardId: creditCardId
        },
        headers: {
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        if (error || response.statusCode != 204) {
            console.error("deleteCreditCard(): error", response.statusCode, body);

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
            'Accept': 'application/json, text/json'
        },
        json: true
    }, function (error, response, body) {
        console.log("getGeocodes()", error, response.statusCode, body);
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
    var deferred = Q.defer();

    request.get({
        url: GET_SALES_TAX_URL,
        headers: {
            'Accept': 'application/json, text/json'
        },
        qs: {
            clientId: data.clientId,
            consultantId: data.consultantId,
            geocode: data.geocode,
            typeOrder: data.typeOrder,
            source: data.source,
            products: JSON.stringify(data.products)
        },
        json: true
    }, function (error, response, body) {
        console.log("getCalculateTax()", error, response.statusCode, body);
        if (error || response.statusCode != 200) {
            console.error("getCalculateTax(): error", error, response.statusCode, body);
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

exports.authenticate = authenticate;
exports.getClient = getClient;
exports.createClient = createClient;
exports.createConsultant = createConsultant;
exports.getConsultant = getConsultant;
exports.lookupConsultant = lookupConsultant;
exports.createLead = createLead;

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
