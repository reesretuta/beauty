
LVI Jafra Data Models
=================
**Table of Contents**

- [Introduction](#introduction)
- [Models](#models)
-- [Images](#images)
-- [Categories](#categories)
-- [Shared Assets](#shared-assets)
-- [Shared Attributes](#shared-attributes)
-- [Kit Groups](#kit-groups)
-- [Leads](#leads)
-- [Order History](#order-history)
-- [Product Prices](#product-prices)
-- [Products](#products)
-- [Product Text Search](#product-text-search)
-- [Password Reset Token](#password-reset-token)
-- [Consultants](#consultants)


Introduction
==========

This document describes the LVI Platform models used for Jafra.  The format of these models follows a Mongoose MongoDB  schema structure and provides the basis for the Object Relational Mapping (ORM) used by the platform.  Although MongoDB is a schema-less database, schema is enforced on the database client side by Mongoose.

Models
======

Images
----------

```JSON
{
    "alt" : String,
    "endDate" : { type: Date, default: null },
    "startDate" : { type: Date, default: null },
    "rank" : Number,
    "imagePath" : String
}
```

Categories
-------------

```JSON
{
    "_id" : Number,
    "name" : String,
    "name_es_US" : String,
    "description" : String,
    "description_es_US" : String,
    "rank" : Number,
    "onHold" : Boolean,
    "showInMenu" : Boolean,
    "searchable" : Boolean,
    "parent" : {type: Number, ref: 'Category'},
    "children" : [{type: Number, ref: 'Category'}],
    "customerTypes" : [String],
    "endDate" : { type: Date, default: null },
    "startDate" : { type: Date, default: null },
    "images": [imageSchema]
}
```

Shared Assets
-----------------

```JSON
{
    "_id" : Number,
    "systemRef" : String,
    "rank" : Number,
    "title" : String,
    "description" : String,
    "marketingText" : String,
    "endDate" : { type: Date, default: null },
    "startDate" : { type: Date, default: null }
    // FIXME - add image
}
```

Shared Attributes
---------------------

```JSON
{
    "_id" : Number,
    "systemRef" : String,
    "name" : String,
    "description" : String
    // FIXME - add image
}
```

Kit Groups
-------------

```JSON
{
    "_id" : { type: String },
    "name" : String,
    "name_es_US" : String,
    "selectQuantity": Number,
    // kits groups have products they contain
    // NOTE: to reduce complexity, kit groups cannot currently contain other kit groups
    "components" : [{
        "product" : {type: String, ref: 'Product'},
        "productId" : String,
        "rank" : Number,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null }
    }]
}
```

Leads
-------

```JSON
{
    "firstName" : { type : String, required: true },
    "lastName" : { type : String, required: true },
    "email" : { type : String, required: true },
    "phone" : { type : String, required: true },
    "language": { type : String, required: true },
    "type": {type: String},
    "created": { type: Date, default: Date.now },
    "sent": { type: Boolean, default: false },
    "completed": { type: Boolean, default: false }
}
```

Order History
----------------

```JSON
{
    "orderId": Number,
    "firstName": String,
    "lastName": String,
    "clientId": Number,
    "consultantId": Number,
    "language": String,
    "billingAddressId": Number,
    "shippingAddressId": Number,
    "creditCardId": Number,
    "source": String,
    "total": Number,
    "products" : [{
        "product" : {type: String, ref: 'Product'},
        "sku" : String,
        "qty" : Number,
        "kitSelections": Schema.Types.Mixed
    }],
    "created": { type: Date, default: Date.now }
}
```

Product Prices
-----------------

```JSON
{
    "typeId" : Number,
    "qualifyingVolume" : Number,
    "shippingSurcharge" : Number,
    "retailVolume" : Number,
    "instantProfit" : Number,
    "rebate" : Number,
    "commissionableVolume" : Number,
    "price" : Number,
    "customerTypes" : [String],
    "effectiveEndDate" : { type: Date, default: null },
    "effectiveStartDate" : { type: Date, default: null }
}
```

Products
-----------

```JSON
{
    "_id" : { type: String },
    "onHold" : Boolean,
    "standardCost" : Number,
    "productClass" : Number,
    "masterStatus" : String,
    "sharedAssets" : [{type: Number, ref: 'SharedAsset'}],
    "taxCode" : String,
    "promotionalMessages" : [{
        "message" : String,
        "message_es_US" : String,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null }
    }],
    "upsellItems" : [{
        "product" : {type: String, ref: 'Product'},
        "productId" : String,
        "rank" : Number,
        "marketingText" : String,
        "marketingText_es_US" : String,
        "unavailable": {type: Boolean, default: false}
    }],
    "youMayAlsoLike" : [{
        "product" : {type: String, ref: 'Product'},
        "productId" : String,
        "rank" : Number,
        "unavailable": {type: Boolean, default: false}
    }],
    "usage" : String,
    "usage_es_US" : String,
    "images" : [imageSchema],
    "name" : String,
    "name_es_US" : String,
    "quantity" : String,
    "quantity_es_US" : String,
    "categories" : [{type: Number, ref: 'Category'}],
    "description" : String,
    "description_es_US" : String,
    "searchable" : Boolean,
    "hazmatClass" : Number,
    "ingredients" : String,
    "ingredients_es_US" : String,
    "masterType" : String,
    "prices" : [productPriceSchema],
    "valueMessaging" : String,
    "valueMessaging_es_US" : String,
    "launchId" : String,
    // product, group, kit, kitGroup
    "type" : String,
    // NOTE: how many levels deep do we go for kits containing kits, etc.?
    // for now, we'll just do first level down
    "hideWhenProductsUnavailable" : {type : Boolean, default : false},
    // kits & groups can be composed of other products & kitGroups
    "contains" : [{
        "product" : {type: String, ref: 'Product'},
        "productId" : String,
        "quantity" : Number,
        "rank" : Number,
        "display" : Boolean,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null },
        "unavailable": { type: Boolean, default: false}
    }],
    "kitGroups" : [{
        "kitGroup" : {type: String, ref: 'KitGroup'},
        "kitGroupId" : String,
        "rank" : Number,
        "quantity" : Number,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null },
        "unavailable": { type: Boolean, default: false}
    }],
    "availableInventory": { type: Number, default: 0 },
    "unavailableComponents": { type: Boolean, default: false},
    "lastUpdated": { type: Date, default: Date.now }
}
```

Product Text Search
------------------------

Multi-Key Text Index & Weights

```JSON
{
    _id: "text",
    name: "text",
    name_es_US: "text",
    description: "text",
    description_es_US: "text",
    usage: "text",
    usage_es_US: "text",
    ingredients: "text",
    ingredients_es_US: "text",
    valueMessaging: "text",
    valueMessaging_es_US: "text"
}, {
    name: "text_search_index",
    weights: {
        "name": 3,
        "name_es_US": 3,
        "description": 2,
        "description_es_US": 2
    }
}
```

Password Reset Token
---------------------------

```JSON
{
    "token" : { type: String, unique: true },
    "email" : { type: String, unique: false },
    "language" : { language: String, unique: false },
    "created" : { type: Date, default: Date.now }
}
```

Consultants
--------------

```JSON
{
    id : { type : Number },
    firstName : { type : String, required : true },
    lastName : { type : String, required : true },
    zip : { type : String, required : true },
    geocode: { type : String, required : true },
    isActive: { type : Number, required : true }
}
```
