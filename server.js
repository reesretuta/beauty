// server.js

// set up ========================
var express  = require('express');
var app      = express();                               // create our app w/ express
//var mongoose = require('mongoose');                     // mongoose for mongodb

// configuration =================

//mongoose.connect('mongodb://node:node@mongo.onmodulus.net:27017/uwO3mypu');     // connect to mongoDB database on modulus.io

app.configure(function() {
    //app.use(express.static(__dirname + '/public'));         // set the static files location /public/img will be /img for users
    app.use(express.logger('dev'));                         // log every request to the console
    app.use(express.bodyParser());                          // pull information from html in POST
    app.use(express.methodOverride());                      // simulate DELETE and PUT

    // application -------------------------------------------------------------
    app.use('/lib', express.static(__dirname + '/lib'));
    app.use('/js', express.static(__dirname + '/js'));
    app.use('/partials', express.static(__dirname + '/partials'));
    app.use('/styles', express.static(__dirname + '/styles'));
    app.use('/api', express.static(__dirname + '/api'));
    app.get('*', function(req, res) {
        res.sendfile('./index.html'); // load the single view file (angular will handle the page changes on the front-end)
    });
});

// listen (start app with node server.js) ======================================
app.listen(8081);
console.log("App listening on port 8081");
