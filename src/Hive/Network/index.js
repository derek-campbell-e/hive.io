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
        network.addHive(socket, HiveID, args, {local: true});
        callback(linkID);
      });
    });

    let connectionFailed = function(){
      callback("a connection could not be made at this time");
    };
    socket.once('error', connectionFailed);
    socket.once('disconnect', connectionFailed);
    socket.once('connect_error', connectionFailed);
  };

  network.processReplication = function(link, HiveID, args, localize){
    let replicationRoutine = function(){
      let repl = function(Hive, Link){
        let replicator = require('../Replicate')(Hive, link.socket, false);
        replicator.commenceReplication({}, function(){});
      }.bind(this, Hive, link);
      Hive.on('reload', repl);
      link.socket.once('disconnect', function(){
        Hive.removeListener('reload', repl);
      });
      repl();
    };

    if(args.options.slave){
      if(localize.local){
        link.replication = {
          master: HiveID,
          slave: Hive.meta.id
        };
      } else {
        link.replication = {
          master: Hive.meta.id,
          slave: HiveID
        };
        replicationRoutine();
      }
    }

    if(args.options.master){
      if(localize.local){
        link.replication = {
          master: Hive.meta.id,
          slave: HiveID
        };
        
       replicationRoutine();
        
      } else {
        link.replication = {
          master: HiveID,
          slave: Hive.meta.id
        };
      }
    }

  };

  network.addHive = function(socket, HiveID, args, localize){
    network.log("adding a hive to our network");
   
    socket.once('disconnect', network.removeHive.bind(network, socket, HiveID));

    let link = {};
    link.caller = args.caller;
    link.callee = args.callee || HiveID;
    link.host = args.host;
    link.socket = socket;
    link.bidirectional = args.options.bi || false;
    link.replication = null;

    
    network.processReplication(link, HiveID,  args, localize);

    links[args.linkID] = link;

    return args.linkID;
  };

  network.removeHive = function(socket, HiveID, reason){

    let linkID = network.lookupByHiveID(HiveID);
    if(!linkID){
      return false;
    }
    network.log("unlinking hive with id", HiveID, reason);
    links[linkID] = null;
    delete links[linkID];
  };


  network.unlinkHive = function(args, callback){
    if(args.options.all){
      callback("closing...");
      return network.closeAllLinks();
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
        let HiveID = link.callee;
        if(link.host !== 'SELF'){
          HiveID = link.caller;
        }
        network.log("attempting to blast to link", linkID, 'connected to hive:', HiveID);
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

  network.lookupByHiveID = function(HiveID){
    for(let linkID in links){
      let link = links[linkID];
      let needleHiveID = (link.host === 'SELF') ? link.caller : link.callee;
      if (needleHiveID === HiveID){
        return linkID
      }
    }
    return false;
  };

  network.list = function(args, callback){
    let json = {};
    for(let linkID in links){
      let link = links[linkID];
      json[linkID] = {host: link.host, bidirectional: link.bidirectional, caller: link.caller, callee: link.callee, replication: link.replication};
    }
    callback(json);
    return json;
  };

  network.closeAllLinks = function(){
    for(let linkID in links){
      let link = links[linkID];
      link.socket.close();
    }
  };

  network.gc = function(){
    network.closeAllLinks();
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