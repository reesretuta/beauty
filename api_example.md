Authenticate
============
**Method**: POST
**URL**: /clients/authenticate
**Request**:
```json
{
  "email": "jsmith@gmail.com", // required
  "password": "some password"  // required
}

```
Success
-------
**Status Code**: 200
**Response**:
```json
{
  "clientId": <clientId>
}
```
Errors
------
**Status Code**: 401
**Responses**:

```json
{
    "statusCode": 401,
    "errorCode": "invalidCredentials",
    "message": "Invalid Credentials"
}
```

Create Client
=============
**Method**: POST
**URL**: /clients
**Info**: Create a new client record, which can be used to authenticate into Client Direct & future systems
**Request**:
```json
{
  "email": "jsmith@gmail.com", // required
  "password": "some password", // required
  "firstName": "John",         // optional
  "lastName": "Smith",         // optional
  "consultantId": 4657323,     // optional
  "language": "en"             // optional
}

```
Success
-------
**Status Code**: 201
**Response**:
```json
{
  "clientId": <clientId>
}

```
Errors
------
**Status Code**: 400
**Info**: Specified data was invalid and should be rejected by the server
**Responses**:

Only respond with this when the optional consultant ID is provided and it isn't valid.  Ignore instead if empty
```json
{
    "statusCode": 400,
    "errorCode": "invalidConsultantId",
    "message": "Invalid consultant Id"
}
```
Invalid email format, bad characters, etc.
```json
{
    "statusCode": 400,
    "errorCode": "invalidEmailAddress",
    "message": "Invalid email address"
}
```
Password that doesn't meet password requirements (length, variation, etc.)
```json
{
    "statusCode": 400,
    "errorCode": "invalidPassword",
    "message": "Invalid password"
}
```

**Status Code**: 409
**Responses**:

There was a conflict creating an account with the specified email, because it is already in the system.
```json
{
    "statusCode": 409,
    "errorCode": "emailAlreadyInUse",
    "message": "Email address already in use"
}
```

Create Consultant
=================

**Method**: POST
**URL**: /consultants
**Info**: This is similar to creating a Client, however a few more fields are required.  Create a consultant record, which can be used to authenticate into Jafra Biz & eventually Client Direct.
**Request**:
```json
{
  "consultant" true,           // required
  "ssn": "555-234-1122",       // required
  "email": "jsmith@gmail.com", // required
  "password": "some password", // required
  "firstName": "John",         // required
  "lastName": "Smith",         // required
  "phone": "555-234-1122",     // required
  "dateOfBirth": "12/1/1978",  // required
  "sponsorId": 4268286,        // optional
  "language": "en"             // optional
}
```

***consultant*** - this must be set to true for consultant records.  Setting this to true will require the consultant-specific fields to be filled out (SSN, dateOfBirth, sponsorId)
***sponsorId*** - initially create as a house account when not specified, send information to CRT for contact and manual sponsor assignment.

Success
-------
**Status Code**: 201
**Response**:
```json
{
    "consultantId": <consultantId>
}
```

Errors
------
**Status Code**: 400
**Info**: Specified data was invalid and should be rejected by the server
**Responses**:

The SSN was not properly formatted or was otherwise invalid.
```json
{
    "statusCode": 400,
    "errorCode": "invalidSSN",
    "message": "Invalid SSN"
}
```

Only respond with this when the optional sponsor ID is provided and it isn't valid.  Ignore instead if empty
```json
{
    "statusCode": 400,
    "errorCode": "invalidSponsorId",
    "message": "Invalid sponsor Id"
}
```
Invalid email format, bad characters, etc.
```json
{
    "statusCode": 400,
    "errorCode": "invalidEmailAddress",
    "message": "Invalid email address"
}
```
Password that doesn't meet password requirements (length, variation, etc.)
```json
{
    "statusCode": 400,
    "errorCode": "invalidPassword",
    "message": "Invalid password"
}
```

**Status Code**: 409
**Responses**:

There was a conflict creating an account with the specified email, because it is already in the system.
```json
{
    "statusCode": 409,
    "errorCode": "emailAlreadyInUse",
    "message": "Email address already in use"
}
```

There was a conflict creating an account with the specified SSN, because it is already in the system.
```json
{
    "statusCode": 409,
    "errorCode": "ssnAlreadyInUse",
    "message": "SSN already in use"
}
```

Create Lead
===========
**Method**: POST
**URL**: /leads
**Info**: Created from basic info provided as new consultant is signing up
**Request**:
```json
{
  "firstName": "John",         // required
  "lastName": "Smith",         // required
  "email": "jsmith@gmail.com", // required
  "phone": "555-234-1122",     // required
  "language": "en"             // required
}
```

Success
-------
**Status Code**: 204

Errors
------
**Status Code**: 400
**Responses**:

A generic message that simply tells us the server didn't like the data it received and the lead was not saved. 
```json
{
    "statusCode": 400,
    "errorCode": "invalidLeadData",
    "message": "Invalid lead data"
}
```

Get all Addresses by clientId
=============================

**Method**: GET
**URI**: /clients/&lt;clientId&gt;/addresses

Success
-------

**Status Code**: 200
**Response Body**:
```json
[{
  "id": 111,
  "name": "Joe Smith",
  "address1": "1111 Test Ln",
  "address2": "",
  "city": "Corona",
  "state": "CA",
  "zip": "92880",
  "country": "United States",
  "phone": "555-333-2222"
}]
```

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

Get Address
===========

**Info**: Get a specific address for client by clientId
**Method**: GET
**URI**: /clients/&lt;clientId&gt;/addresses/&lt;addressId&gt;

Success
-------

**Status Code**: 200
**Response**:
```json
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
```

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

The address ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "addressNotFound",
  "message": "Address not found
}
```

Create Address
==============

**Method**: POST
**URI**: /clients/&lt;clientId&gt;/addresses
**Request:**
```json
{
  "name": "Joe Smith",        // optional
  "address1": "1111 Test Ln", // required
  "address2": "",             // optional
  "city": "Corona",           // required
  "state": "CA",              // required
  "zip": "92880",             // required
  "country": "United States", // required
  "phone": "555-333-2222"     // optional
}
```

Success
-------

**Status Code**: 200
**Response**:
```json
{
  "addressId": <addressId>
}
```

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

Update Address
==============

**Method**: PUT
**URI**: /clients/&lt;clientId&gt;/addresses/&lt;addressId&gt;

Success
-------

**Status Code**: 204

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

The address ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "addressNotFound",
  "message": "Address not found
}
```

Delete Address
==============

**Method**: DELETE
**URI**: /clients/&lt;clientId&gt;/addresses/&lt;addressId&gt;

Success
-------

**Status Code**: 204

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

The address ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "addressNotFound",
  "message": "Address not found
}
```

Get all Credit Cards by clientId
================================

**Method**: GET
**URI**: /clients/&lt;clientId&gt;/creditCards

Success
-------

**Status Code**: 200
**Response Body**:
```json
[{
  "id": 123,
  "name": "Joe Smith",
  "card": "4111111111111111",
  "expiration": "12/1978",
  "cvv": "1111",
  "billingAddress1": "2222 Blah Rd",
  "billingAddress2": "",
  "billingCity": "Culver City",
  "billingState": "CA",
  "billingZip": "90232",
  "billingCountry": "United States",
  "billingPhone": "555-333-2222"
}]
```

Errors
------

**Status Code**: 404
**Response Body**:

The client ID is not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

Get Credit Card
===============

**Info**: Get a specific creditCard for client by clientId
**Method**: GET
**URI**: /clients/&lt;clientId&gt;/creditCards/&lt;creditCardId&gt;

Success
-------

**Status Code**: 200
**Response**:
```json
{
  "id": 111,
  "name": "Joe Smith",
  "card": "4111111111111111",
  "expiration": "12/1978",
  "cvv": "1111",
  "billingAddress1": "2222 Blah Rd",
  "billingAddress2": "",
  "billingCity": "Culver City",
  "billingState": "CA",
  "billingZip": "90232",
  "billingCountry": "United States",
  "billingPhone": "555-333-2222"
}
```

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

The creditCard ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

Create Credit Card
==================

**Method**: POST
**URI**: /clients/&lt;clientId&gt;/creditCards
**Request:**
```json
{
  "name": "Joe Smith",               // required
  "card": "4111111111111111",        // required
  "expiration": "12/1978",           // required
  "cvv": "1111",                     // required
  "billingAddress1": "2222 Blah Rd", // optional
  "billingAddress2": "",             // optional
  "billingCity": "Culver City",      // optional
  "billingState": "CA",              // optional
  "billingZip": "90232",             // optional
  "billingCountry": "United States", // optional
  "billingPhone": "555-333-2222"     // optional
}
```

Success
-------

**Status Code**: 200
**Response**:
```json
{
  "creditCardId": <creditCardId>
}
```

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

Update Credit Card
==================

**Method**: PUT
**URI**: /clients/&lt;clientId&gt;/creditCards/&lt;creditCardId&gt;
**Request:**
```json
{
  "name": "Joe Smith",               // required
  "card": "4111111111111111",        // required
  "expiration": "12/1978",           // required
  "cvv": "1111",                     // required
  "billingAddress1": "2222 Blah Rd", // optional
  "billingAddress2": "",             // optional
  "billingCity": "Culver City",      // optional
  "billingState": "CA",              // optional
  "billingZip": "90232",             // optional
  "billingCountry": "United States", // optional
  "billingPhone": "555-333-2222"     // optional
}
```
The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

Success
-------

**Status Code**: 204

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

The creditCard ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "creditCardNotFound",
  "message": "Credit card not found"
}
```

Delete Credit Card
==================

**Method**: DELETE
**URI**: /clients/&lt;clientId&gt;/creditCards/&lt;creditCardId&gt;

Success
-------

**Status Code**: 204

Errors
------

**Status Code**: 404
**Response Body**:

The client ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "clientNotFound",
  "message": "Client not found
}
```

The creditCard ID was not found

```json
{
  "statusCode": 404,
  "errorCode": "creditCardNotFound",
  "message": "Credit card not found"
}
```

Create Order
============
**Method**: POST
**URI**: /orders
**Info**: Process a consultant ***or*** client order for the specified SKUs (potentially including kit selections)
**Request**:
```json
{
  "firstName": "John",         // required
  "lastName": "Smith",         // required
  "clientId": 237654,          // required
  "ssn": "553-21-1923",        // required
  "billingAddressId": 326754,  // required
  "shippingAddressId": 326755, // required
  "creditCardId": 74545,       // required
  "agreementAccepted": true,   // required
  "products": [                // required
    {
      "sku": "25386"
    },
    {
      "sku": "14038",
      "kitSelections": [ "NUPL1202", "NUPL7462" ]
    }
  ]
}
```
***clientId*** - this field will be used to associate with a previously created consultant / client
***products*** - list of products with optional configurations.  TBD: include quantity or simply have multiple items?

Success
-------
**Status Code**: 200
**Response**:
```json
{
    "orderId": <orderId>
}
```

Errors
------
**Status Code**: 400
**Info**: Specified data was invalid and should be rejected by the server
**Responses**:

A generic message that simply tells us the server didn't like the data it received and the order was not processed.  We could break this into more specific errors, but probably not needed for v1.
```json
{
    "statusCode": 400,
    "errorCode": "invalidOrderData",
    "message": "Invalid order data"
}
```
