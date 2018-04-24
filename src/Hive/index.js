module.exports = function Hive(Options){
  Options = Options || {};
  const common = require('../Common');
  const debug = require('debug')('hive');
  const options = common.options(Options);
  global['options'] = options; 
  debug("running hive with options", options);

  let hive = common.object('hive');
  hive.options = options;
  let remoteManager = require('./Remote')(hive);
  hive.remote = remoteManager;

  let cli = require('./CLI')(hive);
  hive.cli = {};
  hive.cli.log = function(){
    cli.log.apply(cli, arguments);
  };
  let server = require('./Server')(hive);
  let socketManager = require('./Socket')(hive, server, cli);
  
 

  let bees = {};
  let queen = null;

  hive.processCommandMessage = function(command, args, callback){
    if(hive.remote.meta.isUsingRemote){
      hive.log("emitting message to remote hive");
      let ableToEmitMessage =  hive.remote.emitToHost(null, "remote:command", command, args, callback);
      if(!ableToEmitMessage){
        hive.log("unable to talk to remote host...");
        cli.log("Unable to talk to remote host...disconnecting");
        //functions.disconnectRemoteHost(callback);
      } 
      return ableToEmitMessage;
    }
    hive.log("emitting message to local hive");
    hive.emit(command, args, callback);
  };

  hive.didSpawnBee = function(bee){
    hive.emit('bee:spawn', bee);
  };

  hive.didRetireBee = function(bee){
    hive.emit('bee:retire', bee);
  };

  hive.gc = function(){
    debug("GOING TO GARBAGE COLLECT");
    hive.emit('gc');
  };

  hive.export = function(){
    return require('extend')(true, {}, hive.meta);
  };

  let bind = function(){
    process.on('SIGINT', hive.gc);
  };

  let init = function(){
    bind();
    hive.setMaxListeners(0);
    queen = require('../Queen')(hive, bees);
    queen.spawn();
    return hive;
  };
  

  return init();
};