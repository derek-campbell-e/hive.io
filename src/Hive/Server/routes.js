module.exports = function ServerRoutes(Hive, Server, App, TokenAuth){

  // our base URI
  App.get("/", function(req, res){
    res.send("HELLO");
  });

  App.get("/hive", function(req, res){
    Hive.emit('stats', {}, function(json){
      res.json(json);
    });
  });

  App.get("/drones", function(req, res){
    Hive.emit('ls:drones', {}, function(json){
      res.json(json);
    });
  });

  App.get("/next/:drone", function(req, res){
    Hive.emit('next:drone', {mind: req.params.drone}, function(json){
      res.json(json);
    });
  });

  App.get("/fire/:drone", function(req, res){
    Hive.emit('fire:drone', {mind: req.params.drone}, function(json){
      res.json(json);
    });
  });

  App.get("/reload", function(req, res){
    Hive.emit("reload", {}, function(){
      res.json({status: 'hive has been reloaded'});
    });
  });

  App.get("/retire", function(req, res){
    Hive.emit("retire:hive", {}, function(){
      res.json({status: 'hive has been retired...'});
    });
  });

  App.get("/start/:drone", function(req, res){
    let method = 'start:drone';
    let key = 'mind';
    if(req.params.drone.indexOf(',')){
      method = 'start:drones';
      key = 'minds';
      req.params.drone = req.params.drone.split(",");
    }
    let args = {};
    args.options = {};
    args[key] = req.params.drone;
    Hive.emit(method, args, function(json){
      res.json(json);
    });
  });

  App.post("/authenticate", function(req, res){
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    Server.log(`Authentication request from ip: ${ip}`);
    let loginInformation = {username: process.env.USERNAME, password: process.env.PASSWORD};
    let postedLogin = {username: req.body.username, password: req.body.password};
    let sameUsername = postedLogin.username === loginInformation.username;
    let samePassword = postedLogin.password === loginInformation.password;
    if(sameUsername && samePassword){
      TokenAuth.create(postedLogin, function(error, token){
        if(!error){
          Server.log("successful authentication request!");
          return res.send({status: "OK", token: token});
        }
        res.send({status: "FAILED", error: "unable to create token"});
      });
    } else {
      Server.log("unsuccessful authentication attempt...");
      res.send({status: "FAILED", error: "AUTHENTICATION"});
    }
  });

  App.post("/verify", function(req, res){
    let token = req.body.token;
    TokenAuth.verify(token, function(error, data){
      if(error){
        Server.log("Unable to verify token", error);
        return res.send({status: "FAILED", error: "INVALID OR EXPIRED TOKEN"});
      }
      return res.send({status: "OK"});
    });
  });

};