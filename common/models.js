var mongoose = require("mongoose");
Schema = mongoose.Schema;
mongoose.connect('mongodb://localhost/jafra');

var db = mongoose.connection;

// IMAGES
var imageSchema = Schema({
    "alt" : String,
    "endDate" : { type: Date, default: null },
    "startDate" : { type: Date, default: null },
    "rank" : Number,
    "imagePath" : String
});

// CATEGORIES
var categorySchema = Schema({
    "_id" : Number,
    "name" : String,
    "description" : String,
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
}, { id: false });

// Duplicate the ID field.
categorySchema.virtual('id').get(function(){
    return this._id;
});

// Ensure virtual fields are serialised.
categorySchema.set('toJSON', {
    virtuals: true
});

var Category = mongoose.model('Category', categorySchema);
exports.Category = Category;


// SHARED ASSETS
var sharedAssetSchema = Schema({
    "_id" : Number,
    "systemRef" : String,
    "rank" : Number,
    "title" : String,
    "description" : String,
    "marketingText" : String,
    "endDate" : { type: Date, default: null },
    "startDate" : { type: Date, default: null }
    // FIXME - add image
});

var SharedAsset = mongoose.model('SharedAsset', sharedAssetSchema);
exports.SharedAsset = SharedAsset;


// SHARED ATTRIBUTES
var sharedAttributesSchema = Schema({
    "_id" : Number,
    "systemRef" : String,
    "name" : String,
    "description" : String
    // FIXME - add image
});

var SharedAttribute = mongoose.model('SharedAttribute', sharedAttributesSchema);
exports.SharedAttribute = SharedAttribute;


//// SYSTEM REFS
//// NOTE - these are a type of identifier we have to work with that
//// are used like soft foreign keys into multiple types of objects.
//// Store separately for now for lookup and translation into proper
//// foreign keys for each object type (SKU / Kit Group ID)
//var systemRefSchema = Schema({
//    "systemRef" : { type: String, unique: true },
//    "objectType" : String, // product (product, group, kit), kitGroup
//    "product" : { type: String, ref: 'Product'},
//    "productKitGroup" : { type: Number, ref: 'ProductKitGroup'}
//});
//
//var SystemRef = mongoose.model('SystemRef', systemRefSchema);
//exports.SystemRef = SystemRef;


// KIT GROUP
var kitGroupSchema = Schema({
    "_id" : { type: String, unique: true },
    // kits groups have products they contain
    // NOTE: to reduce complexity, kit groups cannot currently contain other kit groups
    "components" : [{
        "product" : {type: String, ref: 'Product'},
        "rank" : Number,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null }
    }]
}, { id: false });

// Duplicate the ID field.
kitGroupSchema.virtual('id').get(function(){
    return this._id;
});

var KitGroup = mongoose.model('KitGroup', kitGroupSchema);
exports.KitGroup = KitGroup;


// PRODUCTS
var productPriceSchema = Schema({
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
});

var productSchema = Schema({
    "_id" : { type: String, unique: true },
    "onHold" : String,
    "standardCost" : Number,
    "productClass" : Number,
    "masterStatus" : String,
    "sharedAssets" : [{type: Number, ref: 'SharedAsset'}],
    "taxCode" : String,
    "upsellItems" : [{
        "product" : {type: String, ref: 'Product'},
        "rank" : Number,
        "marketingText" : String
    }],
    "youMayAlsoLike" : [{
        "product" : {type: String, ref: 'Product'},
        "rank" : Number
    }],
    "usage" : String,
    "images" : [imageSchema],
    "name" : String,
    "quantity" : String,
    "categories" : [{type: Number, ref: 'Category'}],
    "description" : String,
    "searchable" : Boolean,
    "hazmatClass" : Number,
    "ingredients" : String,
    "masterType" : String,
    "prices" : [productPriceSchema],
    "valueMessaging" : String,
    "launchId" : String,
    // product, group, kit, kitGroup
    "type" : String,
    // NOTE: how many levels deep do we go for kits containing kits, etc.?
    // for now, we'll just do first level down
    "hideWhenProductsUnavailable" : {type : Boolean, default : false},
    // kits & groups can be composed of other products & kitGroups
    "contains" : [{
        "product" : {type: String, ref: 'Product'},
        "quantity" : Number,
        "rank" : Number,
        "display" : Boolean,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null }
    }],
    "kitGroups" : [{
        "kitGroup" : {type: String, ref: 'KitGroup'},
        "rank" : Number,
        "startDate" : { type: Date, default: null },
        "endDate" : { type: Date, default: null }
    }]
}, { id: false });

// text search
productSchema.index({
    _id: "text",
    name: "text",
    description: "text",
    usage: "text",
    ingredients: "text",
    valueMessaging: "text"
});

// Duplicate the ID field.
productSchema.virtual('id').get(function(){
    return this._id;
});
productSchema.virtual('sku').get(function(){
    return this._id;
});

// Ensure virtual fields are serialised.
productSchema.set('toJSON', {
    virtuals: true
});

var Product = mongoose.model('Product', productSchema);
exports.Product = Product;


// DB HANDLERS

exports.onError = function(callback) {
    db.once('error', callback);
}
exports.onReady = function(callback) {
    db.once('open', callback);
}
