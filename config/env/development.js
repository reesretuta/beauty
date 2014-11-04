'use strict';

module.exports = {
	db: process.env.MONGOHQ_URL || process.env.MONGOLAB_URI || 'mongodb://localhost:27017,localhost:27018/jafra',
	app: {
		title: 'Jafra - Development Environment'
	},
    debug: true
};