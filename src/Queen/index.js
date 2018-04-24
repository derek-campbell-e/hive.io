module.exports = function Queen(Hive, Bees){
  const common = require('../Common');
  const debug = require('debug')('queen:base');
  let queen = require('../Bee')(Hive, 'queen');
  let cache = {};
  cache.drones = {};
  let locator = require('./locator')(queen, cache);

  let events = {
    'bee:spawn': 'addActiveBee',
    'bee:retire': 'removeActiveBee',
    'spawn:drone': 'spawnDrone',
    'spawn:drones': 'spawnDrones',
    'stats': 'stats',
    'reload': 'reload',
    'testdrone': 'testDrone',
    'start:drone': 'startDrone',
    'start:drones': 'startDrones',
    'stop:drone': 'stopDrone',
    'stop:drones': 'stopDrones',
    'retire:drone': 'retireDrone',
    'retire:drones': 'retireDrones',
    'ls:drones': 'listDrones'
  };

  let stats = {};
  stats.beesSpawned = [];
  stats.beesRetired = [];

  stats.activeDrones = {};
  stats.activeWorkers = {};
  stats.activeBees = {};

  stats.totalSpawned = 1; // include queen
  stats.totalRetired = 0;

  queen.meta.stats = stats;

  require('./droneFunctions')(Hive, queen, Bees, locator, cache);
  require('./statFunctions')(Hive, queen, Bees, locator, cache, stats);


  queen.addActiveBee = function(bee){
    Bees[bee.meta.id] = bee;
    let beeID = bee.meta.id;
    stats.beesSpawned.push({timestamp: common.timestamp(), bee: bee.meta.debugName()});
    let activeReference = null;
    switch(bee.meta.class){
      case 'bee':
        activeReference = stats.activeBees;
        break;
      case 'worker':
        activeReference = stats.activeWorkers;
        break;
      case 'drone':
        activeReference = stats.activeDrones;
        break;
      break;
      default:
        return false;
      break;
    }
    if(!activeReference){
      return false;
    }
    activeReference[beeID] = bee.meta.class + ":" + bee.meta.mind;
    stats.totalSpawned ++;
  };

  queen.removeActiveBee = function(bee){
    let activeReference = null;
    let beeID = bee.meta.id;
    stats.beesRetired.push({timestamp: common.timestamp(), bee: bee.meta.debugName()});
    switch(bee.meta.class){
      case 'bee':
        activeReference = stats.activeBees;
        break;
      case 'worker':
        activeReference = stats.activeWorkers;
        break;
      case 'drone':
        activeReference = stats.activeDrones;
        break;
      break;
      default:
        return false;
      break;
    }
    if(!activeReference){
      return false;
    }
    activeReference[beeID] = null;
    delete activeReference[beeID];
    Bees[bee.meta.id] = null;
    delete Bees[bee.meta.id];
    stats.totalRetired ++;
  };

  queen.gc = function(){
    for(let eventKey in events){
      let funcName = events[eventKey];
      let func = queen[funcName] || function(){};
      Hive.removeListener(eventKey, func);
    }
  };

  queen.stats = function(args, callback){
    callback = callback || function(){};
    let json = {};
    json.hive = Hive.export();
    json.port = options.port;
    json.totalRetired = stats.totalRetired;
    json.totalSpawned = stats.totalSpawned;
    json.active = {drones: {}, workers: {}};
    for(let droneID in stats.activeDrones){
      json.active.drones[droneID] = Bees[droneID].export();
    }
    for(let workerID in stats.activeWorkers){
      json.active.workers[workerID] = Bees[workerID].export();
    }
    callback(json);
    return json;
  };

  queen.testDrone = function(args, callback){
    let drone = require('../Drone')(Hive);
    callback();
  };

  queen.buildCache = function(callback){
    callback = callback || function(){};
    queen.log("building cache...");
    locator.buildCache(callback);
  };

  queen.rebuildCache = function(callback){
    callback = callback || function(){};
    queen.log("rebuilding cache...");
    locator.rebuildCache(callback);
  };

  queen.reload = function(args, callback){
    //console.log(this, cli);
    queen.rebuildCache();
    Hive.cli.log('reloading...');
    callback();
  };

  queen.listDrones = function(args, callback){
    let json = {};
    for(let droneMind in cache.drones){
      queen.log(droneMind);
      let cachedMind = cache.drones[droneMind];
      let meta = {};
      meta = {name: droneMind, instance: cachedMind.instance || null};
      if(cachedMind.instance){
        meta.spawnedAt = Bees[cachedMind.instance].meta.spawnedAt;
      }
      json[droneMind] = meta;
    }
    callback(json, "here are your drones mf");
  };

  let bind = function(){
    for(let eventKey in events){
      let funcName = events[eventKey];
      let func = queen[funcName] || function(){};
      Hive.on(eventKey, func);
    }
  };

  let init = function(){
    bind();
    queen.buildCache(queen.loadStartupDrones);
    return queen;
  };

  return init();
};