'use strict';

module.exports = {
    db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://localhost/jafra_test',
	app: {
		title: 'Jafra - Test Environment'
	},
	password_reset_url: "http://localhost:8090/shop/passwordReset",
	debug: true
};