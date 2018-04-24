module.exports = function Socket(Hive, Server, Cli){
  // our includes
  const debug = require('debug')('hive:server');
  const common = require('../../Common');
  const io = require('socket.io')(Server.http);

  // our socket manager object
  let sm = common.object('hive', 'socket-manager');
  
  // TODO: socket authentication middleware

  // our key/symbol map for socket events, we dont want
  // socket events to be called by anyone, though this may prove insecure
  let events = {
    'stats': Symbol('stats'),
    'disconnect': Symbol('socketDisconnect'),
    //'replication:begin': Symbol('replicationBegin'),
    //'replication:complete': Symbol('replicationComplete'),
    'begin:replication': Symbol("beginReplication"),
    'replication:data': Symbol("replicationData"),
    'remote:command': Symbol('remoteCommand'),
  };

  // our binder to listen to socket events by key and run the function by symbol
  let socketBinder = function(socket){
    for(let eventKey in events){
      let funcSymbol = events[eventKey];
      if(typeof sm[funcSymbol] !== 'function'){
        debug("not a function");
        continue;
      }
      socket.on(eventKey, sm[funcSymbol].bind(sm, socket));
    }
  };

  // our private sockets object
  let activeSockets = {};

  sm[events.stats] = function(socket, callback){
    sm.log("we got a stats message");
    Hive.emit('stats', {}, callback);
  };

  sm[events.disconnect] = function(socket, close){
    activeSockets[socket.id] = null;
    delete activeSockets[socket.id];
    sm.log(`socket ${socket.id} has closed; reason: ${close}`);
    socket = null;
  };

  // this will fire on the LOCAL HIVE when a REMOTE hive is connected to this LOCAL hive and enters a command
  sm[events['remote:command']] = function(socket, command, args, callback){
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
  
  // listen to io events
  let bind = function(){
    io.on('connection', function(socket){
      sm.log("got a socket connection///");
      activeSockets[socket.id] = socket;
      socketBinder(socket);
    });
  };

  // our initializer
  let init = function(){
    bind();
    sm.log("initializing socket manager");
    return sm;
  };

  return init();
};