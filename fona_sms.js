var Device = require('zetta-device');
var util = require('util');

var FonaSMS = module.exports = function() {
  Device.call(this);
  this._serialDevice = arguments[0];

  this.smsMaxIndex = null;
  this.smsMessages = {};
};
util.inherits(FonaSMS, Device);

FonaSMS.prototype.init = function(config) {

  config
  .name('Adafruit Fona SMS')
  .type('fona-sms')
  .monitor('smsMaxIndex')
  .state('waiting')
  .when('waiting', { allow: ['send-sms', 'read-sms', 'delete-sms']})
  .when('sending-sms', { allow: ['read-sms','delete-sms']})
  .when('reading-sms', { allow: ['send-sms']})
  .when('deleting-sms', { allow: ['send-sms']})
  .map('send-sms', this.sendSMS, [
    { name: 'phoneNumber', title: 'Phone Number to Send SMS', type: 'text'},
    { name: 'message', title: 'Body of the SMS', type: 'text'},
    ])
  .map('read-sms', this.readSMS, [
    { name: 'messageIndex', title: 'Message Index', type: 'range',
      min: 1, max: 80, step: 1}])
  .map('delete-sms', this.deleteSMS, [
    { name: 'messageIndex', title: 'Message Index', type: 'range',
      min: 1, max: 80, step: 1},
    { name: 'flag', title: 'Options Flag', type: 'range',
      min: 0, max: 4, step: 1, value: 0, notes: {
        0: 'Delete only the SMS message stored at the location index from the message storage area. This is the default value.',
        1: 'Ignore the value of index and delete all SMS messages whose status is "received read" from the message storage area.',
        2: 'Ignore the value of index and delete all SMS messages whose status is "received read" or "stored sent" from the message storage area.',
        3: 'Ignore the value of index and delete all SMS messages whose status is "received read", "stored unsent" or "stored sent" from the message storage area.',
        4: 'Ignore the value of index and delete all SMS messages from the message storage area.'
      }}]);

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
    name: 'Send SMS: ' + message + ' to: ' + phoneNumber,
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({
    name: 'Send SMS: ' + message + ' to: ' + phoneNumber,
    command: 'AT+CMGS="' + phoneNumber + '"',
    regexps: [new RegExp('^AT\\+CMGS="' + phoneNumber + '"\\s*')]}, function() {});
  this._serialDevice.enqueue({
    name: 'Send SMS: ' + message + ' to: ' + phoneNumber,
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
    name: 'Read SMS: ' + messageIndex,
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({
    name: 'Read SMS: ' + messageIndex,
    command: 'AT+CSDH=1', 
    regexps: [/^AT\+CSDH=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({
    name: 'Read SMS: ' + messageIndex,
    command: 'AT+CMGR=' + messageIndex, 
    regexps: [/^AT\+CMGR=\d+/,
      /^(OK)|\+CMGR: "([A-Z]+) ([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+)/]}, function (matches) {
      if (matches[1][1] === 'OK') {
        self.state = 'waiting';
        cb();
      } else {
        self.smsMessages[messageIndex] = {
          receivedState: matches[1][1],
          readState: matches[1][2],
          sendersPhoneNumber: matches[1][3],
          timeStamp: matches[1][5],
        };
        self._serialDevice.enqueue({
            priority: self._serialDevice.highPriority,
            command: null,
            regexps: [/^(.*)$/,/^$/,/^OK$/]
          }, function(matches) {
            self.smsMessages[messageIndex] = {
              body: matches[1][0]
            };
            self.state = 'waiting';
            cb();
          });
    }
  });
}

FonaSMS.prototype.deleteSMS = function(messageIndex, flag, cb) {
  var deleteCommand = 'AT+CMGD=';

  if (flag) {
    // if flag then messageIndex param is ignored
    deleteCommand += '1,' + flag;
  } else {
    deleteCommand += messageIndex;
  }
  
  this.state = 'deleting-sms';
  
  console.log('messageIndex:',messageIndex);
  
  this.log('deleteSMS: ' + messageIndex);
  var self = this;
  this._serialDevice.enqueue({
    name: 'Delete SMS: ' + messageIndex,
    command: 'AT+CMGF=1',
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueue({
    command: deleteCommand,
    regexps: [/^AT\+CMGD=\d+[,\d+]+/,/OK/]}, function() {
      // TODO consider updating smsMessages with deletions
      // including deleting more based on flag
      self.state = 'waiting';
      cb();
    });
}

FonaSMS.prototype._requestAllSMSMessages = function() {
  this.log('Request ALL SMS Messages');
  var self = this;
  this._requestsmsMaxIndexAndCapacity(function() {
    for (messageIndex = 1; messageIndex <= self.smsMaxIndex; messageIndex++) {
      self.readSMS(messageIndex, function() {});
    }});
}

FonaSMS.prototype._requestsmsMaxIndexAndCapacity = function(cb) {
  var self = this;
  this._serialDevice.enqueue({
    command: 'AT+CMGF=1', 
    regexps: [/^AT\+CMGF=1/,/OK/]}, function() {});
  this._serialDevice.enqueueSimple('AT+CPMS?', /^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/, function (matches) {
    self.smsMaxIndex = matches[1][1];
    self.smsCapacity = matches[1][2];
    cb();
  });
}