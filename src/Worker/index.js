module.exports = function Worker(Hive, Drone, Task, Args){

  
  let mindName = Drone.mind + "<" + Drone.schedule + ">";
  const debug = require('debug')('worker:' + mindName);

  let worker = require('../Bee')(Hive, 'worker', mindName);

  worker.completionCallback = function(...results){
    worker.meta.hasStarted = false;
    worker.result.apply(Drone, results);
    setTimeout(function(){
      worker.prepareForRetirement();
    }, 10000);
  };

  worker.start = function(callback){
    worker.meta.hasStarted = true;
    callback = callback || function(){};
    Task.apply(Drone, [...Args, function(){
      callback.apply(worker, arguments);
      worker.completionCallback.apply(worker, arguments);
    }]);
  };

  let init = function(){
    worker.spawn();
    return worker;
  };

  return init();
};