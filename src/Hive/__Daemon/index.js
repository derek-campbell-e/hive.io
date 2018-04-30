#!/usr/bin/env node
module.exports = function Daemon(){
  const port = 4200;
  const common = require('../../Common');
  const vorpal = require('vorpal')();
  const io = require('socket.io')(port);
  const remote = require('socket.io-client');
  const fork = require('child_process').fork;
  const path = require('path');
  const hiveIOPath = path.join(__dirname, '../../../index.js');

  let daemon = common.object('hive', 'daemon', {verbose: false});
  let hives = {};
  let functions = require('./functions')(daemon, hives, io);

  daemon.processCommandMessage = function(event, args, callback){
    daemon.emit(event, args, callback);
  };

  let cli = require('./cli')(daemon);

  let hiveLocator = function(byHiveID){
    for(let hiveID in hives){
      let hive = hives[hiveID];
      if(hiveID === byHiveID){
        return hive;
      }
    }
    return false;
  };

  let piper = function(hive){
    //hive.process.stdin.pipe(process.stdin);
    hive.process.stdout.pipe(process.stdout);
    hive.process.stderr.pipe(process.stderr);
    process.stdin.pipe(hive.process.stdin);
  };

  let unpiper = function(hive){
    hive.process.stdin.unpipe(process.stdin);
    hive.process.stdout.unpipe();
    hive.process.stderr.unpipe();
    process.stdin.unpipe(hive.process.stdin);
  };

  /*
  daemon.spawnHive = function(args, callback){
    let cwd = args.directory || process.cwd();
    cwd = path.resolve(cwd);
   
    let hive = fork(hiveIOPath, ['--port', args.options.port || 5000, '--detached', true], {
      cwd: cwd,
      silent: true,
    });
   
    hive.once('message', function(startupData){
      hives[startupData.hive.id] = {
        process: hive,
        hiveID: startupData.hive.id,
        directory: cwd,
        token: startupData.token,
        port: startupData.port,
        socket: remote("//localhost:")
      };
      callback(startupData.hive.id);
    });
  };
  */

  daemon.sendCommand = function(args, callback){
    let cwd = args.options.directory || process.cwd();
    if(!hives.hasOwnProperty(cwd)){
      return callback("no hive in this directory");
    }
    let hive = hives[cwd];
    let command = args.command.join(" ");
    /*
    hive.process.send({message: 'command', command: command});
    hive.process.once('message', function(data){
      callback(data);
    });
    */
    piper(hive);
    hive.process.stdin.write(command + "\n");
    hive.process.once('message', function(message){
      if(message === 'command:result'){
        unpiper(hive);
        callback(message);
      }
    });
  };

  daemon.enterHive = function(args, callback){
    daemon.log("attempting to enter hive");
    let hive = hiveLocator(args.hiveID);
    if(!hive){
      return callback("No hive exists with that id");
    }
    daemon.log("HIVE EXISTS");
    piper(hive);
    //hive.process.stdin.write("\n");
    hive.process.once('message', function(message){
      if(message === 'exit'){
        unpiper(hive);
        callback();
      }
    });
  };

  /*
  vorpal
    .command("new hive [directory]")
    .option('-p, --port <port>', "port to run on")
    .action(daemon.spawnHive);
  
  vorpal
    .command("enter hive <hiveID>")
    .action(daemon.enterHive);
  
  vorpal
    .command("hive <command...>")
    .parse(function(command, args){
      args = args.replace(/"/g, '\"');
      return `hive "${args}"`;
    })
    .action(daemon.sendCommand)
  */

  let bind = function(){
    daemon.on("new:hive", daemon.spawnHive);
    daemon.on("enter:hive", daemon.enterHive);
    io.on('connection', function(socket){
      socket.once('ready', function(){
        daemon.emit.apply(daemon, ['ready', ...arguments]);
      });
    });
    /*
    process.on('SIGINT', function(){
      for(let cwd in hives){
        let hive = hives[cwd];
        hive.process.kill(9);
      }
      io.close();
    });
    */
  };

  let init = function(){
    bind();
    daemon.log("starting daemon on port:", port);
    //vorpal.delimiter("hive-daemon$").show();
    return daemon;
  };

  return init();
}();