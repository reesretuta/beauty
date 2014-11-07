'use strict';

module.exports = {
	db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://localhost/jafra',
    jcs_api_ip: "189.206.20.153"
};