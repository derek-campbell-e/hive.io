module.exports = function MakeLogger(Module, Options){
  Options = Options || {};

  const fs = require('fs');
  const path = require('path');
  const common = require('./index');

  const logFormatter = require('./logFormatter');
  const stdFormatter = require('./stdFormatter');
 
  let logger = {};

  let logpaths = {};
  let defaultLogFolder = path.join(process.cwd(), "./logs");

  logpaths.stdout = path.join(Options.logFolder || defaultLogFolder, 'stdout.txt');
  logpaths.stderr = path.join(Options.logFolder || defaultLogFolder, 'stderr.txt');
  logpaths.results = path.join(Options.logFolder || defaultLogFolder, 'results.txt');

  if(typeof Module.emit === "undefined"){ Module.emit = function(){} };

  logger.makeLogLine = function(){
    return logFormatter(Module, stdFormatter.apply(Module, arguments))
  };

  logger.makeInternalLogLine = function(){
    return logFormatter(Module, stdFormatter.apply(Module, arguments), true);
  };

  logger.beforeWrite = function(file, callback){
    let dirName = path.dirname(file);
    fs.access(dirName, fs.constants.R_OK | fs.constants.W_OK, function(error){
      if(error){
        return fs.mkdir(dirName, callback);
      }
      callback(null);
    });
  };

  logger.writeLog = function(key, ...logArguments){
    let timestamp = common.timestamp();
    let line = logger.makeLogLine.apply(logger, logArguments);
    let noMetaLine = logger.makeInternalLogLine.apply(logger, logArguments);

    Module.meta[key].push({
      timestamp: timestamp,
      line: noMetaLine
    });

    Module.emit(key, line);

    if(Options.verbose){
      console.log(line);
    }

    trim();
    logger.beforeWrite(logpaths[key], function(error){
      if(!error){
        fs.writeFileSync(logpaths[key], line + "\n", {encoding: 'utf-8', flag: 'a'});
        return;
      }
    });
  };

  logger.lastLogs = function(key, numberOfLastLogs){
    return Module.meta[key].slice(Math.max(Module.meta[key].length - numberOfLastLogs, 0));
  };

 let trim = function(){
    let maxLines =  Module.meta.maxLog || 50;
    let logArrays = ['stdout', 'stderr', 'results'];

    logArrays.forEach(function(logItem){
      let lastLogs = Module.meta[logItem].slice(Math.max(Module.meta[logItem].length - maxLines, 0));
      Module.meta[logItem] = lastLogs;
    });

    return;
  };

  Module.log = logger.writeLog.bind(logger, 'stdout');
  Module.error = logger.writeLog.bind(logger, 'stderr');
  Module.result = logger.writeLog.bind(logger, 'results');;

  Module.logs = logger.lastLogs.bind(logger, 'stdout');
  Module.errors = logger.lastLogs.bind(logger, 'stderr');
  Module.results = logger.lastLogs.bind(logger, 'results');
  
};