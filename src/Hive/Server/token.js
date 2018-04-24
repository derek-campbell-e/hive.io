module.exports = function TokenAuthentication(){
  // our includes
  const debug = require('debug')('hive:token');
  const common = require('../../Common');
  const secret = require('crypto').randomBytes(10).toString('hex');
  const jwt = require('jsonwebtoken');

  // our token module
  let token = common.object('hive', 'token-auth');
  token.log("initialized");

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

  return token;
};