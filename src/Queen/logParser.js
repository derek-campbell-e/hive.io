module.exports = function LogParser(logPath, args, callback){
  const fs = require('fs');
  
  let routine = function(logs){
    let logData = [];
    let split = logs.split("\n");
    for(let lineIndex in split){
      let line = split[lineIndex];
      let validLogLine = line.split(" ").length > 4;
      if(!validLogLine){
        continue;
      }
      let fields = line.split(" ");
      let id = fields[0];
      let object = fields[1];
      let timestamp = fields[2].replace(/\[|\]/g, '');
      let logline = line.split(" ").slice(5).join(" ");

      if(args.object){
        if(args.object === id || args.object === object || args.object === object.split(":")[0] || (new RegExp(args.object, 'i').test(object))){
          //logData += logline + '\n';
          logData.push(`${timestamp}
\t${id} ${object} ${logline}`);
        } else {
          continue;
        }
      } else {
        //logData += line + '\n';
        logData.push(line);
      }
    }
    return logData.join("\n");
  };

  fs.readFile(logPath, function(error, data){
    if(error){
      return callback(error);
    }
    let logs = data.toString('utf8');
    let returnedLogs = routine(logs);
    callback(returnedLogs);
  });

};