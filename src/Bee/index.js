module.exports = function Bee(Hive, Class, Mind){
  // our includes
  const common = require('../Common');
  
  // our bee object
  let bee = common.object(Class || 'bee', Mind || "default");
  const debug = require('debug')(bee.meta.debugName());

  // setting bee-specific data
  bee.meta.hasStarted = false;

  // our spawn function, we update our meta, and tell the hive that we spawned
  bee.spawn = function(){
    bee.meta.spawnedAt = common.timestamp();
    bind();
    Hive.didSpawnBee(bee);
  };
  
  // our retire function, we remove listeners and tell the hive that we retired
  bee.retire = function(){
    Hive.removeListener('gc', prepareForRetirement);
    Hive.didRetireBee(bee);
    bee = null;
  };

  // our garbage collection function
  // each bee should impliment this
  bee.gc = function(){

  };

  // our export function, returns the bee meta
  bee.export = function(){
    return require('extend')(true, {}, bee.meta);
  };

  // our function to garbage collect and then retire the bee safely
  bee.prepareForRetirement = function(debugName){
    try {
      bee.gc();
      bee.retire();
    } catch(error) {
      Hive.error("An error occured during prep for retirement", error, debugName);
    }
  };

  // our private retirement function, we bind this to the hive's "gc" event
  let prepareForRetirement = function(debugName){
    if(bee){
      return bee.prepareForRetirement(debugName);
    } else {
      debug("NO LONGER HERE");
    }
  };

  // function where we listen to hive events
  let bind = function(){
    Hive.once('gc', prepareForRetirement.bind(bee, bee.meta.debugName()));
  };

  // our initializer
  let init = function(){
    return bee;
  };

  return init();
};