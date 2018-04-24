module.exports = function RemoteManager(Hive){
  const debug = require('debug')('hive:remote');
  const common = require('../../Common');
  const request = require('request');
  const URL = require('url').URL;
  const io = require('socket.io-client');
  

  let remote = common.object('hive', 'remote-manager');
  remote.meta.isUsingRemote = false;
  remote.meta.activeHost = null;

  remote.sockets = {};
  let tokenSymbol = Symbol("token");

  const socketStatus = {
    "ok": {error: false, status: "ok", code: 200},
    "failed-host": {error: true, status: "cannot connect to host", code: 300},
    "socket-connect-error": {error: true, status: "error when connecting to socket", code: 301},
    "socket-disconnected": {error: true, status: "socket disconnected", code: 302},
    "failed-auth": {error: true, status: "failed authentication", code: 303}
  };

  remote.ping = function(host, callback){
    request.get(host).on('response', function(response){
      callback(true);
    }).on('error', function(error){
      callback(false);
    });
  };
  
  remote.authenticate = function(host, username, password, callback){
    let accessToken = null;
    let url = new URL(host);
    url.pathname = "authenticate";
    request.post({
      url : url.href,
      form: {username: username, password: password}
    }, function(error, response, body){
      let json = JSON.parse(body) || {};
      accessToken = json.token || false;
      if(accessToken){
        remote.log("retrieved an access token");
        return remote.connectToHost(url, accessToken, function(socketStatus, socket){
          return callback(socketStatus, url.host, socket);
        });
      }
      callback(socketStatus['failed-auth']);
    });
  };

  remote.addRemoteSocket = function(socket, callback){
    remote.log("WE ARE CONNECTED");
    remote.meta.isUsingRemote = true;
    remote.meta.activeHost = socket;
    remote.sockets[socket.id] = socket;
    callback(socketStatus.ok, socket);
  };

  remote.remoteSocketConnectError = function(socket, callback){
    if(remote.sockets.hasOwnProperty(socket.id)){
      remote.sockets[socket.id] = null;
      delete remote.sockets[socket.id];
    }
    //callback(socketStatus['socket-connect-error']);
  };

  remote.remoteSocketError = function(socket, callback, error){
    if(remote.sockets.hasOwnProperty(socket.id)){
      remote.sockets[socket.id] = null;
      delete remote.sockets[socket.id];
    }
    //callback(socketStatus['socket-connect-error']);
  };

  remote.disconnectRemoteSocket = function(socket, callback){
    remote.log("remote socket has been disconnected...");
    if(remote.sockets.hasOwnProperty(socket.id)){
      remote.sockets[socket.id] = null;
      delete remote.sockets[socket.id];
    }
    remote.closeActiveHost(function(){});
    remote.emit("remote:closed");
    if(remote.socketCloseCallbackOverride){
      return remote.socketCloseCallbackOverride();
    }
    //callback(socketStatus['socket-disconnected']);
  };

  remote.closeActiveHost = function(callback){
    if(remote.meta.activeHost && remote.meta.activeHost.close){
      remote.meta.activeHost.close();
    }
    remote.meta.activeHost = null;
    remote.meta.isUsingRemote = false;
    callback();
  };

  remote.emitToHost = function(optionalHost, event, ...args){
    if(!remote.meta.activeHost){
      return false;
    }
    remote.meta.activeHost.emit.apply(remote.meta.activeHost, [event, ...args]);
    return true;
  };

  remote.connectToHost = function(hostURL, token,  callback){
    callback = callback || function(){};
    hostURL.pathname = '/';
    let socket = io(hostURL.href + `?token=${token}`);
    socket[tokenSymbol] = token;
    socket.once('connect', remote.addRemoteSocket.bind(remote, socket, callback));
    socket.once('connect_error', remote.remoteSocketConnectError.bind(remote, socket));
    socket.once('disconnect', remote.disconnectRemoteSocket.bind(remote, socket));
    socket.once('error', remote.remoteSocketError.bind(remote, socket));
  };

  let bind = function(){
    //Hive.on('remote:authenticate', remote.authenticate);
  };

  let init = function(){
    bind();
    remote.log("initialized");
    return remote;
  };

  return init();
};