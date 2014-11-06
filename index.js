var Scout = require('zetta-scout');
var util = require('util');
var FonaSMS = require('./fona_sms');

var FonaSMSScout = module.exports = function() {
  Scout.call(this);
};
util.inherits(FonaSMSScout, Scout);

FonaSMSScout.prototype.init = function(next) {
  var fonaSMSQuery = this.server.where({type: 'fona-sms'});
  var serialDeviceQuery = this.server.where({ type: 'serial' });
  
  var self = this;

  this.server.observe(serialDeviceQuery, function(serialDevice) {
    self.server.find(fonaSMSQuery, function(err, results) {
      if (results[0]) {
        self.provision(results[0], FonaSMS, serialDevice);
      } else {
        self.discover(FonaSMS, serialDevice);
      }
      next();
    });
  });
}
