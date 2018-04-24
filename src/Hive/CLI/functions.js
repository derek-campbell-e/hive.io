module.exports = function CliFunctions(Cli, Hive){
  // our important data
  let delimiter = "hive:0.0.1$";
  const Vorpal = Cli;
  let functions = {};

  // function to create an authentication prompt
  // we first ping our host to see if we can access it,
  // if we can, then run through username and password questions
  // after the auth process from the Hive.Remote module, we'll run the callback
  functions.authenticationPrompt = function(args, callback){
    const self = this;
    args.host = "http://localhost:5000";
    Hive.remote.ping(args.host, function(canConnect){
      if(!canConnect){
        callback("unable to connect to host");
        return;
      }
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
      
      self.prompt(promptQuestions, function(result){
        let username = result.username || args.username || false;
        let password = result.password || args.password || false;
        Hive.remote.authenticate.call(self, args.host, username, password, functions.remoteAuthenticationCallback.bind(self, args, callback));
      });
    });
  };


  // our function to remote into a hive elsewhere
  // we go through the username/password prompt and after authentication, we'll switch into remote mode
  functions.remoteIntoHive = function(args, callback){
    functions.authenticationPrompt.call(this, args, function(error, host){
      if(!error){
        Hive.log("this was called after authnetication");
        Vorpal.delimiter(`hive@${host}$`).show();
        return callback();
      }
      callback(error);
    });
  };

  // our function to replicate local hive data to a remote hive
  // we go through auth process and on success, begin the replication process
  functions.replicateIntoHive = function(args, callback){
    functions.authenticationPrompt.call(this, args, function(error, host, socket){
      if(!error){
        Hive.log("this was called after authnetication");
        let replicator = require('../Replicate')(Hive, socket);
        return replicator.commenceReplication(args, callback);
      }
    });
  };

  // our callback for remote authentication, here we can log important data or rerun authentication
  functions.remoteAuthenticationCallback = function(originalArgs, callback, socketStatus, host, socket){
    const self = this;
    switch(socketStatus.code){
      case 200:
        Vorpal.log("successfully connected to remote hive!");
        return callback(null, host, socket);
      break;
      case 300:
      case 301:
      case 302:
        Vorpal.log("unable to connect to host...", socketStatus.status);
        return callback(true, host);
      break;
      case 303:
        self.log("Authentication failed, please try again");
        numberOfLoginAttempts++;
        if(numberOfLoginAttempts > 3){
          return callback(true, "too many failed attempts");
        }
        numberOfLoginAttempts = 0;
        return functions.authenticationPrompt.call(self, originalArgs, callback);
      break;
    }
  };

  // this function decides where to emit the command to process, whether local or remote
  functions.emitter = function(event){
    let handler = function(args, callback){
      Hive.processCommandMessage(event, args, callback);
    };
    return handler;
  };

  // called to disconnect remote host
  functions.disconnectRemoteHost = function(args, cb){
    cb = cb || function(){};
    Hive.remote.closeActiveHost(function(){
      Vorpal.delimiter(delimiter).show();
      cb();
    });
  };

  // function that is called when entering "xrem" in cli 
  functions.disconnectRemoteHostCLI = function(args, cb){
    Hive.remote.closeActiveHost(function(){
      Vorpal.ui.cancel();
      Vorpal.delimiter(delimiter).show();
      Vorpal.log("now on local hive");
      cb();
    });
  };
  
  // listen to our remote module if we get exited on 
  Hive.remote.on('remote:closed', function(){
    functions.disconnectRemoteHost(null, function(){
    });
  });
  

  return functions;
}