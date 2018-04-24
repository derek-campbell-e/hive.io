module.exports = function Bee(Hive, Class, Mind){
  const common = require('../Common');
  let bee = common.object(Class || 'bee', Mind || "default");
  const debug = require('debug')(bee.meta.debugName());

  bee.schedules = {};
  bee.meta.hasStarted = false;

  bee.spawn = function(){
    bee.meta.spawnedAt = common.timestamp();
    bind();
    Hive.didSpawnBee(bee);
  };
  
  bee.retire = function(){
    bee.schedules = {};
    Hive.removeListener('gc', prepareForRetirement);
    Hive.didRetireBee(bee);
    bee = null;
  };

  bee.gc = function(){

  };

  bee.export = function(){
    return require('extend')(true, {}, bee.meta);
  };

  bee.prepareForRetirement = function(){
    bee.gc();
    bee.retire();
  };

  let prepareForRetirement = function(){
    if(bee){
      return bee.prepareForRetirement();
    } else {
      debug("NO LONGER HERE");
    }
  };

  let bind = function(){
    Hive.once('gc', prepareForRetirement);
  };

  let init = function(){
    return bee;
  };

  return init();
};