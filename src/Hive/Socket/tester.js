const debug = require('debug')('tester');
const remoteIO = require('socket.io-client');
const io = require('socket.io')(8000);


let socket = remoteIO("http://localhost:5000/");
socket.on('connect', function(){
  debug("WE ARE CONNECTED");
  socket.emit('stats', function(json){
    debug(json);
  });
  socket.emit("remote:command", "start drones -a -s", function(output){
    debug(output);
  });
});

