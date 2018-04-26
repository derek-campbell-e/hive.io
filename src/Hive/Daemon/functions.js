module.exports = function(Daemon, Hives){
  const remote = require('socket.io-client');
  const fork = require('child_process').fork;
  const path = require('path');
  const hiveIOPath = path.join(__dirname, '../../../index.js');

  Daemon.bindNewHiveProcess = function(hive){
    hive.once('close', function(code, signal){
      Hives[hive.hiveID] = null;
      delete Hives[hive.hiveID];
      Daemon.log("hive instance closed...", code, signal);
    });
    hive.once('disconnect', function(){
      Hives[hive.hiveID] = null;
      delete Hives[hive.hiveID];
      Daemon.log("hive instance disconnected");
    });
    hive.once('exit', function(code, signal){
      Hives[hive.hiveID] = null;
      delete Hives[hive.hiveID];
      Daemon.log("hive instance exited...", code, signal);
    });
  };

  Daemon.spawnHive = function(args, callback){
    let cwd = args.directory || process.cwd();
    cwd = path.resolve(cwd);
    let hive = fork(hiveIOPath, ['--port', args.options.port || 5000, '--detached', true], {
      cwd: cwd,
      silent: true,
    });
    Daemon.bindNewHiveProcess(hive);
    hive.once('message', function(startupData){
      Daemon.addHiveToList(cwd, hive, startupData);
      callback(startupData.hive.id);
    });
  };

  Daemon.addHiveToList = function(cwd, hive, startupData){
    let hiveMeta = startupData.hive;
    let hiveID = hiveMeta.id;
    let port = hiveMeta.port;
    let foreverToken = startupData.token;
    Hives[hiveID] = {
      process: hive,
      cwd: cwd,
      port: port,
      token: foreverToken,
    };
  };

  Daemon.createHiveSocket = function(hiveID){
    
  }


};