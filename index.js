var Scout = require('zetta-scout');
var util = require('util');
var FonaSMS = require('./fona_sms');

var FonaScout = module.exports = function() {
  Scout.call(this);
};
util.inherits(FonaScout, Scout);

FonaScout.prototype.init = function(next) {
  var queries = [
    this.server.where({ type: 'serial' })
  ];

  var self = this;
  this.server.observe(queries, function(serialDevice) {
    self.discover(FonaSMS, serialDevice);
  });

  next();
}