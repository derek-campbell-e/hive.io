module.exports = function HiveNetwork(Hive){
  const debug = require('debug')('hive:network');
  const common = require('../../Common');

  let network = common.object('hive', 'network');
  let hives = {};
  let links = {};

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
    socket.once('reconnect_failed', function(){
      console.log("DISCONNECETEDDDDDD");
    });
    socket.once('disconnect', network.removeHive.bind(network, socket, HiveID));
    
    links[args.linkID] = {
      caller: args.caller,
      callee: args.callee || HiveID,
      host: args.host,
      socket: socket,
      bidirectional: args.options.bi || false
    };

    return args.linkID;
  };

  // TODO: find link with HiveID to remove
  network.removeHive = function(socket, HiveID){
    
    let linkID = network.lookupByHiveID(HiveID);
    if(!linkID){
      return false;
    }
    network.log("unlinking hive with id", HiveID);
    links[linkID] = null;
    delete links[linkID];
  };


  network.unlinkHive = function(args, callback){
    if(args.options.all){
      callback("closing...");
      return network.gc();
    }
    if(!args.hostOrID){
      return callback("must provide either a host or linkID OR use -a for all");
    }
    let linkID = network.lookupByMeta(args.hostOrID);
    if(!linkID){
      return callback("no link found...");
    }
    let socket = links[linkID].socket;
    socket.close();
    callback("closed..");
  };

  network.blast = function(args, callback){
    network.log("blasting message", args.event, 'with args', args);
    for(let linkID in links){
      let link = links[linkID];
      let socket = link.socket;
      if (link.bidirectional || link.caller === Hive.meta.id){
        let hiveID = link.callee;
        if(link.host !== 'SELF'){
          hiveID = link.caller;
        }
        network.log("attempting to blast to link", linkID, 'connected to hive:', hiveID);
        socket.emit.apply(socket, ['network:blast', args.event, args]);
      } else {
        network.log("networked hive not bidirectional, cannot blast to")
      }
    }
    callback();
  };

  network.lookupBySocket = function(socket){
    for(let linkID in links){
      let link = links[linkID];
      if(socket.id === link.socket.id) {
        return linkID;
      }
    }
    return false;
  };

  network.lookupByMeta = function(hostOrID){
    for(let linkID in links){
      let link = links[linkID];
      if(link.host === hostOrID || linkID === hostOrID){
        return linkID
      }
    }
    return false;
  };

  network.lookupByHiveID = function(hiveID){
    for(let linkID in links){
      let link = links[linkID];
      let needleHiveID = (link.host === 'SELF') ? link.caller : link.callee;
      if (needleHiveID === hiveID){
        return linkID
      }
    }
    return false;
  };

  network.list = function(args, callback){
    let json = {};
    for(let linkID in links){
      let link = links[linkID];
      json[linkID] = {host: link.host, bidirectional: link.bidirectional, caller: link.caller, callee: link.callee};
    }
    callback(json);
    return json;
  };

  network.gc = function(){
    for(let linkID in links){
      let link = links[linkID];
      link.socket.close();
    }
  };


  let bind = function(){
    Hive.on('blast:message', network.blast);
    Hive.on('ls:network', network.list);
    Hive.on('unlink:hive', network.unlinkHive);
    Hive.on('gc', network.gc);
  };

  let init = function(){
    bind();
    network.log("initialized hive network...");
    return network;
  };

  return init();
};