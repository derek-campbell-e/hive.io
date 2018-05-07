module.exports = function TokenAuthentication(Hive){
  // our includes
  const debug = require('debug')('hive:token');
  const common = require('../../Common');
  const secret = require('crypto').randomBytes(10).toString('hex');
  const jwt = require('jsonwebtoken');

  // our token module
  let token = common.object('hive', 'token-auth');
  

  // create a token with data
  token.create = function(data, callback){
    let error = null;
    let token = null;
    try {
      token = jwt.sign({data: data}, secret, {expiresIn: 60 * 60});
    } catch(e) {
      error = e;
    }
    callback(error, token);
  };

  // verify a token
  token.verify = function(token, callback){
    jwt.verify(token, secret, callback);
  };


  token.forever = function(callback){
    let error = null;
    let token = null;
    try {
      token = jwt.sign({data: 'hive-daemon'}, secret);
    } catch(e) {
      error = e;
    }
    callback(error, token);
  };

  token.generate = function(args, callback){
    token.forever(function(error, token){
      if(error){
        return callback("no token able to be issued");
      }
      callback(token);
    })
  };

  let bind = function(){
    Hive.on('token:generate', token.generate);
  };

  let init = function(){
    bind();
    token.log("initialized");
    return token;
  };

  return init();
};