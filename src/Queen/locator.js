module.exports = function Locator(Queen, Cache){
  // our includes
  const debug = require('debug')('queen:locator');
  const common = require('../Common');
  const path = require('path');
  const glob = require('multi-glob').glob;
  const watch = require('watch');

  // our locator module
  let loc = common.object('queen', 'locator');

  loc.fileDidChange = function(f, curr, prev){
    if(typeof f == "object" && prev === null && curr === null){
      return;
    }
    loc.log("got a file change", f);
    loc.emit('fileDidChange', f);
  };

  loc.watchForFileChanges = function(){
    watch.watchTree(options.droneFolder, {ignoreDirectoryPattern: '/node_modules/', interval: 1}, loc.fileDidChange);
  };

  // cache the drone file / folder found
  loc.cacheMeta = function(droneMindFile){
    loc.log("catching drone located at:", droneMindFile);
    let droneMind = path.basename(droneMindFile, '.js');
    let meta = {}
    meta.name = droneMind;
    meta.path = droneMindFile;
    meta.cachedAt = common.timestamp();

    // if we have a cached instance already, don't remove the stored instance
    if(Cache.drones.hasOwnProperty(droneMind) && Cache.drones[droneMind].hasOwnProperty('instance')){
      meta.instance = Cache.drones[droneMind].instance;
    }

    Cache.drones[droneMind] = meta;
  };

  // iterate through our drone folder (process.cwd() / drones) and add files to our cache
  loc.buildCache = function(callback){
    callback = callback || function(){};
    let globOptions = {};
    globOptions.cwd = options.droneFolder;
    globOptions.absolute = true;
    globOptions.realpath = true;
    glob(["*/", "*.js"], globOptions, function(error, droneMinds){
      if(error){
        loc.log("an error occured building cache", error);
        throw error;
        return false;
      }
      droneMinds.forEach(loc.cacheMeta);
      callback();
    });
  };

  // rerun our cache building function
  loc.rebuildCache = function(callback){
    callback = callback || function(){};
    loc.buildCache(callback);
  };

  // this function helps find drones by a mind name or by beeID
  loc.searchMinds = function(needle){
    let caseSensitiveMatch = null;
    for(let droneMind in Cache.drones){
      if(droneMind === needle || droneMind.toLowerCase() === needle.toLowerCase()){
        caseSensitiveMatch = droneMind;
        break;
      }
      // check if we can match by id
      let cachedMind = Cache.drones[droneMind];
      if(needle === cachedMind.instance){
        caseSensitiveMatch = droneMind;
        break;
      }
    }
    return caseSensitiveMatch;
  };

  return loc;
};