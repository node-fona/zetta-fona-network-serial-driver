var Scout = require('zetta-scout');
var util = require('util');
var FonaNetwork = require('./fona_network');

var FonaNetworkScout = module.exports = function() {
  Scout.call(this);
};
util.inherits(FonaNetworkScout, Scout);

FonaNetworkScout.prototype.init = function(next) {
  var FonaNetworkQuery = this.server.where({type: 'fona-network'});
  var serialDeviceQuery = this.server.where({ type: 'serial' });
  
  var self = this;

  this.server.observe(serialDeviceQuery, function(serialDevice) {
    self.server.find(FonaNetworkQuery, function(err, results) {
      if (results[0]) {
        self.provision(results[0], FonaNetwork, serialDevice);
      } else {
        self.discover(FonaNetwork, serialDevice);
      }
      next();
    });
  });
}
