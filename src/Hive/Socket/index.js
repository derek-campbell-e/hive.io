module.exports = function Socket(Hive, Server, Cli, HiveNetwork){
  // our includes
  const debug = require('debug')('hive:server');
  const common = require('../../Common');
  const io = require('socket.io')(Server.http);
  const daemon = require('socket.io-client');
  const linker = require('socket.io-client');

  // our socket manager object
  let sm = common.object('hive', 'socket-manager');

  let tokenSymbol = Symbol("token");
  
  // TODO: socket authentication middleware

  const usingAuth = false;

  let socketAuthentication = function(socket, next){
    if(!usingAuth) {
      return next();
    }
   
    let token = socket.handshake.query.token;
    Server.token.verify(token, function(error, data){
      if(!error){
        socket[tokenSymbol] = token;
        return next();
      }
      return next(new Error("Not authenticated"));
    });
  };

  let socketVerifyPerPacket = function(socket, packet, next){
    if(!usingAuth) {
      return next();
    }
    Server.token.verify(socket[tokenSymbol], function(error, data){
      if(!error){
        return next();
      }
      return next(new Error("Not authenticated"));
    });
  };

  // our key/symbol map for socket events, we dont want
  // socket events to be called by anyone, though this may prove insecure
  let events = {
    'disconnect': Symbol('socketDisconnect'),
    'begin:replication': Symbol("beginReplication"),
    'replication:data': Symbol("replicationData"),
    'remote:command': Symbol('remoteCommand'),
    'begin:link': 'begin:link',
    'network:blast': 'network:blast',
  };

  // our binder to listen to socket events by key and run the function by symbol
  let socketBinder = function(socket){
    if(socket.use){
      socket.use(socketVerifyPerPacket.bind(sm, socket));
    }
    
    for(let eventKey in events){
      let funcSymbol = events[eventKey];
      if(typeof sm[funcSymbol] !== 'function'){
        debug("not a function", funcSymbol);
        continue;
      }
      socket.on(eventKey, function(){
        sm.log(`received socket event: ${eventKey} from: ${socket.id}`);
        sm[funcSymbol].apply(sm, [socket, ...arguments]);
      });
    }
  };

  // our private sockets object
  let activeSockets = {};

  sm[events.disconnect] = function(socket, close){
    activeSockets[socket.id] = null;
    delete activeSockets[socket.id];
    sm.log(`socket ${socket.id} has closed; reason: ${close}`);
    socket = null;
  };

  // this will fire on the LOCAL HIVE when a REMOTE hive is connected to this LOCAL hive and enters a command
  sm[events['remote:command']] = function(socket, command, args, callback){
    sm.log(`received remote command: '${command}' with args: ${args}`);
    Hive.emit(command, args, callback);
  };

  sm[events["begin:replication"]] = function(socket){
    sm.log("got a replication event");
    socket.emit("ready:replication");
  };

  sm[events["replication:data"]] = function(socket, data){
    let replication = require('../Replicate')(Hive);
    replication.replicateInto(data, function(){
      socket.emit("complete:replication");
    });
  };

  // this is what the remote hive responds to when calling the link command
  sm[events["begin:link"]] = function(socket, hiveID, args, callback){
    sm.log("received link request from", hiveID);
    args.host = 'SELF';
    args.callee = Hive.meta.id;
    HiveNetwork.addHive(socket, hiveID, args, {local: false});
    callback(Hive.meta.id);
  };

  sm[events['network:blast']] = function(socket, event, args){
    sm.log("received network blast from", socket.id, HiveNetwork.lookupBySocket(socket));
    if(HiveNetwork.lookupBySocket(socket)){
      sm.log("we have this hive in our network, so lets process the message...", event);
      args.args = args.args || [];
      Hive.emit.apply(Hive, [event, ...args.args]);
    }
  };

  sm.linkHive = function(args, callback){
    sm.log(`linking ${args.host} to current hive`);
    let socket = linker(args.host + `?token=${args.token}`);
    args.options.bi = true;
    if(args.options.bi){
      socket.once('connect', function(){
        activeSockets[socket.id] = socket;
        socketBinder(socket);
      });
    }
    args.caller = Hive.meta.id;
    HiveNetwork.addHiveRoutine(args, socket, callback);
  };

  sm.notifyDaemon = function(data, callback){
    let daemonurl = `http://localhost:${options.daemon}`;
    sm.log(daemonurl);
    let socket = daemon(daemonurl);
    socket.once('connect', function(){
      socket.emit(`ready`, process.pid, data);
      socket.close();
      callback();
    });
  };
  
  // listen to io events
  let bind = function(){
    io.on('connection', function(socket){
      sm.log("new socket: ", socket.id, socket.handshake.address, socket.handshake.headers["x-real-ip"]);
      activeSockets[socket.id] = socket;
      socketBinder(socket);
    });
    io.use(socketAuthentication);
    Hive.on('link:hive', sm.linkHive);
  };

  // our initializer
  let init = function(){
    bind();
    sm.log("initializing socket manager");
    return sm;
  };

  return init();
};