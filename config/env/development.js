'use strict';

module.exports = {
	db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://localhost:27017,localhost:27018/jafra',
	app: {
		title: 'Jafra - Development Environment'
	},
	password_reset_url: "http://localhost:8090/shop/passwordReset",
    debug: true
};