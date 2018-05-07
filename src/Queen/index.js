module.exports = function Queen(Hive, Bees){
  // our includes
  const common = require('../Common');
  const debug = require('debug')('queen:base');
  
  // our returned queen object
  let queen = require('../Bee')(Hive, 'queen');

  // our cache for drones where we hold drones found in process.cwd() for later spawning
  let cache = {};
  cache.drones = {};

  // our locator module to locate drones found in process.cwd() and apply to our cache
  let locator = require('./locator')(queen, cache);

  // our key/function map of events that we'll listen to the hive for
  // this is how we do most of our CLI work, we'll tell the hive to emit the command
  // and the queen runs when the event key gets fired
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
    'ls:drones': 'listDrones',
    'next:drone': 'nextDroneFire',
    'fire:drone': 'fireDrone',
    'emit:drone': 'emitDroneMessage',
    'retire:hive': 'retireHive',
    'show:logs': 'showLogs',
    'show:errors': 'showErrors',
    'show:results': 'showResults',
  };

  // our stats object
  let stats = {};
  stats.beesSpawned = [];
  stats.beesRetired = [];

  stats.activeDrones = {};
  stats.activeWorkers = {};
  stats.activeBees = {};

  stats.totalSpawned = 1; // include queen
  stats.totalRetired = 0;

  // assign it to our queen
  queen.meta.stats = stats;

  // our helpers
  // drone functions help us spawn, start, retire, fire drones
  require('./droneFunctions')(Hive, queen, Bees, locator, cache);

  // our stat functions will help us create metrics and such
  require('./statFunctions')(Hive, queen, Bees, locator, cache, stats);

  // this function runs when the hive emits 'bee:spawn'
  // we'll add a bee to our Bees object
  // and update our stats
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

  // this function runs when the hive emits 'bee:retire'
  // here we'll remove the bee from our Bees and update stats
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

  // our garbage collection function where we stop listening to the hive events
  queen.gc = function(){
    for(let eventKey in events){
      let funcName = events[eventKey];
      let func = queen[funcName] || function(){};
      Hive.removeListener(eventKey, func);
    }
  };

  // runs when the hive emits "stats"
  // return the hive stats
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

  // this function builds our cache
  queen.buildCache = function(callback){
    callback = callback || function(){};
    queen.log("building cache...");
    locator.buildCache(callback);
  };

  // this function rebuilds the cache
  queen.rebuildCache = function(callback){
    callback = callback || function(){};
    queen.log("rebuilding cache...");
    locator.rebuildCache(callback);
  };

  // this function is called after the hive emits a "reload" event
  // we rebuild our cache and the active drones do their own reloading
  queen.reload = function(args, callback){
    callback = callback || function(){};
    //console.log(this, cli);
    queen.rebuildCache();
    Hive.cli.log('reloading...');
    callback();
  };

  // ran when the hive emits "ls:drones"
  // we'll list the drones found in our cache along with their metadata
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

  queen.showLogs = function(args, callback){
    let logParser = require('./logParser');
    logParser(options.logs.stdout, args, callback);
  };

  queen.showErrors = function(args, callback){
    let logParser = require('./logParser');
    logParser(options.logs.stderr, args, callback);
  };

  queen.showResults = function(args, callback){
    let logParser = require('./logParser');
    logParser(options.logs.results, args, callback);
  };

  queen.retireHive = function(args, callback){
    Hive.emit("gc");
    setTimeout(function(){
      process.exit(0);
    }, 5000);
    callback();
  };

  queen.emitDroneMessage = function(args, callback){
    callback = callback || function(){};
    Hive.emit.apply(Hive, [`drone:${args.droneEvent}`, ...args.args, callback]);
  };

  // our binding function to listen to hive events
  let bind = function(){
    for(let eventKey in events){
      let funcName = events[eventKey];
      let func = queen[funcName] || function(){};
      Hive.on(eventKey, func);
    }
    locator.on('fileDidChange', function(file){
      Hive.emit('reload');
    });
  };

  // our initializer
  let init = function(){
    bind();
    queen.buildCache(function(){
      locator.watchForFileChanges();
      queen.loadStartupDrones();
    });
    return queen;
  };

  return init();
};