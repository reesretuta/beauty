'use strict';

module.exports = {
	db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://localhost/jafra',
    pgp_key_file: "pgp_keys/pgp_key_prod.js",
    jcs_api_ip: "189.206.20.153",
    password_reset_url: "https://usa.jafra.com/shop/passwordReset"
};