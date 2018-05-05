module.exports = function HiveNetwork(Hive){
  const debug = require('debug')('hive:network');
  const common = require('../../Common');

  let network = common.object('hive', 'network');
  let hives = {};

  network.addHiveRoutine = function(args, socket, callback){
    socket.once('connect', function(){
      let linkID = common.uuid();
      args.linkID = linkID;
      socket.emit("begin:link", Hive.meta.id, args, function(HiveID){
        network.addHive(socket, HiveID, args);
        callback(linkID);
      });
    });
  };

  network.addHive = function(socket, HiveID, args){
    network.log("adding a hive to our network");
    socket.once('disconnect', network.removeHive.bind(network, socket, HiveID));
    
    hives[args.linkID] = {
      caller: args.caller,
      callee: args.callee || HiveID,
      host: args.host,
      socket: socket,
      bidirectional: args.options.bi || false
    };

    return args.linkID;
  };

  network.removeHive = function(socket, HiveID){
    network.log("unlinking hive with id", HiveID);
    hives[HiveID] = null;
    delete hives[HiveID];
  };

  network.unlinkHive = function(args, callback){
    let link = network.lookupByMeta(args.hostOrID);
    if(!link){
      return callback("no link found...");
    }
    let socket = hives[link].socket;
    socket.close();
    callback("closed..");
  };

  network.blast = function(args, callback){
    network.log("blasting message", args.event, 'with args', args);
    for(let hiveID in hives){
      let hive = hives[hiveID];
      let socket = hives.socket;
      if(hive.bidirectional){
        network.log("attempting to blast to hive:", hiveID);
        socket.emit.apply(socket, ['network:blast', args.event, args]);
      } else {
        network.log("networked hive not bidirectional, cannot blast to")
      }
    }
    callback();
  };

  network.lookup = function(socket){
    for(let hiveID in hives){
      let hive = hives[hiveID];
      let hiveSocket = hive.socket;
      if(hiveSocket.id === socket.id){
        return hiveID;
      }
    }
    return false;
  };

  network.lookupByMeta = function(hostOrID){
    console.log(hostOrID);
    for(let hiveID in hives){
      let hive = hives[hiveID];
      if(hostOrID === hive.host || hostOrID === hive.id ){
        return hiveID;
      }
    }
    return false;
  };

  network.list = function(args, callback){
    let json = {};
    for(let hiveID in hives){
      let hive = hives[hiveID];
      json[hiveID] = {id: hiveID, host: hive.host, bidirectional: hive.bidirectional, caller: hive.caller, callee: hive.callee};
    }
    callback(json);
    return json;
  };

  let bind = function(){
    Hive.on('blast:message', network.blast);
    Hive.on('ls:network', network.list);
    Hive.on('unlink:hive', network.unlinkHive);
  };

  let init = function(){
    bind();
    network.log("initialized hive network...");
    return network;
  };

  return init();
};