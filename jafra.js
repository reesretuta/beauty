'use strict';

var request = require('request');
var SHA1 = require("crypto-js/sha1");
var Q = require('q');
var soap = require('soap');

var BASE_URL = "http://189.206.20.52:8091/cgidev2";
var AUTHENTICATE_URL = BASE_URL + "/JCD05001P.pgm";
var GET_CLIENT_URL = BASE_URL + "/JCD05007P.pgm";
var CREATE_CLIENT_URL = BASE_URL + "/JCD05002P.pgm";
var GET_CONSULTANT_URL = BASE_URL + "/JOS05007P.pgm";
var CREATE_LEAD_URL = BASE_URL + "/JOS05005P.pgm";
var GET_ADDRESSES_URL = BASE_URL + "/JCD05005P.pgm";
var GET_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";
var CREATE_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";
var UPDATE_ADDRESS_URL = BASE_URL + "JCD05005P.pgm";
var DELETE_ADDRESS_URL = BASE_URL + "/JCD05005P.pgm";
var CREATE_CREDIT_CARD_URL = BASE_URL + "/testrsa.pgm";

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

    var r = request.post({
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

    var r = request.post({
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

    var r = request.post({
        url: CREATE_ADDRESS_URL,
        qs: {
            clientId: clientId
        },
        form: {
            "clientId": clientId,
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

function updateAddress(address) {

}

function deleteAddress(clientId, addressId) {
    console.log("deleteAddress", clientId, addressId);
    var deferred = Q.defer();

    var r = request.del({
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

        console.log("validateEmail(): body", body);

        if (body && body.WebServiceResponse && body.WebServiceResponse.VerifyEmailResponse &&
            body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult &&
            body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus &&
            body.WebServiceResponse.VerifyEmailResponse.VerifyEmailResult.ServiceStatus.StatusNbr == 200)
        {
            console.log("validateEmail(): valid");
            deferred.resolve({
                status: 200,
                result: body
            });
        } else {
            deferred.reject({
                status: 500,
                result: {
                    statusCode: 500,
                    errorCode: "invalidEmailAddress",
                    message: "Invalid email address"
                }
            });
        }
    });

    return deferred.promise;
}

function validateAddress(address) {
    var deferred = Q.defer();

    var options = {
        ignoredNamespaces: {
            namespaces: ['q1', 'q2']
        }
    }

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
        }, function(err, result) {
            console.log("validateAddress()", error, result);
            if (error || response.statusCode != 200) {
                console.error("validateAddress(): error", error, response.statusCode, result);
                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "validateAddressFailed",
                        message: "Unknown error while validating address"
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
            if (result && result.NorthAmericanAddressVerificationResult &&
                result.NorthAmericanAddressVerificationResult.ServiceResult &&
                result.NorthAmericanAddressVerificationResult.ServiceResult.USAddress &&
                result.NorthAmericanAddressVerificationResult.ServiceStatus.StatusNbr == 200)
            {
                console.log("validateAddress(): success", result.NorthAmericanAddressVerificationResult.ServiceResult.USAddress);

                /**
                 * State, Urbanization, ZIPPlus4, ZIPCode, ZIPAddOn, CarrierRoute, PMB, PMBDesignator,
                 * DeliveryPoint, DPCheckDigit, LACS, CMRA, DPV, DPVFootnote, RDI, RecordType,
                 * CongressDistrict, County, CountyNumber, StateNumber, GeoCode
                 */
                //console.log("getClient(): success", body);
                deferred.resolve({
                    status: 200,
                    result: result.NorthAmericanAddressVerificationResult.ServiceResult.USAddress
                });
            } else {
                console.error("validateAddress(): result was not expected", result);

                deferred.reject({
                    status: 500,
                    result: {
                        statusCode: 500,
                        errorCode: "invalidAddress",
                        message: "Invalid address"
                    }
                });
            }
        });
    });

    return deferred.promise;
}

function createCreditCard(clientId, data) {
    //console.log("createAddress", email, password);
    var deferred = Q.defer();

    var r = request.post({
        url: CREATE_CREDIT_CARD_URL,
        qs: {
            clientId: clientId
        },
        form: {
            "dataToDecrypt": data
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

exports.authenticate = authenticate;
exports.getClient = getClient;
exports.createClient = createClient;
exports.getConsultant = getConsultant;
exports.createLead = createLead;
exports.getAddresses = getAddresses;
exports.getAddress = getAddress;
exports.createAddress = createAddress;
exports.updateAddress = updateAddress;
exports.deleteAddress = deleteAddress;
exports.validateEmail = validateEmail;
exports.validateAddress = validateAddress;
exports.createCreditCard = createCreditCard;