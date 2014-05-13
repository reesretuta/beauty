Running Locally
---------------

Install node modules:

<code>
npm install
</code>

Start basic http server:

<code>
./http-server/bin/http-server ./
</code>

Starting advanced http server:

http server with some ability to configure static/dynamic routes
outside of angular.

<code>
node server.js
</code>


Project Structure
-----------------

<pre>
Gruntfile.js             - used for additional build scripts (not currently used)
README.md                - this file
api                      - mock XML data used for RESTful calls to an API server
bower.json               - dependency management of javascript libaries
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
nbproject                - netbeans project data
node_modules             - node libraries installed by running "npm install"
package.json             - node package information and dependencies
partials                 - HTML partials which contain content for all views and dialogs
server.js                - test configuration used for running node http server above
sprites                  - used for grunt-spritesmith to generate sprite maps (not currently used)
styles                   - CSS files
</pre>
