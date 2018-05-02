module.exports = function MkBin(){
  const path = require('path');
  const fs = require('fs');
  const binPath = path.join(__dirname, '../../../', '.bin');
  const hivesPath = path.join(binPath, 'hives.json');
  const baseHiveData = JSON.stringify({}, null, 2);
  console.log(binPath);
  fs.mkdir(binPath, function(error){
    fs.writeFile(hivesPath, baseHiveData, {mode: '777'}, function(error){
      console.log("create file error:", error);
      fs.chmod(hivesPath, '777', function(error){
        console.log("chmod error:", error);
      });
    });
  });

}();