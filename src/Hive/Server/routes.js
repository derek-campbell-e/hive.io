module.exports = function ServerRoutes(Hive, Server, App, TokenAuth){
  App.get("/", function(req, res){
    res.send("HELLO");
  });

  App.get("/hive", function(req, res){
    Hive.emit('stats', {}, function(json){
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