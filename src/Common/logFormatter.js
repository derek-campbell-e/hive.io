module.exports = function LogFormatter(Module, logString, noMetaString){
  const common = require('../Common');
  noMetaString = noMetaString || false;
  const moment = require('moment');
  const util = require('util');
  const dateString = moment().format(common.timeformat);
  const metaString = Module.meta.id + " " + Module.meta.class + ":" + Module.meta.mind;
  logString = logString.replace(/\n/g, " ");
  if(noMetaString) {
    return util.format('%s', logString);
  }
  return util.format('%s [%s] - %s', metaString, dateString, logString);
};