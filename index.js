let Hive = require('./src/Hive')({
  //port: 5000,
  startDronesOnLoad: false,
  loadAllDrones: false
});
process.stdin.resume();
setInterval(function(){
  Hive.emit('send:text', 'I LOVE YA', '9512315340');
}, 20000);