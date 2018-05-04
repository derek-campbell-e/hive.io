module.exports = function HiveNetwork(Hive){
  const debug = require('debug')('hive:network');
  const common = require('../../Common');

  let network = common.object('hive', 'network');
  let hives = {};

  network.addHiveRoutine = function(args, socket, callback){
    socket.once('connect', function(){
      socket.emit("begin:link", Hive.meta.id, args.options, function(HiveID){
        network.addHive(socket, HiveID, args.options);
        socket.once('disconnect', network.removeHive.bind(network, socket, HiveID));
        callback();
      });
    });
  };

  network.addHive = function(socket, HiveID){
    network.log("adding a hive to our network");
    hives[HiveID] = socket;
  };

  network.removeHive = function(socket, HiveID){
    hives[HiveID] = null;
    delete hives[HiveID];
  };

  network.blast = function(args, callback){
    network.log("blasting message", args.event, 'with args', args);
    for(let hiveID in hives){
      let socket = hives[hiveID];
      network.log("attempting to blast to hive:", hiveID);
      socket.emit.apply(socket, ['network:blast', args.event, args]);
    }
    callback();
  };

  network.lookup = function(socket){
    for(let hiveID in hives){
      let hiveSocket = hives[hiveID];
      if(hiveSocket.id === socket.id){
        return hiveID;
      }
    }
    return false;
  };

  network.list = function(args, callback){
    let json = {};
    for(let hiveID in hives){
      let hiveSocket = hives[hiveID];
      json[hiveID] = {id: hiveID};
    }
    callback(json);
    return json;
  };

  let bind = function(){
    Hive.on('blast:message', network.blast);
    Hive.on('ls:network', network.list);
  };

  let init = function(){
    bind();
    network.log("initialized hive network...");
    return network;
  };

  return init();
};