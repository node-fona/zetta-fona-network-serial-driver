var Scout = require('zetta-scout');
var util = require('util');
var FonaPower = require('./fona_power');

var FonaPowerScout = module.exports = function() {
  Scout.call(this);
};
util.inherits(FonaPowerScout, Scout);

FonaPowerScout.prototype.init = function(next) {
  var FonaPowerQuery = this.server.where({type: 'fona-power'});
  var serialDeviceQuery = this.server.where({ type: 'serial' });
  
  var self = this;

  this.server.observe(serialDeviceQuery, function(serialDevice) {
    self.server.find(FonaPowerQuery, function(err, results) {
      if (results[0]) {
        self.provision(results[0], FonaPower, serialDevice);
      } else {
        self.discover(FonaPower, serialDevice);
      }
      next();
    });
  });
}
