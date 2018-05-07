module.exports = function Drone(Hive, Mind){
  // our includes
  const common = require('../Common');
  const debug = require('debug')('drone:base');
  const later = require('later');
  later.date.localTime();

  // the returned drone object
  let drone = require('../Bee')(Hive, 'drone');

  // our schedules object
  drone.schedules = {};

  // holds the workers that have been spawned due to scheduling
  // we also use this to decide if we should start a new worker
  drone.threads = {};

  // private function to load the mind from the file
  // we want the file to be the fresh require
  let loadMind = function(){
    drone.mind = {};
    drone.mind.name = Mind.name;
    drone.mind.file = Mind.path;
    drone.meta.mind = Mind.name;
    try {
      delete require.cache[require.resolve(Mind.path)];
      drone.mind.module = require(Mind.path);
      // if mind file is in the form of a function, lets execute it
      if(typeof drone.mind.module === 'function'){
        drone.mind.module = drone.mind.module();
      }
    } catch (error) {
      debug("an error occured...", error);
      drone.error("an error occured...", error);
      drone.mind.module = {};
    }
  };

  // private function to reload the mind and restart the drone if already started
  let reloadMind = function(){
    debug("RELOADING THAT MF");
    drone.unschedule();
    delete require.cache[require.resolve(Mind.path)];
    loadMind();
    if(drone.meta.hasStarted){
      drone.schedule();
    }
  };

  // private function that gets bound to a timer, this gets executed when a timer fires
  let spawnWorkerRoutine = function(scheduleKey, callback){
    callback = callback || function(){};
    // the function to return
    let spawnWorker = function(drone, scheduleKey, callback, ...args){
      if(!drone.canStartNewThread()){
        return false;
      }
      // what the "this" in the drone task refers to
      let droneExport = drone.export();
      droneExport.schedule = scheduleKey;
      // we want to be able to emit events to the hive
      droneExport.emit = function(event,...args){
        Hive.emit.apply(Hive, ["drone:"+event, ...args]);
      };
      // create the worker 
      let worker = require('../Worker')(Hive, droneExport, drone.mind.module.task, args);

      drone.log("spawning worker", worker.meta.debugName());

      // add the worker to our threads
      drone.threads[worker.meta.id] = worker;

      // our boolean for if a task has completed
      let hasTaskFinished = false;

      // start the worker and when finished, delete the thread
      worker.start(function(){
        hasTaskFinished = true;
        drone.log("worker", worker.meta.debugName(), "has finished it's task");
        drone.threads[worker.meta.id] = null;
        delete drone.threads[worker.meta.id];
        callback.apply(callback, arguments);
      });

      // create a timer for maxRunTime and if we have not finished the task normally, perform alt actions
      setTimeout(function(){
        if(!hasTaskFinished){
          drone.log("our worker:", worker.meta.debugName(), "has not finished it's task, so time to retire it manually");
          drone.threads[worker.meta.id] = null;
          delete drone.threads[worker.meta.id];
          worker.prepareForRetirement();
          callback.apply(callback, arguments);
        }
      }, options.maxTaskRuntime);

    };
    // return this function with the proper stuff bound to it
    return spawnWorker.bind(drone, drone, scheduleKey, callback);
  };

  let formatLaterTime = function(time){
    return require('moment')(time).format(common.timeformat);
  };

  // function to decide if we should start a new thread
  // to set max threads, in the drone mind, create a property of 
  // mind.maxThreads = [Int]
  drone.canStartNewThread = function(){
    let numberOfThreads = Object.keys(drone.threads).length;
    let maxThreads = drone.mind.module.maxThreads || 0;
    if(numberOfThreads < maxThreads || maxThreads === 0){
      return true;
    }
    return false;
  };

  // the drone's garbage collection function
  // run when we emit the 'gc' event from the hive, or when drone retires
  drone.gc = function(){
    debug("GARBAGE COLLECTION....");
    Hive.removeListener('reload', reloadMind);
    drone.unschedule();
  };

  // returns a json with the next occurrences that the drone will fire
  // change number of occurrences with args.number
  drone.occurences = function(args, callback){
    callback = callback || function(){};
    let json = {};
    args.number = parseInt(args.number) || 1;
    for(let scheduleKey in drone.schedules){
      let schedule = drone.schedules[scheduleKey];
      let meta = {};
      switch(schedule.type){
        case 'on':
          meta.next = ['indeterminate'];
        break;
        default:
          let occur = null;
          try {
            occur = later.schedule(schedule.parsed).next(args.number);
          } catch (error){
            drone.log("an error occured parsing occurences", error);
            continue;
          }

          if(!Array.isArray(occur)){
            occur = [occur];
          }
          try {
            meta.next = [...occur];
            for(let index in meta.next){
              let next = meta.next[index];
              meta.next[index] = formatLaterTime(next);
            }
          } catch (error){
            meta.next = [];
            drone.error(error);
          }
        break;

      }
      json[scheduleKey] = meta;
    }
    callback(json);
    return json;
  };

  // our function to create the timers that fire our function that creates a worker
  // we can use different types of timers for our needs
  // hz: run every [Int] seconds
  // later: run on a text-based schedule via later: http://bunkat.github.io/later/parsers.html#text
  // cron: run on a cron schedule via later: http://bunkat.github.io/later/parsers.html#cron (seconds included)
  // on: run when the hive emits the specified event ("drone:"+[your event name])
  // we also include the function to remove the schedule in our returned object
  drone.createSchedule = function(scheduleType, scheduleValue, scheduleKey){
    drone.log("creating schedule of type:", scheduleType, "with value:", scheduleValue, "using schedule key:", scheduleKey ||  "none");
    let schedule = null;
    let clearSchedule = null;
    let parsed = null;
    let boundedFunction = spawnWorkerRoutine(scheduleKey);
    switch(scheduleType){
      case 'hz':
        parsed = later.parse.recur().every(scheduleValue).second();
        schedule = later.setInterval(boundedFunction, parsed);
        clearSchedule = schedule.clear.bind(schedule);
      break;
      case 'later':
        parsed = later.parse.text(scheduleValue);
        if(parsed.error > -1){
          drone.error("an error occured creating text-based schedule", scheduleValue, 'on char', parsed.error);
        }
        schedule = later.setInterval(boundedFunction, parsed);
        clearSchedule = schedule.clear.bind(schedule);
      break;
      case 'cron':
        parsed = later.parse.cron(scheduleValue, true);
        schedule = later.setInterval(boundedFunction, parsed);
        clearSchedule = schedule.clear.bind(schedule);
      break;
      case 'on':
        let emitKey = "drone:"+scheduleValue;
        schedule = Hive.on(emitKey, boundedFunction);
        clearSchedule = Hive.removeListener.bind(Hive, emitKey, boundedFunction);
      break;
    }
    let scheduledObject = {
      type: scheduleType,
      interval: schedule,
      clearInterval: clearSchedule,
      parsed: parsed,
    };
    return scheduledObject;
  };

  // this function runs through the schedules variable in the drone mind provided
  // and creates the timers/schedules for each type
  drone.schedule = function(){
    for(let scheduleType in drone.mind.module.schedules){
      let scheduleMeta = drone.mind.module.schedules[scheduleType];
      if(scheduleMeta !== null && typeof scheduleMeta === 'object'){
        for(let key in scheduleMeta){
          let scheduleKey = scheduleType + ":" + key;
          let schedule = drone.createSchedule(scheduleType, scheduleMeta[key], scheduleKey);
          drone.schedules[scheduleKey] = schedule;
        }
        continue;
      }
      let schedule = drone.createSchedule(scheduleType, drone.mind.module.schedules[scheduleType], scheduleType);
      drone.schedules[scheduleType] = schedule;
    }
  };

  // this function goes through all of the schedules and clears them
  // TODO: single/multiple schedule clearing
  drone.unschedule = function(){
    debug("UNSCHEDULING");
    for(let scheduleType in drone.schedules){
      let schedule = drone.schedules[scheduleType];
      if(!schedule.clearInterval){
        drone.log("unable to clear schedule:", scheduleType);
        continue;
      }
      schedule.clearInterval();
      schedule.interval = null;
      drone.schedules[scheduleType] = null;
      delete drone.schedules[scheduleType];
    }
    debug(drone.schedules);
  };

  // this starts the drone by creating the schedules and letting them run on their own time
  // TODO: run immediately by running the task when started
  drone.start = function(runImmediately){
    drone.log("starting our schedules...");
    runImmediately = runImmediately || false;
    drone.meta.hasStarted = true;
    drone.schedule();
  };

  // this function stops the drone from creating new workers by unscheduling
  // TODO: stop all active workers on stop if desired
  drone.stop = function(){
    drone.log("stopping all schedules");
    drone.meta.hasStarted = false;
    drone.unschedule();
  };

  // this function should run the drone immediately returning the worker's result
  // the schedule type is "fire"
  // TODO: option to change schedule to custom
  drone.fire = function(args, callback){
    let schedule = args.options.schedule || 'fire';
    drone.log("firing drone immediately...");
    let boundedFunction = spawnWorkerRoutine(schedule, function(){
      let json = {
        drone: drone.export(),
        result: common.stdFormatter.apply(common, arguments)
      };
      callback(json);
    });
    boundedFunction.call();
  };


  drone.export = function(){
    let meta = require('extend')(true, {}, drone.meta);
    meta.occurences = drone.occurences({number: 5});
    return meta;
  };

  // our binding function to listen to events
  let bind = function(){
    Hive.on('reload', reloadMind);
  };

  // our initializer
  let init = function(){
    bind();
    loadMind();
    drone.log("initializing...");
    drone.spawn();
    return drone;
  };

  return init();
};