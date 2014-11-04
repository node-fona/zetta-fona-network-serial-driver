var Device = require('zetta-device');
var util = require('util');

var FonaSMS = module.exports = function() {
  Device.call(this);
  this._serialDevice = arguments[0];

  this.smsCount = null;
  this.smsMessages = {};
};
util.inherits(FonaSMS, Device);

FonaSMS.prototype.init = function(config) {

  config
  .name('Adafruit FonaSMS')
  .type('fona-sms')
  .monitor('smsCount')
  .state('waiting')
  .when('waiting', { allow: ['send-sms', 'read-sms']})
  .when('sending-sms', { allow: ['read-sms']})
  .when('reading-sms', { allow: ['send-sms']})
  .map('read-sms', this.readSMS, [
    { name: 'messageIndex', title: 'Message Index', type: 'range',
      min: 1, step: 1}])
  .map('send-sms', this.sendSMS, [
    { name: 'phoneNumber', title: 'Phone Number to Send SMS', type: 'text'},
    { name: 'message', title: 'Body of the SMS', type: 'text'},
    ]);

  var self = this;
  this._requestAllSMSMessages();
  setInterval(function() {
    self._requestAllSMSMessages();
  }, 60000);

};

FonaSMS.prototype.sendSMS = function(phoneNumber, message, cb) {
  
  this.state = 'sending-sms';

  var self = this;
  
  this.log('sendSMS #phoneNumber: ' + phoneNumber + ' #message: ' + message);
  
  this._serialDevice.enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({
    command: 'AT+CMGS="' + phoneNumber + '"',
    regexps: [new RegExp('^AT\\+CMGS="' + phoneNumber + '"\\s*')]}, function() {});
  this._serialDevice.enqueue({
    rawCommand: message + '\u001a',
    regexps: [new RegExp('^> ' + message + '\\s*'), /^\+CMGS: (\d+)/,/^$/,/OK/]}, function() {});
  
  this.state = 'waiting';

  cb();
};

FonaSMS.prototype.readSMS = function(messageIndex, cb) {
  
  this.state = 'reading-sms';
  
  var smsMessage = {};
  
  this.log('readSMS: ' + messageIndex);
  var self = this;
  this._serialDevice.enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({
    command: 'AT+CSDH=1', 
    regexps: [/^AT\+CSDH=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({ 
    command: 'AT+CMGR=' + messageIndex, 
    regexps: [/^AT\+CMGR=\d+/,
      /^\+CMGR: "([A-Z]+) ([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+)/,
      /^(.*)$/,
      /^$/,
      /^OK$/]},
    function (matches) {
      self.smsMessages[messageIndex] = {
        receivedState: matches[1][1],
        readState: matches[1][2],
        sendersPhoneNumber: matches[1][3],
        timeStamp: matches[1][5],
        body: matches[2][0]
      };
      this.state = 'waiting';
      cb();
    });
}

FonaSMS.prototype._requestAllSMSMessages = function() {
  var self = this;
  this._requestSMSCountAndCapacity(function() {
    for (messageIndex = 1; messageIndex <= self.smsCount; messageIndex++) {
      self.readSMS(messageIndex, function() {});
    }});
}

FonaSMS.prototype._requestSMSCountAndCapacity = function(cb) {
  var self = this;
  this._serialDevice.enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueueSimple('AT+CPMS?', /^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/, function (matches) {
    self.smsCount = matches[1][1];
    self.smsCapacity = matches[1][2];
    cb();
  });
}
