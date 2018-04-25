module.exports = function stdFormatter(){
  const util = require('util');
  let args = [...arguments];
  let types = [];
  for(let argIndex in args){
    let arg = args[argIndex];
    let type = "";
    switch(typeof arg){
      case 'string':
      case 'boolean':
        type = "%s";
        break;
      case 'number':
        type = "%d";
        break;
      case 'function':
        type = '%s';
        break;
      case 'object':
        //type = '%o';
        if(Array.isArray(arg)){
          type = '%s';
          args[argIndex] = arg.join(", ");
        } else if(arg !== null){
          type = "%s";
          args[argIndex] = JSON.stringify(arg);
        }
        break;
      case 'undefined':
        type = '%s';
        break;
      default:
        type = '%s';
        break;
    }

    if(arg instanceof Error){
      args[argIndex] = util.format("Error: %s; Message: %s", arg.name, arg.message);
      type = '%s';
    }

    types.push(type);
  }
  let formatString = types.join(" ");
  return util.format.apply(util, [formatString, ...args]);
};