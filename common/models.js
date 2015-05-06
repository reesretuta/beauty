var mongoose = require("mongoose");
var config = require('../config/config');

Schema = mongoose.Schema;
mongoose.connect(config.db);

mongoose.set('debug', config.debug);

var db = mongoose.connection;
exports.db = db;
exports.mongoose = mongoose;

// SCRAPE PROGRESS
var scrapeProgressSchema = Schema({
    "session" : String, // unique key
    "type" : String, // product, kit, group, kitGroup
    "items" : [Schema.Types.Mixed], // array of IDs (string/number)
    "lastCompletedItem" : Schema.Types.Mixed, // string/number
    "lastCompletedDate" : { type: Date, default: null },
    "progress" : Number
}, { id: false });

var ScrapeProgress = mongoose.model('ScrapeProgress', scrapeProgressSchema);
exports.ScrapeProgress = ScrapeProgress;

// SCRAPE ERRORS
var scrapeErrorSchema = Schema({
    "type" : String, // product, kit, group, kitGroup
    "error" : Schema.Types.Mixed,
    "date" : { type: Date, default: null }
}, { id: false });

var ScrapeError = mongoose.model('ScrapeError', scrapeErrorSchema);
exports.ScrapeError = ScrapeError;


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
}, { id: false });

// Duplicate the ID field.
kitGroupSchema.virtual('id').get(function(){
    return this._id;
});

var KitGroup = mongoose.model('KitGroup', kitGroupSchema);
exports.KitGroup = KitGroup;

// LEAD

var leadSchema = Schema({
    "firstName" : { type : String, required: true },
    "lastName" : { type : String, required: true },
    "email" : { type : String, required: true },
    "phone" : { type : String, required: true },
    "language": { type : String, required: true },
    "type": {type: String},
    "created": { type: Date, default: Date.now },
    "sent": { type: Boolean, default: false },
    "completed": { type: Boolean, default: false }
}, { autoIndex: true });

var Lead = mongoose.model('Lead', leadSchema);
exports.Lead = Lead;

// INVENTORY
var inventorySchema = Schema({
    "_id" : String,
    "available" : Number
});

var Inventory = mongoose.model('Inventory', inventorySchema);
exports.Inventory = Inventory;

// CONFIG
var configSchema = Schema({
    "_id" : String,
    "value" : Schema.Types.Mixed
});

var Config = mongoose.model('Config', configSchema);
exports.Config = Config;

// ORDER HISTORY
var orderHistorySchema = Schema({
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
});

var OrderHistory = mongoose.model('OrderHistory', orderHistorySchema);
exports.OrderHistory = OrderHistory;

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
}, { id: false, autoIndex: true });

// text search
productSchema.index({
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

// PASSWORD RESET TOKEN
var passwordResetTokenSchema = Schema({
    "token" : { type: String, unique: true },
    "email" : { type: String, unique: false },
    "language" : { language: String, unique: false },
    "created" : { type: Date, default: Date.now }
});

var PasswordResetToken = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
exports.PasswordResetToken = PasswordResetToken;

// available sponsors
var sponsorsSchema = Schema({
    id : { type : Number },
    firstName : { type : String, required : true },
    lastName : { type : String, required : true },
    zip : { type : String, required : true },
    geocode: { type : String, required : true },
    isActive: { type : Number, required : true }
});

categorySchema.virtual('id').get(function(){
    return this._id;
});

var Sponsors = mongoose.model('Sponsors', sponsorsSchema);
exports.Sponsors = Sponsors;

// DB HANDLERS

exports.onError = function(callback) {
    db.once('error', callback);
}
exports.onReady = function(callback) {
    db.once('open', callback);
}
