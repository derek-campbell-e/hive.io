#!/usr/bin/env node
module.exports = function Daemon(){
  const port = 4200;
  const common = require('../../Common');
  const vorpal = require('vorpal')();
  const io = require('socket.io')(port);
  const fork = require('child_process').fork;
  const path = require('path');
  const hiveIOPath = path.join(__dirname, '../../../index.js');
  let daemon = common.object('hive', 'daemon', {verbose: true});

  let hives = {};

  let hiveLocator = function(hiveID){
    for(let cwd in hives){
      let hive = hives[cwd];
      if(hive.hiveID === hiveID){
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

  daemon.spawnHive = function(args, callback){
    
    let cwd = args.directory || process.cwd();
    cwd = path.resolve(cwd);
   
    let hive = fork(hiveIOPath, ['--port', args.options.port || 5000], {
      cwd: cwd,
      silent: true,
      //stdio: 'ipc'
    });
   
    hive.once('message', function(hiveMeta){
      hives[cwd] = {
        process: hive,
        hiveID: hiveMeta.id,
        directory: cwd,
      };
      callback(hiveMeta.id);
    });
  };

  daemon.sendCommand = function(args, callback){
    let cwd = args.options.directory || process.cwd();
    if(!hives.hasOwnProperty(cwd)){
      return callback("no hive in this directory");
    }
    let hive = hives[cwd];
    let command = args.command.join(" ");
    hive.process.send({message: 'command', command: command});
    hive.process.once('message', function(data){
      callback(data);
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

  let bind = function(){
    process.on('SIGINT', function(){
      for(let cwd in hives){
        let hive = hives[cwd];
        hive.process.kill(9);
      }
      io.close();
    });
  };

  let init = function(){
    bind();
    daemon.log("starting daemon on port:", port);
    vorpal.delimiter("hive-daemon$").show();
    return daemon;
  };

  return init();
}();