Installation Steps
==================

MongoDB
-------
* Download mongodb (http://www.mongodb.org/downloads)
* Install phantomjs
  * Retrieve an appropriate package or download the binary (http://phantomjs.org/download.html) and place on the path
  * Run the phantomjs command to ensure there are no errors
* Install npm
* Install casperjs (sudo npm install -g casperjs)
* Install deps (from project dir: npm install)
* Install mongodb (http://docs.mongodb.org/master/installation/)
  - OSX
    - untar tar.gz
    - cd into mongodb-osx-x86_64-2.x.x
* Run mongodb
  - OSX
    - mongod --dbpath ./data/ --profile=1 --slowms=1

Jafra
-----
* In another term, unpack the jafra prototype app
* Change directory into jafraproto
* Import all mongodb data from ./mongo_dump (http://docs.mongodb.org/manual/tutorial/backup-with-mongodump/)
  - Example: path_to_mongo/mongorestore ./mongo_dump
* Verify data imported by connecting to MondoDB (mongo jafra) and doing a find (db.products.find().count())
* If not running on CentOS 6, run 'npm install' to rebuild any platform specific modules


Running
=======

Prerequisites
-------------
MongoDB is up and running
Node installed

Recommended
-----------
Postman (api tool for testing)

Prototype & API
---------------
Run this to get the prototype API & web application running

<code>
node server.js
</code>

Then visit the site on port 8090 (e.g. http://localhost:8090)

Scraper
-------

** WARNING - running this will take a very long time.  It's scraping N products/kits/groups * ~8 product detail pages **

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

    Gruntfile.js             - used for additional build scripts (not currently used)
    README.md                - this file
    bower.json               - dependency management of javascript libaries
    common                   - shared files between prototype / scraper
    fonts                    - font files
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
    mongo_dump               - mongo database dump directory, which can be imported with mongorestore
    nbproject                - netbeans project data
    node_modules             - node libraries installed by running "npm install"
    package.json             - node package information and dependencies
    partials                 - HTML partials which contain content for all views and dialogs
    server.js                - test configuration used for running node http server above
    sprites                  - used for grunt-spritesmith to generate sprite maps (not currently used)
    styles                   - CSS files

