#!/usr/bin/env node
module.exports = function Daemon(){
  const common = require('../../Common');
  const io = require('socket.io')(4200);
  const savedArguments = [...process.argv];
  console.log(savedArguments, __dirname, __filename, process.cwd(), process.execPath);
  const parsedArguments = require('vorpal')().parse([...savedArguments], {use: 'minimist'});
  
  let daemon = common.object('hive', 'daemon');
  daemon.remote = require('../Remote')(daemon);
  let cli = require('../CLI')(daemon, {daemon: true});
  daemon.cli = cli;

  require('./functions')(daemon);

  daemon.processCommandMessage = function(command, args, callback){
    const cli = this;
    switch(command){
      case 'new:hive':
        daemon.spawnHive(args, callback);
      break;
      case 'enter:hive':
        daemon.enterHive(args, callback);
      break;
      case 'exit:hive':
        if(daemon.localHive){
          daemon.localHive.close();
          daemon.localHive = null;
          daemon.cli.delimiter("hive-daemon$").show();
          return callback();
        }
        process.exit(0);

      break;
      case 'retire:hive':
        daemon.retireHive(args, callback);
      break;
      default:
        /*
        if(!daemon.localHive){
          return callback("Unable to run command...");
        }
        daemon.remote.emitToLocalHost(null, "remote:command", command, args, callback);
        */
        daemon.enterHiveDetached(args, function(error){
          if(error){
            return callback(error);
          }
          daemon.remote.emitToLocalHost(null, "remote:command", command, args, callback);
        });
      break;
    }
  };

  let replaceParse = function(){
    cli.parse = function(argv, options){
      options = options || {};
      var args = argv;
      var result = this;
      args.shift();
      args.shift();
      for (let i = 0; i < args.length; ++i) {
        if (i === 0) {
          continue;
        }
        if (args[i].indexOf(' ') > -1) {
          args[i] = `"${args[i]}"`;
        }
      }
      this.exec(args.join(' '), function (err) {
        this.log(err);
      });
      return result;
    };
  };

  
  io.on('connection', function(socket){
    socket.once('ready', function(){
      daemon.emit.apply(daemon, ['ready', ...arguments]);
    });
  });
  

  let init = function(){
    let firstCommand = parsedArguments._[0]; // the first should be 'hive'
    switch(firstCommand){
      case 'new':
      case 'retire':
        cli.parse(savedArguments);
      break;
      case 'enter':
        cli.delimiter("hive-daemon$").show().exec(parsedArguments._.join(" "));
      break;
      default:
        replaceParse();
        cli.delimiter("hive-daemon$").show().parse(savedArguments);
      break;
    }
    return daemon;
  };

  return init();

}();