'use strict';

/**
 * Module dependencies.
 */
var glob = require('glob');
var _ = require('lodash');
var env = process.env.NODE_ENV || "development";

module.exports = _.extend(
    require('../config/env/all'),
    require('../config/env/' + env) || {}
);
