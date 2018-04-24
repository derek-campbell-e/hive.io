module.exports = function TokenAuthentication(){
  const debug = require('debug')('hive:token');
  const common = require('../../Common');
  const secret = require('crypto').randomBytes(10).toString('hex');
  const jwt = require('jsonwebtoken');

  let token = common.object('hive', 'token-auth');
  token.log("initialized");

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

  token.verify = function(token, callback){
    jwt.verify(token, secret, callback);
  };

  return token;
};