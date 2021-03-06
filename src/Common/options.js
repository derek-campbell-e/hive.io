module.exports = function Options(overrides){
  overrides = overrides || {};
  const path = require('path');
  const processArgs = require('vorpal')().parse(process.argv, {use: 'minimist'});
  let options = {};
  options.port = process.env.PORT || processArgs['port']  || overrides.port || 4204;
  options.loadAllDrones = true;
  options.startDronesOnLoad = true;
  options.loadDrones = overrides.loadDrones || [];
  options.startDrones = overrides.startDrones || [];
  options.beeFolder = path.join(process.cwd(), 'bees');
  options.droneFolder = path.join(process.cwd(), 'drones');
  options.logFolder = path.join(process.cwd(), 'logs');
  options.maxTaskRuntime = 60 * 1000 * 2;
  options.verbose = processArgs['show-logs'] || overrides['verbose'] || false;
  options.detached = processArgs['detached'] || false;
  options.daemon = processArgs['daemon'] || 4200;
  options.daemonMode = false;
  options = require('extend')(true, {}, options, overrides);
  return options;
};