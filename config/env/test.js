'use strict';

module.exports = {
    db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://localhost/jafra',
	app: {
		title: 'Jafra - Test Environment'
	},
	password_reset_url: "https://jafra-stage.herokuapp.com/shop/passwordReset"
};