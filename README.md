Installation Steps
==================

MongoDB
-------
* Download mongodb (http://www.mongodb.org/downloads)
* Install phantomjs (SCRAPING ONLY)
  * Retrieve an appropriate package or download the binary (http://phantomjs.org/download.html) and place on the path
  * Run the phantomjs command to ensure there are no errors
* Install npm
* Install casperjs (sudo npm install -g casperjs) (SCRAPING ONLY)
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
* In another term, git clone jafra & jafra-data
* Change directory into jafra-data
* Import all mongodb data from ./dump (http://docs.mongodb.org/manual/tutorial/backup-with-mongodump/)
  - Example: path_to_mongo/mongorestore ./dump
* Verify data imported by connecting to MondoDB (mongo jafra) and doing a find (db.products.find().count())
* Run 'npm install' to rebuild any platform specific modules


Running
=======

Prerequisites
-------------
MongoDB is up and running
Node installed

Recommended
-----------
Postman (Chrome api tool for testing)

Prototype & API
---------------
Run this to get the prototype API & web application running

<code>
node server.js
</code>

Then visit the site on port 8090 (e.g. http://localhost:8090)

For extra debugging of server-side requests:

<code>
NODE_DEBUG=request node server.js
</code>

To use your local inventory cache & not hit JCS servers, use the following ENV
variable.  This speeds things up considerably when restarting node frequently.

<code>
FORCE_INVENTORY_CACHE=true
</code>

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

Deployment
==========

Deployment to test/stage/prod can be done through branches.  NOT yet, bitbucket
doesn't trigger hooks for merges yet.  To deploy, ensure you have the following
remotes:

    heroku  git@heroku.jafra:jafratest.git (fetch)
    heroku  git@heroku.jafra:jafratest.git (push)
    heroku-lvi  git@heroku.jafra:jafra.git (fetch)
    heroku-lvi  git@heroku.jafra:jafra.git (push)
    heroku-prod git@heroku.jafra:jafra-prod.git (fetch)
    heroku-prod git@heroku.jafra:jafra-prod.git (push)
    origin  https://user@bitbucket.org/lavisual/jafra.git (fetch)
    origin  https://user@bitbucket.org/lavisual/jafra.git (push)

You can add a remote like so:

    git remote add heroku-lvi git@heroku.work:jafra.git

With proper keys configured in ~/.ssh/config and that key added to each of the
repositories your user should have permission to.  Example:

    Host heroku.jafra
    HostName heroku.com
    IdentityFile "/Users/arimus/.ssh/identity.heroku.lavisual"
    IdentitiesOnly yes

Then simply push to the correct remote, like so:

    git push heroku-lvi master
