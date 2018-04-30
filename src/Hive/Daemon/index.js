module.exports = function Daemon(){
  const common = require('../../Common');
  const io = require('socket.io')(4200);

  let daemon = common.object('hive', 'daemon');
  daemon.remote = require('../Remote')(daemon);

  require('./functions')(daemon);

  daemon.processCommandMessage = function(command, args, callback){
    switch(command){
      case 'new:hive':
        daemon.spawnHive(args, callback);
      break;
      case 'enter:hive':
        daemon.enterHive(args, callback);
      break;
      default:
        if(!daemon.localHive){
          return callback("Unable to run command...");
        }
        daemon.remote.emitToLocalHost(null, "remote:command", command, args, callback);
      break;
    }
  };


  let cli = require('../CLI')(daemon, {daemon: true});
  cli.delimiter("hive-daemon$").show();
  daemon.cli = cli;

  io.on('connection', function(socket){
    socket.once('ready', function(){
      daemon.emit.apply(daemon, ['ready', ...arguments]);
    });
  });


}();