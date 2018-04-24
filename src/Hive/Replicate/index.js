module.exports = function Replicator(Hive, Socket){
  const debug = require('debug')('hive:replicate');
  const common = require('../../Common');
  const glob = require('multi-glob').glob;
  const path = require('path');
  const fs = require('fs');

  let repl = common.object('hive', 'replicator');

  let assets = {};
  assets.dirs = [];
  assets.files = {};

  let reset = function(){
    assets = {};
    assets.dirs = [];
    assets.files = {};
  };

  repl.commenceReplication = function(args, callback){
    repl.prepareLocalAndRemote(args, callback);
  };

  repl.prepareLocalAndRemote = function(args, callback){
    Socket.on("complete:replication", repl.completeReplication.bind(repl, args, callback));
    Socket.on("ready:replication", repl.startReplication.bind(repl, args, callback));
    Socket.emit("begin:replication");
  };

  repl.startReplication = function(args, callback){
    repl.log("starting the replication...");
    repl.buildAssets(args, function(){
      Socket.compress().emit("replication:data", assets);
      callback();
    });
  };

  repl.completeReplication = function(args, callback){
    debug("we are done replicating so close the socket!");
    repl.log("replication is complete...");
    Socket.emit("remote:command", "reload", {}, function(){
      callback("REPLICATION COMPLETED");
      Socket.close();
    });
  };

  repl.buildAssets = function(args, callback){
    callback = callback || function(){};
    debug("building assets...");
    let globOptions = {};
    globOptions.cwd = Hive.options.droneFolder;
    globOptions.absolute = true;
    globOptions.realpath = true;
    globOptions.ignore = ['**/node_modules/**'];
    glob(['**/*'], globOptions, function(error, files){
      if(!error){
        repl.compileIntoAssets(files, callback);
      }
    });
  };

  repl.compileIntoAssets = function(files, callback){
    let filesCopy = [...files];
    let loop = function(){
      let file = filesCopy.shift();
      if(typeof file === "undefined"){
        debug("finished compiling assets");
        callback();
        return;
      }
      repl.addIntoStructure(file, loop);
    };
    loop();
  };

  repl.addIntoStructure = function(file, callback){
    callback = callback || function(){};
    fs.stat(file, function(error, stats){
      let isDirectory = stats.isDirectory();
      let isFile = stats.isFile();
      let relativePath = path.relative(Hive.options.beeFolder, file);

      if(isDirectory){
        assets.dirs.push(relativePath);
        return callback();
      }

      if(isFile){
        assets.files[relativePath] = null;
        fs.readFile(file, function(error, data){
          if(!error){
            assets.files[relativePath] = data;
            callback();
          }
        });
      }
    });
  };


  // these functions are called by the hive instance that is receiving the replication data
  repl.replicateInto = function(assets, callback){
    let folders = assets.dirs;
    repl.createFolders(folders, function(){
      repl.createFiles(assets.files, function(){
        repl.installDependencies(folders, callback);
      });
    });
  };

  repl.createFiles = function(files, callback){
    let basePath = Hive.options.droneFolder;
    let fileKeys = Object.keys(files);
    let loop = function(){
      let filename = fileKeys.shift();
      if(typeof filename === 'undefined'){
        callback();
        return;
      }
      let fullFilePath = path.join(basePath, filename);
      let fileData = files[filename];
      fs.writeFile(fullFilePath, fileData, {flag: 'w+'}, function(error){
        loop();
      });
    };
    loop();
  };

  repl.installDependencies = function(folders, callback){
    const child_process = require('child_process');
    const stringArgv = require('string-argv');
    let basePath = Hive.options.droneFolder;
    let foldersCopy = [...folders];
    let loop = function(){
      let folder = foldersCopy.shift();
      if(typeof folder === "undefined"){
        debug("folders are done, lets write the data");
        callback();
        return;
      }
      let fullFolderPath = path.join(basePath, folder);
      let commandArgs = stringArgv("npm install");
      let spawn = child_process.spawn(commandArgs[0], commandArgs.slice(1), {cwd: fullFolderPath});
      spawn.on('close', loop);
    }
    loop();
  };

  repl.createFolders = function(folders, callback){
    let basePath = Hive.options.droneFolder;
    let foldersCopy = [...folders];
    let loop = function(){
      let folder = foldersCopy.shift();
      if(typeof folder === "undefined"){
        debug("folders are done, lets write the data");
        callback();
        return;
      }
      let fullFolderPath = path.join(basePath, folder);
      fs.mkdir(fullFolderPath, function(error){
        loop();
      });
    }
    // if the drone folder doesn't exist, make it now!
    fs.mkdir(Hive.options.droneFolder, function(error){
      loop();
    });
  };

  let init = function(){
    repl.log("initialized");
    return repl;
  };

  return init();
};