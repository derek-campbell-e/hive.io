module.exports = function Server(Hive){
  // our includes
  const debug = require('debug')('hive:server');
  const common = require('../../Common');
  const bodyParser = require('body-parser');
  const multer = require('multer');

  // our express app
  let app = require('express')();

  // our server object
  let server = common.object('hive', 'server');

  // our token authentication module
  let tokenAuth = Hive.token;
  server.token = Hive.token;
  
  // our logger middleware for express
  let loggerMiddleWare = function(req, res, next){
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    server.log(`${req.originalUrl} incoming request from ${ip}`);
    next();
  };

  // give our server the express instance
  server.http = require('http').Server(app);
  server.instance = null;

  // our garbage collection function to close server
  server.gc = function(){
    debug("GARBAGE");
    server.instance.close();
    server.http = null;
    app = null;
  };

  // listen to events and such
  let bind = function(){
    app.use(loggerMiddleWare);
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(multer().array());
    app.set('trust proxy', true);
    // create express routes
    require('./routes')(Hive,server, app, tokenAuth);
    server.instance = server.http.listen(options.port);
    server.log(`listening to port ${options.port}`);
    Hive.on('gc', server.gc);
  };
  
  // our initializer
  let init = function(){
    server.log("initializing server...");
    bind();
    return server;
  };

  return init();
};