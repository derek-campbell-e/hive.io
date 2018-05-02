module.exports = function DaemonFunctions(Daemon){
  const path = require('path');
  const fs = require('fs');
  const binPath = path.join(__dirname, '../../../', '.bin');

  Daemon.getHiveByID = function(id){
    const filename = "hives.json";
    let currentData = {};
    try {
      currentData = require(path.join(binPath, filename));
    } catch(error){

    }
    if(!currentData.hasOwnProperty(id)){
      return false;
    }
    let hiveData = currentData[id];
    return hiveData;
  };

  Daemon.retireHive = function(args, callback){
    Daemon.localHive = null;
    let hiveData = Daemon.getHiveByID(args.id);
    if(!hiveData){
      return callback("No hive by that ID exists...");
    }
    Daemon.remote.directConnect(hiveData.port, hiveData.token, function(error, socket){
      if(!error){
        Daemon.remote.emitToLocalHost(null, "remote:command", "retire:hive", args, callback);
      } else {
        callback(error);
      }
    });
  };

  Daemon.enterHive = function(args, callback){
    Daemon.localHive = null;
    let hiveData = Daemon.getHiveByID(args.id);
    if(!hiveData){
      return callback("No hive by that ID exists...");
    }
    Daemon.remote.directConnect(hiveData.port, hiveData.token, function(error, socket){
      if(!error){
        Daemon.localHive = socket;
        Daemon.cli.delimiter(`hive:${args.id}$`).show();
        Daemon.cli.log("entering hive...");
        callback();
        //Daemon.cli.delimiter(`hive:${args.id}$`).show();
      } else {
        callback(error);
      }
    });
  };

  Daemon.createAuthFile = function(args, callback){
    const data = {id: args.data.id, token: args.data.token, cwd: args.cwd, port: args.options.port, pid: args.pid};
    const filename = "hives.json";
    let currentData = {};
    try {
      currentData = require(path.join(binPath, filename));
    } catch(error){

    }
    currentData[args.data.id] = data;
    fs.mkdir(binPath, function(error){
      if(error){
        if(error.code === 'EEXIST'){

        } else {
          throw error;
        }
      }
      fs.writeFile(path.join(binPath, filename), JSON.stringify(currentData, null, 4), function(error){
        if(error) throw error;
        Daemon.cli.log(args.data.id);
        callback();
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
      detached: true,
      stdio: 'ignore'
    });

    let onReady = function(pid, data){
      if(hive.pid === pid){
        Daemon.removeListener('ready', onReady);
        args.data = data;
        args.pid = hive.pid;
        hive.unref();
        Daemon.createAuthFile(args, callback);
      } else {
        Daemon.cli.log("Unable to connect to host...");
        callback();
      }
    };

    Daemon.on('ready', onReady);
    
    return hive.pid;
  };
};