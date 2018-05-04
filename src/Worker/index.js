module.exports = function Worker(Hive, Drone, Task, Args){
  // TODO: spawn worker as a node.js fork process

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
    worker.log("finished our task and logging the result");
    worker.result.apply(Drone, results);
    setTimeout(function(){
      worker.log("attempting to retire...");
      worker.prepareForRetirement();
    }, 10000);
  };

  // this function starts our worker with the callback from the Drone class (to delete threads on completion)
  // the worker will start the task, and then run its own callback
  worker.start = function(callback){
    worker.log("running our task...");
    worker.meta.hasStarted = true;
    callback = callback || function(){};
    // well add additional arguments for emitted events
    try {
      Task.apply(Drone, [...Args, function(){
        callback.apply(worker, arguments);
        worker.completionCallback.apply(worker, arguments);
      }]);
    } catch(error) {
      worker.error("An error occured running task:", error, 'Stack:', error.stack);
      callback.apply(worker, [error]);
      worker.completionCallback.apply(worker, [error]);
    }
  };

  // our initializer
  let init = function(){
    worker.spawn();
    return worker;
  };

  return init();
};