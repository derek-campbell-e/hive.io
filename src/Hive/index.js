module.exports = function Hive(Options){
  Options = Options || {};
  const common = require('../Common');
  const debug = require('debug')('hive');
  const options = common.options(Options);
  options.hiveID = common.uuid();
  global['options'] = options; 
  
  let hive = common.object('hive', 'default', {id: options.hiveID});
  hive.token = require('./Token')();
  
  hive.options = options;
  hive.meta.port = options.port;
  
  
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
      } 
      return ableToEmitMessage;
    }
    hive.log("processing command", command, "with args:", args);
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

    if(options.daemonMode){
      hive.cli = cli;
      hive.log("running hive in daemon mode...");
      return hive;
    }

    hive.log("running hive with options", options);
    queen = require('../Queen')(hive, bees);
    queen.spawn();

    hive.token.forever(function(error, token){
      let output = {
        id: hive.meta.id,
        token: token
      };
      if(options.detached){
        hive.log("trying to notifty");
        socketManager.notifyDaemon(output, function(){
          hive.log("notified daemon");
        });
      }
    });
    return hive;
  };
  

  return init();
};