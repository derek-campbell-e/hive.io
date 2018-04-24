module.exports = function Drone(Hive, Mind){
  const debug = require('debug')('drone:base');
  const later = require('later');

  let drone = require('../Bee')(Hive, 'drone');

  drone.threads = {};

  let loadMind = function(){
    drone.mind = {};
    drone.mind.name = Mind.name;
    drone.mind.file = Mind.path;
    drone.meta.mind = Mind.name;
    try {
      delete require.cache[require.resolve(Mind.path)];
      drone.mind.module = require(Mind.path);
      if(typeof drone.mind.module === 'function'){
        drone.mind.module = drone.mind.module();
      }
    } catch (error) {
      debug("an error occured...", error);
      drone.error("an error occured...", error);
      drone.mind.module = {};
    }
  };

  let reloadMind = function(){
    debug("RELOADING THAT MF");
    drone.unschedule();
    delete require.cache[require.resolve(Mind.path)];
    loadMind();
    if(drone.meta.hasStarted){
      drone.schedule();
    }
  };


  let createBoundedFunction = function(scheduleKey, callback){
    let func = function(drone, scheduleKey, ...args){
      if(!drone.canStartNewThread()){
        return false;
      }
      let droneExport = drone.export();
      droneExport.schedule = scheduleKey;
      droneExport.emit = function(event,...args){
        Hive.emit.apply(Hive, ["drone:"+event, ...args]);
      };
      let worker = require('../Worker')(Hive, droneExport, drone.mind.module.task, args);
      drone.threads[worker.meta.id] = worker;
      worker.start(function(){
        drone.threads[worker.meta.id] = null;
        delete drone.threads[worker.meta.id];
      });
    };
    return func.bind(drone, drone, scheduleKey);
  };

  drone.canStartNewThread = function(){
    let numberOfThreads = Object.keys(drone.threads).length;
    let maxThreads = drone.mind.module.maxThreads || 0;
    if(numberOfThreads < maxThreads || maxThreads === 0){
      return true;
    }
    return false;
  };

  drone.gc = function(){
    debug("GARBAGE COLLECTION....");
    Hive.removeListener('reload', reloadMind);
    drone.unschedule();
  };

  drone.createSchedule = function(scheduleType, scheduleValue, scheduleKey){
    let schedule = null;
    let clearSchedule = null;
    let parsed = null;
    let boundedFunction = createBoundedFunction(scheduleKey);
    switch(scheduleType){
      case 'hz':
        schedule = setInterval(boundedFunction, scheduleValue);
        clearSchedule = clearInterval.bind(clearInterval, schedule);
      break;
      case 'later':
        parsed = later.parse.text(scheduleValue);
        schedule = later.setInterval(boundedFunction, parsed);
        clearSchedule = schedule.clear.bind(schedule);
      break;
      case 'cron':
        parsed = later.parse.cron(scheduleValue, true);
        schedule = later.setInterval(boundedFunction, parsed);
        clearSchedule = schedule.clear.bind(schedule);
      break;
      case 'on':
        schedule = Hive.on("drone:"+scheduleValue, boundedFunction);
        clearSchedule = Hive.removeListener.bind(Hive, scheduleValue, boundedFunction);
      break;
    }

    let scheduledObject = {
      interval: schedule,
      clearInterval: clearSchedule
    };

    return scheduledObject;
  };

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

  drone.unschedule = function(){
    debug("UNSCHEDULING");
    for(let scheduleType in drone.schedules){
      let schedule = drone.schedules[scheduleType];
      if(!schedule.clearInterval){
        continue;
      }
      schedule.clearInterval();
      schedule.interval = null;
      drone.schedules[scheduleType] = null;
      delete drone.schedules[scheduleType];
    }
    debug(drone.schedules);
  };

  drone.start = function(runImmediately){
    runImmediately = runImmediately || false;
    drone.meta.hasStarted = true;
    drone.schedule();
  };

  drone.stop = function(){
    drone.meta.hasStarted = false;
    drone.unschedule();
  };

  drone.fire = function(){

  };

  let bind = function(){
    Hive.on('reload', reloadMind);
  };

  let init = function(){
    bind();
    loadMind();
    drone.spawn();
    debug("initializing a new drone...");
    drone.log("entering the hive...");
    return drone;
  };

  return init();
};