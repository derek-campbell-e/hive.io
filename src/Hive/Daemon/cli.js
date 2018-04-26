module.exports = function CLI(Hive){
  // our includes
  const vorpal = require('vorpal')();
  let delimiter = `hive-daemon$`;
  let numberOfLoginAttempts = 0;

  // our functions module
  //let functions = require('./functions')(vorpal, Hive);

  let functions = {};
  functions.emitter = function(event){
    let handler = function(args, callback){
      Hive.processCommandMessage(event, args, callback);
    };
    return handler;
  };

  vorpal.delimiter(delimiter).show();

  vorpal
    .command("new hive [directory]")
    .action(functions.emitter('new:hive'));
  
  vorpal.command("stats").action(functions.emitter('stats'));

  vorpal
    .command("spawn drone <mind>")
    .description("spawn a drone with <mind>")
    .option('-s, --start', 'start drone once loaded')
    .option('-n, --now', 'fire drone now, (must be loaded)')
    .action(functions.emitter('spawn:drone'));
  
  vorpal
    .command("spawn drones [minds...]")
    .description("spawn a drone with <mind>")
    .option('-s, --start', 'start drone once loaded')
    .option('-a, --all', 'spawn all drones found by the queen')
    .option('-n, --now', 'fire drone now, (must be loaded)')
    .action(functions.emitter('spawn:drones'));
  
  vorpal
    .command("start drone <mind>")
    .description("start drone with <mind>, must be spawned or use -s option")
    .option('-s, --spawn', 'spawn the drone if not spawned already')
    .option('-n, --now', 'fire drone now, (must be loaded)')
    .action(functions.emitter('start:drone'));
  
  vorpal
    .command("start drones [minds...]")
    .description("start drones with <mind>, must be spawned or use -s option")
    .option('-s, --spawn', 'spawn the drones if not spawned already')
    .option('-n, --now', 'fire drones now, (must be loaded)')
    .option('-a, --all', 'start all drones found by the queen')
    .action(functions.emitter('start:drones'));
  
  vorpal
    .command("stop drone <mind>")
    .description("stop drone with <mind>")
    .action(functions.emitter('stop:drone'));
  
  vorpal
    .command("stop drones [minds...]")
    .description("stop drone with <mind>")
    .option('-a, --all', 'stop all drones found by the queen')
    .action(functions.emitter('stop:drones'));

  vorpal
    .command("fire drone <mind>")
    .description("run a drone immediately")
    .action(functions.emitter('fire:drone'));
  
  vorpal
    .command("retire drone <mind>")
    .description("retire drone with <mind>")
    .action(functions.emitter('retire:drone'));
  
  vorpal
    .command("retire drones [minds...]")
    .description("retire drone with <mind>")
    .option('-a, --all', 'retire all drones found by the queen')
    .action(functions.emitter('retire:drones'));
  
  vorpal
    .command("next <mind> [number]")
    .description("show the next fire times for <drone>")
    .action(functions.emitter('next:drone'))
  
  vorpal
    .command("reload")
    .description("reload the hive!")
    .action(functions.emitter('reload'));
  
  vorpal
    .command("ls drones")
    .description("show drones found/cached")
    .action(functions.emitter('ls:drones'));
  
  vorpal
    .command("xrem")
    .description("exit the remote session")
    .action(functions.disconnectRemoteHostCLI);
  
  vorpal
    .command("remote <host>")
    .description("remote into a host!")
    .action(functions.remoteIntoHive);
  
  vorpal
    .command("repl <host>")
    .description("replicate drones and settings to another hive")
    .action(functions.replicateIntoHive);
  
  vorpal.find("exit").remove();

  vorpal
    .command("exit")
    .action(function(args, cb){
      try {
        process.send('exit');
      } catch(error){
        Hive.error(error);
      }
      cb();
    });

  return vorpal;
};