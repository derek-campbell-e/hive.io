module.exports = function Worker(Hive, Drone, Task, Args){
  // our worker mind name is based off the drone it will be spawned from
  // and the schedule it is running on
  let mindName = Drone.mind + "<" + Drone.schedule + ">";

  // our debug object if needed
  const debug = require('debug')('worker:' + mindName);

  // the returned worker object
  let worker = require('../Bee')(Hive, 'worker', mindName);

  // this function is our completion callback after the drone's task has been completed
  // we log our results, and then retire the worker after 10 seconds
  worker.completionCallback = function(...results){
    worker.meta.hasStarted = false;
    worker.result.apply(Drone, results);
    setTimeout(function(){
      worker.log("attempting to retire...");
      worker.prepareForRetirement();
    }, 10000);
  };

  // this function starts our worker with the callback from the Drone class (to delete threads on completion)
  // the worker will start the task, and then run its own callback
  worker.start = function(callback){
    worker.meta.hasStarted = true;
    callback = callback || function(){};
    // well add additional arguments for emitted events
    Task.apply(Drone, [...Args, function(){
      callback.apply(worker, arguments);
      worker.completionCallback.apply(worker, arguments);
    }]);
  };

  // our initializer
  let init = function(){
    worker.spawn();
    return worker;
  };

  return init();
};