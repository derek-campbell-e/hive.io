module.exports = function Replicator(Hive, Socket){
  // our includes
  const debug = require('debug')('hive:replicate');
  const common = require('../../Common');
  const glob = require('multi-glob').glob;
  const path = require('path');
  const fs = require('fs');

  // our replication object
  let repl = common.object('hive', 'replicator');

  // our private assets object
  // we'll store file/folder structure and data here
  let assets = {};
  assets.dirs = [];
  assets.files = {};

  // our private function to reset our assets
  let reset = function(){
    assets = {};
    assets.dirs = [];
    assets.files = {};
  };

  // our function to start the replication process
  repl.commenceReplication = function(args, callback){
    repl.prepareLocalAndRemote(args, callback);
  };

  // our function to emit to remote hive that we are ready to begin replication
  repl.prepareLocalAndRemote = function(args, callback){
    Socket.on("complete:replication", repl.completeReplication.bind(repl, args, callback));
    Socket.on("ready:replication", repl.startReplication.bind(repl, args, callback));
    Socket.emit("begin:replication");
  };

  // our function to build the assets and emit to the remote hive the asset data
  repl.startReplication = function(args, callback){
    repl.log("starting the replication...");
    reset();
    repl.buildAssets(args, function(){
      Socket.compress().emit("replication:data", assets);
      callback();
    });
  };

  // our local callback from when remote hive says that replication is complete
  repl.completeReplication = function(args, callback){
    debug("we are done replicating so close the socket!");
    repl.log("replication is complete...");
    Socket.emit("remote:command", "reload", {}, function(){
      callback("REPLICATION COMPLETED");
      Socket.close();
    });
  };

  // our function to build the assets by scanning drone folder, and building data
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

  // our function to loop through files/folders to add into our assets object
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

  // our function to parse the files into assets object
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
  // called by remote hive after receiving assets data
  repl.replicateInto = function(assets, callback){
    let folders = assets.dirs;
    repl.createFolders(folders, function(){
      repl.createFiles(assets.files, function(){
        repl.installDependencies(folders, callback);
      });
    });
  };

  // called by the remote hive to create folders for each drone
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

  // called by remote hive to create each file found 
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

  // called by remote hive to install dependencies for each folder
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
      let spawn = child_process.spawn("npm", ['install'], {cwd: fullFolderPath});
      spawn.on('close', loop);
    }
    loop();
  };

  // our initializer
  let init = function(){
    repl.log("initialized");
    return repl;
  };

  return init();
};