module.exports = function Server(Hive){
  const debug = require('debug')('hive:server');
  const common = require('../../Common');
  const bodyParser = require('body-parser');
  const multer = require('multer');
  let app = require('express')();
  let server = common.object('hive', 'server');
  let tokenAuth = require('./token')();

  

  
  let loggerMiddleWare = function(req, res, next){
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    server.log(`${req.originalUrl} incoming request from ${ip}`);
    next();
  };

  server.http = require('http').Server(app);
  server.instance = null;

  server.gc = function(){
    debug("GARBAGE");
    server.instance.close();
    server.http = null;
    app = null;
  };



  let bind = function(){
    app.use(loggerMiddleWare);
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({extended: true}));
    app.use(multer().array());
    app.set('trust proxy', true);
    require('./routes')(Hive,server, app, tokenAuth);
    server.instance = server.http.listen(options.port);
    server.log(`listening to port ${options.port}`);
    Hive.on('gc', server.gc);
  };
 
  let init = function(){
    server.log("initializing server...");
    bind();
    return server;
  };

  return init();
};