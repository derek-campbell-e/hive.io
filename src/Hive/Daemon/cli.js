module.exports = function CLI(Daemon){
  const common = require('../../Common');
  let cli = common.object('daemon', 'cli');
  const vorpal = require('vorpal')();
 

  let requestHandler = function(event){
    let handler = function(args, callback){
      const self = this;
      Daemon.processRequest.call(self, event, args, callback);
    };
    return handler;
  };


  // functions for detached hive instance
  vorpal
    .command("logs [object]")
    .option('-t, --tail <num>', 'tail <number> of logs')
    .option('-i, --id <id>', 'specify hive id')
    .description("show the logs for [object] or show all logs")
    .action(requestHandler('show:logs'));

  vorpal
    .command("errors [object]")
    .option('-t, --tail <num>', 'tail <number> of logs')
    .option('-i, --id <id>', 'specify hive id')
    .description("show the logs for [object] or show all logs")
    .action(requestHandler('show:errors'));

  vorpal
    .command("results [object]")
    .option('-t, --tail <num>', 'tail <number> of logs')
    .option('-i, --id <id>', 'specify hive id')
    .description("show the logs for [object] or show all logs")
    .action(requestHandler('show:results'));

  vorpal
    .command("stats")
    .option('-i, --id <id>', 'specify hive id')
    .action(requestHandler('stats'));

  vorpal
    .command("spawn drone <mind>")
    .description("spawn a drone with <mind>")
    .option('-i, --id <id>', 'specify hive id')
    .option('-s, --start', 'start drone once loaded')
    .option('-n, --now', 'fire drone now, (must be loaded)')
    .action(requestHandler('spawn:drone'));
  
  vorpal
    .command("spawn drones [minds...]")
    .description("spawn a drone with <mind>")
    .option('-i, --id <id>', 'specify hive id')
    .option('-s, --start', 'start drone once loaded')
    .option('-a, --all', 'spawn all drones found by the queen')
    .option('-n, --now', 'fire drone now, (must be loaded)')
    .action(requestHandler('spawn:drones'));
  
  vorpal
    .command("start drone <mind>")
    .description("start drone with <mind>, must be spawned or use -s option")
    .option('-i, --id <id>', 'specify hive id')
    .option('-s, --spawn', 'spawn the drone if not spawned already')
    .option('-n, --now', 'fire drone now, (must be loaded)')
    .action(requestHandler('start:drone'));
  
  vorpal
    .command("start drones [minds...]")
    .description("start drones with <mind>, must be spawned or use -s option")
    .option('-i, --id <id>', 'specify hive id')
    .option('-s, --spawn', 'spawn the drones if not spawned already')
    .option('-n, --now', 'fire drones now, (must be loaded)')
    .option('-a, --all', 'start all drones found by the queen')
    .action(requestHandler('start:drones'));
  
  vorpal
    .command("stop drone <mind>")
    .option('-i, --id <id>', 'specify hive id')
    .description("stop drone with <mind>")
    .action(requestHandler('stop:drone'));
  
  vorpal
    .command("stop drones [minds...]")
    .option('-i, --id <id>', 'specify hive id')
    .description("stop drone with <mind>")
    .option('-a, --all', 'stop all drones found by the queen')
    .action(requestHandler('stop:drones'));

  vorpal
    .command("fire drone <mind> [args...]")
    .option('-i, --id <id>', 'specify hive id')
    .description("run a drone immediately")
    .action(requestHandler('fire:drone'));
  
  vorpal
    .command("retire drone <mind>")
    .option('-i, --id <id>', 'specify hive id')
    .description("retire drone with <mind>")
    .action(requestHandler('retire:drone'));
  
  vorpal
    .command("retire drones [minds...]")
    .option('-i, --id <id>', 'specify hive id')
    .description("retire drone with <mind>")
    .option('-a, --all', 'retire all drones found by the queen')
    .action(requestHandler('retire:drones'));
  
  vorpal
    .command("next <drone> [number]")
    .description("show the next fire times for <drone>")
    .action(requestHandler('next:drone'));
  
  vorpal
    .command("reload")
    .option('-i, --id <id>', 'specify hive id')
    .description("reload the hive!")
    .action(requestHandler('reload'));
  
  vorpal
    .command("ls drones")
    .option('-i, --id <id>', 'specify hive id')
    .description("show drones found/cached")
    .action(requestHandler('ls:drones'));

  vorpal
    .command("link <host>")
    .option('-i, --id <id>', 'specify hive id')
    .description("link this hive to another hive instance")
    .option('-b, --bi', 'use this flag for bi-directional communication, default is one-way [linkee blasts to linked only]')
    .action(requestHandler('link:hive'));

  vorpal
    .command("blast <event> [args...]")
    .option('-i, --id <id>', 'specify hive id')
    .description("blast a message from this hive to all hives connected")
    .action(requestHandler('blast:message'))

  
  // functions to create / modify / destroy hive instances
  vorpal
    .command("new [directory]")
    .description("create a new hive in [directory] or cwd")
    .option('-p, --port <port>', 'port to run the new hive on')
    .action(function(args, callback){
      let cli = this;
      let promptQuestions = [];
      let usernamePrompt = {
        type: 'input',
        name: 'username',
        message: 'Please enter username: ',
      };
  
      let passwordPrompt = {
        type: 'password',
        name: 'password',
        message: 'Please enter password: '
      };
  
      if(!args.password){
        promptQuestions.push(passwordPrompt);
      }
      if(!args.username){
        promptQuestions.unshift(usernamePrompt);
      }
      
      cli.prompt(promptQuestions, function(result){
        let username = result.username || args.username || false;
        let password = result.password || args.password || false;
        args.username = username;
        args.password = password;
        Daemon.spawnHive.call(cli, args, callback);
      });
    });

  vorpal
    .command("enter [directory]")
    .option('-i, --id <id>', 'the hive\'s id (directory is ignored)')
    .description("enter the hive of a [directory] or cwd or hiveID")
    .action(Daemon.enterHive);
  
  vorpal
    .catch('[words...]')
    .action(function(args, callback){
      this.log(args.words.join(" ")+ " is not a valid command");
      callback();
    });
  
  vorpal
    .command("ls hives")
    .description("show all active hives")
    .action(Daemon.listActiveHives);

  vorpal.find("exit").remove();

  vorpal
    .command("exit")
    .description("exit active hive")
    .action(Daemon.exitHive);

  cli.on('delimiter', function(delimiter, callback){
    callback = callback || function(){};
    vorpal.delimiter(delimiter).show();
    callback();
  });

  cli.vorpal = vorpal;

  return cli;

};