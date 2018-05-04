#!/usr/bin/env node
module.exports = function Daemon(){
  const port = 4200;
  const common = require('../../Common');
  const io = require('socket.io')(port);
  const savedArguments = [...process.argv];
  const parsedArguments = require('vorpal')().parse([...savedArguments], {use: 'minimist'});
  const request = require('request');
  const URL = require('url').URL;
  let clientio = require('socket.io-client');
  const daemonID = common.uuid();
  global['options'] = {};
  options.hiveID = 'DAEMON';

  let daemon = common.object('hive', 'daemon', {id: daemonID});
  daemon.meta.port = port;
  
  // the active hive socket we'll connect to when we use the enter command
  daemon.meta.activeHive = null;

  require('./hiveFunctions')(daemon, io);
  daemon.cli = require('./cli')(daemon);
  
  daemon.processRequest = function(event, args, callback){
    let cli = this;
    if(daemon.meta.activeHive){
      daemon.meta.activeHive.emit('remote:command', event, args, function(data){
        cli.log(data);
        callback();
      });
      return;
    }

    daemon.prepareForDetachedCommand(args, function(error, host){
      if(error){
        cli.log(error);
        callback();
        return false;
      }

      let socket = clientio(host);

      let errorFunction = function(error){
        cli.log("an error occured connecting to the hive: " + error);
        callback();
      };

      let disconnectFunction = function(reason){
        cli.log("hive instance has disconnected. Reason: " + reason);
        callback();
      };

      let removeListeners = function(socket){
        socket.removeListener('connect_error', errorFunction);
        socket.removeListener('error', errorFunction);
        socket.removeListener('disconnect', disconnectFunction);
      };

      socket.once('connect', function(){
        socket.emit('remote:command', event, args, function(data){
          cli.log(data);
          removeListeners(socket);
          socket.disconnect();
          callback();
        });
      });

      socket.once('connect_error', errorFunction);
      socket.once('error', errorFunction);
      socket.once('disconnect', disconnectFunction);
    });
  };


  
  let init = function(){
    
    let command = parsedArguments._[0]; // the first should be 'hive'
    switch(command){
      case 'enter':
        daemon.cli.emit('delimiter', 'hive-daemon$', function(){
          let args = [...savedArguments];
         
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

          daemon.cli.vorpal.exec(args.join(" "), function(){

          });
        });
      break;
      default:
        daemon.cli.vorpal.delimiter("").show().parse(savedArguments);
      break;
    }
    
    daemon.garbageCollection();

    return daemon;
  };

  return init();

}();