module.exports = function DaemonFunctions(Daemon){
  const path = require('path');
  const fs = require('fs');
  const binPath = path.join(__dirname, '../../../', '.bin');

  Daemon.hiveByDirectory = function(){
    Daemon.cli.log("CURRENT DIRECTORY " + __dirname);
    let cwd = path.resolve(process.cwd());
    let currentData = {};
    try {
      currentData = require(path.join(binPath, 'hives.json'));
    } catch(error){
      Daemon.cli.log(error);
    }
    Daemon.cli.log(binPath);
    Daemon.cli.log(currentData);
    let hiveData = null;
    let found = false;
    for(let hiveID in currentData){
      Daemon.cli.log(hiveID, currentData);
      let hive = currentData[hiveID];
      if(hive.cwd === cwd && !found){
        hiveData = hive;
        found = true;
      } else if (hive.cwd === cwd && found){
        throw new Error("Two hives exist in this directory, you must specify ID with --id=<id> | -i <id>"); 
      }
    }
    return hiveData;
  };

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
    let hiveData = null;
    try {
      hiveData = Daemon.hiveByDirectory();
    } catch(error){
      Daemon.cli.log(error);
      callback();
      return false;
    }
    
    if(!hiveData){
      Daemon.cli.log("No hive in this directory....");
      process.exit(0);
      return callback();
    }
    Daemon.remote.directConnect(hiveData.port, hiveData.token, function(error, socket){
      if(!error){
        Daemon.localHive = socket;
        Daemon.cli.delimiter(`hive:${hiveData.id}$`).show();
        Daemon.cli.log("entering hive...");
        callback();
      } else {
        callback(error);
      }
    });
  };

  Daemon.enterHiveDetached = function(args, callback){
    Daemon.localHive = null;
    let hiveData = Daemon.hiveByDirectory();
    if(!hiveData){
      return callback("No hive in this directory");
    }
    Daemon.remote.directConnect(hiveData.port, hiveData.token, function(error, socket){
      if(!error){
        Daemon.localHive = socket;
        callback();
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

    fs.writeFile(path.join(binPath, filename), JSON.stringify(currentData, null, 4), function(error){
      if(error) throw error;
      Daemon.cli.log(args.data.id);
      callback();
    });
    /*
    fs.mkdir(binPath, function(error){
      if(error){
        if(error.code === 'EEXIST'){

        } else {
          throw error;
        }
      }
     
    });
    */
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