module.exports = function HiveFunctions(Daemon, Io){
  const path = require('path');
  const fs = require('fs');
  const binPath = path.join(__dirname, '../../../', '.bin');
  const filename = "hives.json";
  const fullFilepath = path.join(binPath, filename);
  const clientio = require('socket.io-client');

  // function to clean up hives that we cannot connect to
  // should run this when we start up, and a detached instance to keep this running
  Daemon.garbageCollection = function(){
    const request = require('request');
    let currentData = {};
    try {
      delete require.cache[require.resolve(fullFilepath)];
      currentData = require(fullFilepath);
    } catch(error){

    }
    let hives = Object.keys(currentData);

    let loop = function(){
      let hiveID = hives.shift();
      if(typeof hiveID === "undefined"){
        let jsonData = JSON.stringify(currentData, null, 2);
        fs.writeFile(fullFilepath, jsonData, function(error){
          if(error) throw error;
        });
        return false;
      }
      let hive = currentData[hiveID];
      let host = `http://localhost:${hive.port}`;
      request
        .get(host)
        .on('response', function(){
          loop();
        })
        .on('error', function(){
          currentData[hiveID] = null;
          delete currentData[hiveID];
          Daemon.log("deleting non-existent hive", hiveID);
          loop();
        });
    };
    loop();
  };


  // locate a hive with the given stored data by ID
  Daemon.getHiveByID = function(storedData, id, callback){
    for(let hiveID in storedData){
      if(hiveID === id){
        let instance = storedData[hiveID];
        callback(null, instance);
        return instance;
      }
    }
    callback(null, null);
    return false;
  };

  // locate a hive by a directory
  // will fail if more than one hive in a directory, so an ID must be supplied
  Daemon.getHiveByDirectory = function(storedData, directory, callback){
    let found = false;
    let instance = null;
    let error = false;
    for(let hiveID in storedData){
      let hive = storedData[hiveID];
      if(hive.cwd === directory && !found){
        error = false;
        found = true;
        instance = hive;
        continue;
      }
      if(hive.cwd === directory && found){
        error = true;
        instance = null;
      }
    }
    callback(error, instance);
    return instance;
  };

  // locate a hive either by id, or by directory
  // will fail if there are multiple hives by directory and ID not supplied
  Daemon.locateHive = function(args, callback){
    let currentData = {};
    try {
      delete require.cache[require.resolve(fullFilepath)];
      currentData = require(fullFilepath);
    } catch(error){

    }
    if(args.options.id){
      return Daemon.getHiveByID(currentData, args.options.id, callback);
    }
    let directory = path.resolve(args.directory || process.cwd());
    return Daemon.getHiveByDirectory(currentData, directory, callback);
  };


  // routine to locate the hive and then connected to its socket
  Daemon.enterHive = function(args, callback){
    let cli = this;
    Daemon.locateHive(args, function(error, hive){
      if(error){
        cli.log("more than one hive in this directory, please specify an id");
        callback();
        return false;
      } 
      if(!hive){
        cli.log("no hive has been found, please try again");
        callback();
        return false;
      }
      let host = `http://localhost:${hive.port}/?token=${hive.token}`;
      cli.log(`Connecting to local hive on port ${hive.port}`);
      args.port = hive.port;
      Daemon.connectToLocalHive.call(cli, host, args, callback);
      //callback();
    });
  };

  Daemon.connectToLocalHive = function(host, args, callback){
    let cli = this;
    let socket = clientio(host);

    Daemon.meta.activeHive = null;

    let errorFunction = function(error){
      removeListeners();
      cli.log("an error occured connecting to the hive: " + error);
      callback();
    };

    let disconnectFunction = function(reason){
      removeListeners();
      cli.log("hive instance has disconnected. Reason: " + reason);
      callback();
    };

    let removeListeners = function(socket){
      try {
        socket.removeListener('connect_error', errorFunction);
        socket.removeListener('error', errorFunction);
        socket.removeListener('disconnect', disconnectFunction);
      } catch (error) {
        Daemon.error("Could not remove socket listeners:", error);
      }
    };

    socket.once('connect_error', errorFunction);
    socket.once('error', errorFunction);
    socket.once('disconnect', disconnectFunction);

    socket.once('connect', function(){
      Daemon.meta.activeHive = socket;
      cli.log("successfully connected!");
      Daemon.cli.emit('delimiter', `hive:${args.port}$`, callback);
    });

  };

  // Exit the currently connected hive instance
  Daemon.exitHive = function(args, callback){
    let cli = this;
    if(!Daemon.meta.activeHive){
      cli.log("No active hive is connected...");
      return Daemon.cli.emit('delimiter', 'hive-daemon$', function(){
        callback();
        process.exit(0);
      });
    }
    Daemon.meta.activeHive.disconnect();
    return Daemon.cli.emit('delimiter', 'hive-daemon$', function(){
      callback();
      process.exit(0);
    });
  };


  // Locate and preprare to connect to the hive instance
  // With detached commands, we need to locate them each time 
  Daemon.prepareForDetachedCommand = function(args, callback){
    let cli = this;
    Daemon.locateHive(args, function(error, hive){
      if(error){
        cli.log("more than one hive in this directory, please specify an id");
        callback("more than one hive in this directory, please specify an id");
        return false;
      } 
      if(!hive){
        cli.log("no hive has been found, please try again");
        callback(true);
        return false;
      }
      let host = `http://localhost:${hive.port}/?token=${hive.token}`;
      cli.log(`Connecting to local hive on port ${hive.port}`);
      args.port = hive.port;
      args.host = host;
      callback(null, host);
    });
  };

  // Create the auth file that will store data from spawned hives
  // We will use the data (with the token) to connect to the instance
  Daemon.createAuthFile = function(args, callback){
    let cli = this;
    const data = {id: args.data.id, token: args.data.token, cwd: args.directory, port: args.options.port, pid: args.pid};
    
    let currentData = {};
    try {
      delete require.cache[require.resolve(fullFilepath)];
      currentData = require(fullFilepath);
    } catch(error){

    }

    currentData[args.data.id] = data;
    let jsonData = JSON.stringify(currentData, null, 2);

    let fileWriter = function(){
      fs.writeFile(fullFilepath, jsonData, function(error){
        if(error) throw error;
        cli.log(args.data.id);
        callback();
      });
    };

    let binPathExists = fs.existsSync(binPath);
    if(!binPathExists){
      return fs.mkdir(binPath, function(error){
        fileWriter();
      });
    }

    fileWriter();
  };

  // list the active hives from our binfile
  // TODO: add memory usage for each instance
  Daemon.listActiveHives = function(args, callback){
    let cli = this;
    let currentData = {};
    try {
      delete require.cache[require.resolve(fullFilepath)];
      currentData = require(fullFilepath);
    } catch(error){

    }
    for(let hiveID in currentData){
      let hive = currentData[hiveID];
      let text = `Hive: ${hiveID}
Port: ${hive.port}
CWD: ${hive.cwd}
PID: ${hive.pid}
      `;
      cli.log(text);
    }
    return callback();
  };

  // spawn a hive from the cli
  // integrate USERNAME and PASSWORD
  Daemon.spawnHive = function(args, callback){
    let cli = this;
    let hasSpawned = false;
    const spawn = require('child_process').spawn;
    const hiveIOPath = path.join(__dirname, '../../../index.js');
    args.directory = path.resolve(args.directory || process.cwd());
    args.options.port = args.options.port || 4204;
    let hive = spawn(`node`, [hiveIOPath, '--port', args.options.port, '--detached', true, "--daemon", Daemon.meta.port], {
      cwd: args.directory,
      detached: true,
      stdio: 'ignore'
    });

    let onReady = function(pid, data){
      if(hive.pid === pid){
        hasSpawned = true;
        Daemon.log("received response from hive, performing routine...");
        args.data = data;
        args.pid = hive.pid;
        hive.unref();
        Daemon.createAuthFile.call(cli, args, callback);
        Daemon.removeListener('ready', onReady);
        return;
      } else {
        cli.log("Unable to connect to host...");
        callback();
      }
      Daemon.removeListener('ready', onReady);
    };

    Daemon.on('ready', onReady);

    setTimeout(function(){
      if(hasSpawned){
        return false;
      }
      let logFolder = path.resolve(path.join(args.directory, 'logs/stderr.txt'));
      cli.log(`Hive probably did not spawn properly.\nPlease check the logs in '${logFolder}' for more information.`);
      callback();
    }, 15 * 1000);
  };

  // listen to new hive spawns notifying the hive
  Io.on('connection', function(socket){
    socket.once('ready', function(){
      Daemon.emit.apply(Daemon, ['ready', ...arguments]);
    });
  });

};