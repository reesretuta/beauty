'use strict';

/**
 * Module dependencies.
 */
var glob = require('glob');
var _ = require('lodash');

module.exports = _.extend(
    require('../config/env/all'),
    require('../config/env/' + process.env.NODE_ENV) || {}
);