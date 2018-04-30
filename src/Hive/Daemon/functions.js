module.exports = function DaemonFunctions(Daemon){
  const path = require('path');
  const fs = require('fs');
  const binPath = path.join(__dirname, '../../../', '.bin');

  Daemon.enterHive = function(args, callback){
    Daemon.localHive = null;
    const filename = "hives.json";
    let currentData = {};
    try {
      currentData = require(path.join(binPath, filename));
    } catch(error){

    }
    if(!currentData.hasOwnProperty(args.id)){
      return callback("No hive found by that id...");
    }
    let hiveData = currentData[args.id];
    Daemon.remote.directConnect(hiveData.port, hiveData.token, function(error, socket){
      if(!error){
        Daemon.localHive = socket;
        Daemon.cli.delimiter(`hive:${args.id}$`).show();
        callback("WE CAN ENTER THE HIVE!!!!");
      } else {
        callback(error);
      }
    });
  };

  Daemon.createAuthFile = function(args, callback){
    const data = {id: args.data.id, token: args.data.token, cwd: args.cwd, port: args.options.port};
    const filename = "hives.json";
    let currentData = {};
    try {
      currentData = require(path.join(binPath, filename));
    } catch(error){

    }
    currentData[args.data.id] = data;
    fs.mkdir(binPath, function(error){
      if(error.code === 'EEXIST'){
      } else if (error) {
        throw error;
      } 
      fs.writeFile(path.join(binPath, filename), JSON.stringify(currentData, null, 4), function(error){
        if(error) throw error;
        callback(args.data.id);
      });
    });
  };

  Daemon.spawnHive = function(args, callback){
    const spawn = require('child_process').spawn;
    const hiveIOPath = path.join(__dirname, '../../../index.js');
    let cwd = args.directory || process.cwd();
    cwd = path.resolve(cwd);
    args.cwd = cwd;
    args.options.port = args.options.port || 5000;
    let hive = spawn(`node`, [hiveIOPath, '--port', args.options.port || 5000, '--detached', true, "--daemon", "4200"], {
      cwd: cwd,
      //shell: true,
      detached: true,
      stdio: 'ignore'
    });

    let onReady = function(pid, data){
      if(hive.pid === pid){
        Daemon.removeListener('ready', onReady);
        args.data = data;
        hive.unref();
        Daemon.createAuthFile(args, callback);
      }
    };

    Daemon.on('ready', onReady);
    
    return hive.pid;
  };
};