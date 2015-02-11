'use strict';

module.exports = {
	app: {
		title: 'Jafra'
	},
  jcs_api_ip: "189.206.20.52",
  pgp_key_file: "pgp_keys/pgp_key_dev.js",
  cdn_base_url: process.env.FASTLY_CDN_URL ? "https://" + process.env.FASTLY_CDN_URL : "http://localhost:8090",
  debug: false
};