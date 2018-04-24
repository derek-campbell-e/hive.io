module.exports = function RemoteManager(Hive){
  // our includes
  const debug = require('debug')('hive:remote');
  const common = require('../../Common');
  const request = require('request');
  const URL = require('url').URL;
  const io = require('socket.io-client');
  
  // our remote object
  let remote = common.object('hive', 'remote-manager');
  remote.meta.isUsingRemote = false;
  remote.meta.activeHost = null;

  // our sockets object (for if/when we connect multiple remote hives)
  remote.sockets = {};

  // our symbol for accessing the authentication token we get from remote hives
  let tokenSymbol = Symbol("token");

  // our socket status enums
  const socketStatus = {
    "ok": {error: false, status: "ok", code: 200},
    "failed-host": {error: true, status: "cannot connect to host", code: 300},
    "socket-connect-error": {error: true, status: "error when connecting to socket", code: 301},
    "socket-disconnected": {error: true, status: "socket disconnected", code: 302},
    "failed-auth": {error: true, status: "failed authentication", code: 303}
  };

  // function to attempt to connect to remote hive host
  remote.ping = function(host, callback){
    request.get(host).on('response', function(response){
      callback(true);
    }).on('error', function(error){
      callback(false);
    });
  };
  
  // our function to authenticate into a remote hive, if auth is successful, connect to the host using token
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

  // our function to add remote socket to our sockets object
  remote.addRemoteSocket = function(socket, callback){
    remote.log("WE ARE CONNECTED");
    remote.meta.isUsingRemote = true;
    remote.meta.activeHost = socket;
    remote.sockets[socket.id] = socket;
    callback(socketStatus.ok, socket);
  };

  // our function to handle socket connection errors
  remote.remoteSocketConnectError = function(socket, callback){
    if(remote.sockets.hasOwnProperty(socket.id)){
      remote.sockets[socket.id] = null;
      delete remote.sockets[socket.id];
    }
    //callback(socketStatus['socket-connect-error']);
  };

  // our function to handle socket errors
  remote.remoteSocketError = function(socket, callback, error){
    if(remote.sockets.hasOwnProperty(socket.id)){
      remote.sockets[socket.id] = null;
      delete remote.sockets[socket.id];
    }
    //callback(socketStatus['socket-connect-error']);
  };

  // our function called when a remote socket has been disconnected
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

  // our function to close the active remote socket
  remote.closeActiveHost = function(callback){
    if(remote.meta.activeHost && remote.meta.activeHost.close){
      remote.meta.activeHost.close();
    }
    remote.meta.activeHost = null;
    remote.meta.isUsingRemote = false;
    callback();
  };

  // our function to emit data from local hive to remote hive, used for running remote commands
  remote.emitToHost = function(optionalHost, event, ...args){
    if(!remote.meta.activeHost){
      return false;
    }
    remote.meta.activeHost.emit.apply(remote.meta.activeHost, [event, ...args]);
    return true;
  };

  // our function to connect to the remote hive using our token
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

  // our function to listen to events
  let bind = function(){
    //Hive.on('remote:authenticate', remote.authenticate);
  };

  // our initializer
  let init = function(){
    bind();
    remote.log("initialized");
    return remote;
  };

  return init();
};