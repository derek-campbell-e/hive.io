module.exports = function Locator(Queen, Cache){
  const debug = require('debug')('queen:locator');
  const common = require('../Common');
  const path = require('path');
  const glob = require('multi-glob').glob;

  let loc = {};

  loc.cacheMeta = function(droneMindFile){
    debug(droneMindFile);
    let droneMind = path.basename(droneMindFile, '.js');
    let meta = {}
    meta.name = droneMind;
    meta.path = droneMindFile;
    meta.cachedAt = common.timestamp();

    if(Cache.drones.hasOwnProperty(droneMind) && Cache.drones[droneMind].hasOwnProperty('instance')){
      meta.instance = Cache.drones[droneMind].instance;
    }

    Cache.drones[droneMind] = meta;
  };

  loc.buildCache = function(callback){
    callback = callback || function(){};
    let globOptions = {};
    globOptions.cwd = options.droneFolder;
    globOptions.absolute = true;
    globOptions.realpath = true;
    glob(["*/", "*.js"], globOptions, function(error, droneMinds){
      if(error){
        debug("an error occured building cache", error);
        throw error;
        return false;
      }
      droneMinds.forEach(loc.cacheMeta);
      callback();
    });
  };

  loc.rebuildCache = function(callback){
    callback = callback || function(){};
    loc.buildCache(callback);
  };

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