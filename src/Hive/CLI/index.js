module.exports = function CLI(Hive, Options){
  Options = Options || {};
  // our includes
  const vorpal = require('vorpal')();
  let delimiter = `hive.io$`;
  

  // our functions module
  let functions = require('./functions')(vorpal, Hive);

  vorpal
    .command("logs [object]")
    .option('-t, --tail <num>', 'tail <number> of logs')
    .description("show the logs for [object] or show all logs")
    .action(functions.emitter('show:logs'));

  vorpal
    .command("errors [object]")
    .option('-t, --tail <num>', 'tail <number> of logs')
    .description("show the logs for [object] or show all logs")
    .action(functions.emitter('show:errors'));

  vorpal
    .command("results [object]")
    .option('-t, --tail <num>', 'tail <number> of logs')
    .description("show the logs for [object] or show all logs")
    .action(functions.emitter('show:results'));
  
  vorpal
    .command("stats")
    .action(functions.emitter('stats'));

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
    .command("fire drone <mind> [args...]")
    .option('-s, --schedule <schedule>', 'fire a particular schedule [fire] is default')
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
    .command("next <drone> [number]")
    .description("show the next fire times for <drone>")
    .action(functions.emitter('next:drone'));
  
  vorpal
    .command("reload")
    .description("reload the hive!")
    .action(functions.emitter('reload'));
  
  vorpal
    .command("ls drones")
    .description("show drones found/cached")
    .action(functions.emitter('ls:drones'));

  vorpal
    .command("ls network")
    .description("show hives that are linekd in our network")
    .action(functions.emitter('ls:network'));
  
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

  vorpal
    .command("link <host>")
    .description("link this hive to another hive instance")
    .option('-b, --bi', 'use this flag for bi-directional communication, default is one-way [linkee blasts to linked only]')
    .action(functions.emitter('link:hive'));
  
  vorpal
    .command("emit <droneEvent> [args...]")
    .description("emit a drone event message with args")
    .action(functions.emitter('emit:drone'));

  vorpal
    .command("blast <event> [args...]")
    .description("blast a message from this hive to all hives connected")
    .action(functions.emitter('blast:message'))
  
  vorpal.find("exit").remove();

  vorpal
    .command("exit")
    .action(functions.emitter('exit:hive'));
  

  vorpal.delimiter(delimiter).show();
  

  return vorpal;
};