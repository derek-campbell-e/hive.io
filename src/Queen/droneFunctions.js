module.exports = function(Hive, Queen, Bees, Locator, Cache){
  // our includes
  const debug = require('debug')('queen:base:dronefunction');

  // spawn a drone with <mind>
  Queen.spawnDrone = function(args, callback){
    Queen.log("spawning drone with mind", args.mind);
    let cachedMindName = Locator.searchMinds(args.mind);
    if(!cachedMindName){
      return callback(`no drone exists by that name ${args.mind}`, false);
    }
    let cachedMind = Cache.drones[cachedMindName];
    if(cachedMind.instance){
      return callback("drone has already been spawned", false);
    }
    let drone = require('../Drone')(Hive, cachedMind);
    cachedMind.instance = drone.meta.id;
    callback(drone.meta.id, true);
  };

  // spawn drones with <minds...>
  Queen.spawnDrones = function(args, callback){
    let spawnedDrones = [];
    let spawningDrones = args.minds;
    if(args.options.all){
      spawningDrones = [...Object.keys(Cache.drones)];
    }
    let loop = function(){
      let droneMind = spawningDrones.shift();
      if(typeof droneMind === "undefined"){
        Hive.cli.log(`spawning drones: ${spawnedDrones.join(" ")}`);
        return callback(spawnedDrones);
      }
      let argCopy = require('extend')(true, {}, args);
      argCopy.mind = droneMind;
      Queen.spawnDrone(argCopy, function(droneID, success){
        if(success){
          spawnedDrones.push(`${droneMind}:${droneID}`);
        } else {
          Hive.cli.log(droneID);
        }
        loop();
      });
    };
    loop();
  };


  // if we are allowing drones to be loaded on hive startup
  // spawn them here
  Queen.loadStartupDrones = function(){
    if(!Array.isArray(options.loadDrones)){
      options.loadDrones = [options.loadDrones];
    }
    if(options.loadAllDrones){
      Queen.log("load all drones option");
      options.loadDrones = Object.keys(Cache.drones);
    }
    Queen.log("loading the drones listed in startup", options.loadDrones, Cache);
    Queen.log("spawning startup drones...", options.loadDrones);
    let spawnedDrones = [];
    for(let droneIndex in options.loadDrones){
      let droneMind = options.loadDrones[droneIndex];
      let cachedMindName = Locator.searchMinds(droneMind);
      if(!cachedMindName){
        Queen.log("no drone found by that name...");
        Queen.log("no drone mind found with name", droneMind);
        continue;
      }
      let cachedMind = Cache.drones[cachedMindName];
      let drone = require('../Drone')(Hive, cachedMind);
      cachedMind.instance = drone.meta.id;
      spawnedDrones.push(drone);
    }
    Queen.startStartupDrones(spawnedDrones);
  };

  // if we are starting the drones on hive startup 
  // then start them here
  Queen.startStartupDrones = function(spawnedDrones){
    if(!options.startDronesOnLoad){
      Queen.log("dont start em...");
      return;
    }
    for(let droneIndex in spawnedDrones){
      let drone = spawnedDrones[droneIndex];
      Queen.log('starting drone...',drone.meta.debugName());
      Queen.log("starting drone", drone.meta.debugName());
      drone.start();
    }
  };

  // start a drone with <mind>
  Queen.startDrone = function(args, callback){
    let cachedMindName = Locator.searchMinds(args.mind);
    if(!cachedMindName){
      return callback(`no drone exists by that name ${args.mind}`, false);
    }
    let cachedMind = Cache.drones[cachedMindName];
    if(!cachedMind.instance && !args.options.spawn){
      return callback("drone must be spawned first...", false);
    }
    if(!cachedMind.instance && args.options.spawn){
      return Queen.spawnDrone({mind: args.mind}, function(droneID, didSpawn){
        if(didSpawn){
          let drone = Bees[droneID];
          drone.start();
          return callback(droneID, true);
        }
      });
    }
    // by now we should have weeded out other use cases
    let drone = Bees[cachedMind.instance];
    if(drone.meta.hasStarted){
      return callback("drone has already been started", false);
    }
    drone.start();
    callback(cachedMind.instance, true);
  };

  // start drones with <minds...>
  Queen.startDrones = function(args, callback, cli){
    let startedDrones = [];
    let startingDrones = args.minds;
    if(args.options.all){
      startingDrones = [...Object.keys(Cache.drones)];
    }
    let loop = function(){
      let droneMind = startingDrones.shift();
      if(typeof droneMind === "undefined"){
        Hive.cli.log(`Start drones: ${startedDrones.join(" ")}`);
        return callback(startedDrones);
      }
      let argCopy = require('extend')(true, {}, args);
      argCopy.mind = droneMind;
      Queen.startDrone(argCopy, function(droneID, success){
        if(success){
          startedDrones.push(`${droneMind}:${droneID}`);
        } else {
          Hive.cli.log(droneID);
        }
        loop();
      });
    };
    loop();
  };

  // retire a spawned drone with <mind>
  Queen.retireDrone = function(args, callback){
    let cachedMindName = Locator.searchMinds(args.mind);
    if(!cachedMindName){
      return callback(`no drone exists by that name ${args.mind}`, false);
    }
    let cachedMind = Cache.drones[cachedMindName];
    if(!cachedMind.instance){
      return callback("has not been spawned", false);
    }
    let drone = Bees[cachedMind.instance];
    drone.prepareForRetirement();
    cachedMind.instance = null;
    callback(drone.meta.id, true);
  };

  // retire drones spawned with <minds...>
  Queen.retireDrones = function(args, callback, cli){
    let retiredDrones = [];
    let retiringDrones = args.minds;
    if(args.options.all){
      retiringDrones = [...Object.keys(Cache.drones)];
    }
    let loop = function(){
      let droneMind = retiringDrones.shift();
      if(typeof droneMind === "undefined"){
        Hive.cli.log(`retiring drones: ${retiredDrones.join(" ")}`);
        return callback(retiredDrones);
      }
      let argCopy = require('extend')(true, {}, args);
      argCopy.mind = droneMind;
      Queen.retireDrone(argCopy, function(droneID, success){
        if(success){
          retiredDrones.push(`${droneMind}:${droneID}`);
        } else {
          Hive.cli.log(droneID);
        }
        loop();
      });
    };
    loop();
  };

  // stop a drone from creating new workers with <mind>
  Queen.stopDrone = function(args, callback){
    let cachedMindName = Locator.searchMinds(args.mind);
    if(!cachedMindName){
      return callback(`no drone exists by that name ${args.mind}`, false);
    }
    let cachedMind = Cache.drones[cachedMindName];
    if(!cachedMind.instance && !args.options.spawn){
      return callback("drone must be spawned first...", false);
    }
    let drone = Bees[cachedMind.instance];
    drone.stop();
    callback(drone.meta.id, true);
  };

  // stop drones from creating new workers with <minds...>
  Queen.stopDrones = function(args, callback, cli){
    let stoppedDrones = [];
    let stoppingDrones = args.minds;
    if(args.options.all){
      stoppingDrones = [...Object.keys(Cache.drones)];
    }
    let loop = function(){
      let droneMind = stoppingDrones.shift();
      if(typeof droneMind === "undefined"){
        Hive.cli.log(`stopping drones: ${stoppedDrones.join(" ")}`);
        return callback(stoppedDrones);
      }
      let argCopy = require('extend')(true, {}, args);
      argCopy.mind = droneMind;
      Queen.stopDrone(argCopy, function(droneID, success){
        if(success){
          stoppedDrones.push(`${droneMind}:${droneID}`);
        } else {
          Hive.cli.log(droneID);
        }
        loop();
      });
    };
    loop();
  };

  Queen.nextDroneFire = function(args, callback){
    let cachedMindName = Locator.searchMinds(args.mind);
    if(!cachedMindName){
      return callback(`no drone exists by that name ${args.mind}`, false);
    }
    let cachedMind = Cache.drones[cachedMindName];
    if(!cachedMind.instance && !args.options.spawn){
      return callback("drone must be spawned first...", false);
    }
    let drone = Bees[cachedMind.instance];
    drone.occurences(args, callback);
  };

  Queen.fireDrone = function(args, callback){
    let cachedMindName = Locator.searchMinds(args.mind);
    if(!cachedMindName){
      return callback(`no drone exists by that name ${args.mind}`, false);
    }
    let cachedMind = Cache.drones[cachedMindName];
    if(!cachedMind.instance && !args.options.spawn){
      return callback("drone must be spawned first...", false);
    }
    let drone = Bees[cachedMind.instance];
    drone.fire(args, callback);
  };

};