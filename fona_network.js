var Device = require('zetta-device');
var util = require('util');
var AT = require('./lib/at');

var FonaNetwork = module.exports = function() {
  Device.call(this);
  this._serialDevice = arguments[0];

  this.registrationStatusCode = null;
  this.accessTechnologyCode = null;
  
  this.receivedSignalStrengthCode = null;
  this.receivedSignalStrengthDBM = null;
  this.receivedSignalStrengthCondition = null;
  this.bitErrorRate = null;
};
util.inherits(FonaNetwork, Device);

FonaNetwork.prototype.init = function(config) {

  config
  .name('Adafruit Fona Network')
  .type('fona-network')
  .state('waiting')
  .when('waiting', { allow: ['get-registration-and-access', 'get-signal-strength']})
  .map('get-registration-and-access', this.getRegistrationAndAccess)
  .map('get-signal-strength', this.getSignalStrength);

};

FonaNetwork.prototype.getRegistrationAndAccess = function(cb) {
  this.log('getRegistrationAndAccess');  

  var self = this;
  
  var tasks = [
  {    
    before: function() {self.state = 'getting-registration-and-access'},
    command: 'AT+CREG?',
    regexp: /^$/
  },
  {
    regexp: /^\+CREG: (.*),(.*)$/,
    onMatch: function(match) {
      self.registrationStatusCode = match[1];
      self.registrationStatusDescription = AT.registrationStatusMap[self.registrationStatusCode]['description'];
      self.accessTechnologyCode = match[2];
      self.accessTechnologyDescription = AT.accessTechnologyMap[self.accessTechnologyCode]['description'];
    }
  },
  {
    regexp: /^$/
  },
  {
    regexp: /OK/,
    onMatch: function() {
      self.state = 'waiting';
      cb();
    }
  }
  ];

  this._serialDevice.enqueue(tasks, null, function() {});
};

FonaNetwork.prototype.getSignalStrength = function(cb) {
  this.log('getSignalStrength');

  var self = this;
  
  var tasks = [
  {    
    before: function() {self.state = 'getting-signal-strength'},
    command: 'AT+CSQ',
    regexp: /^$/
  },
  {
    regexp: /^\+CSQ: (\d*),(\d*)$/,
    onMatch: function(match) {
      self.receivedSignalStrengthCode = match[1];
      self.receivedSignalStrengthDBM = AT.receivedSignalStrengthIndicatorMap[self.receivedSignalStrengthCode]['dBm'];
      self.receivedSignalStrengthCondition = AT.receivedSignalStrengthIndicatorMap[self.receivedSignalStrengthCode]['condition'];
      self.bitErrorRate = match[2];
    }
  },
  {
    regexp: /^$/
  },
  {
    regexp: /OK/,
    onMatch: function() {
      self.state = 'waiting';
      cb();
    }
  }
  ];

  this._serialDevice.enqueue(tasks, null, function() {});
};
