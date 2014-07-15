Installation Steps
==================

MongoDB
-------
* Download mongodb (http://www.mongodb.org/downloads)
* Install mongodb (http://docs.mongodb.org/master/installation/)
  - OSX
    - untar tar.gz
    - cd into mongodb-osx-x86\_64-2.x.x
* Run mongodb
  - OSX
    - mongod --dbpath ./data/ --profile=1 --slowms=1

Jafra
-----
* Unpack the jafra prototype app
* In another term, change directory into jafraproto
* Import all mongodb data from ./mongo\_dump (http://docs.mongodb.org/manual/tutorial/backup-with-mongodump/)
  - <path_to_mongo>/mongorestore ./mongo\_dump


Running
=======

Prerequisites
-------------
Ensure mongodb is running

Recommended
-----------
Postman (api tool for testing)

Prototype & API
---------------
<code>
node server.js
</code>

Scraper
-------
<code>
node scraper.js
</code>


Development
===========

Install node modules:

<code>
npm install
</code>

Run the server:

<code>
node server.js
</code>


Project Structure
-----------------

<pre>
Gruntfile.js             - used for additional build scripts (not currently used)
README.md                - this file
bower.json               - dependency management of javascript libaries
common                   - shared files between prototype / scraper
fonts                    - font files
http-server              - http server files used to run local dev server
i18n                     - locale-based text for content
img                      - image files
index.html               - main HTML page for this single-page application
js                       - project javascript files
js/angular               - angularjs project files
js/angular/controllers   - angularjs controllers to back individual views / modals
js/angular/modules       - additional modules used within angularjs
js/angular/app.js        - angularjs config.  include new modules, change settings, change routes
js/angular/directives.js - angularjs directives (re-usable UI components)
js/angular/filters.js    - angularjs filters (filtering / formatting components for UI)
js/angular/services.js   - angularjs re-usable components (REST services, common utilities, session data, etc.)
lib                      - destination for javascript libraries managed by bower
mongo\_dump              - mongo database dump directory, which can be imported with mongorestore
nbproject                - netbeans project data
node\_modules            - node libraries installed by running "npm install"
package.json             - node package information and dependencies
partials                 - HTML partials which contain content for all views and dialogs
server.js                - test configuration used for running node http server above
sprites                  - used for grunt-spritesmith to generate sprite maps (not currently used)
styles                   - CSS files
</pre>
