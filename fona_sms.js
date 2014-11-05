var Device = require('zetta-device');
var util = require('util');
var async = require('async');

var FonaSMS = module.exports = function() {
  Device.call(this);
  this._serialDevice = arguments[0];

  this.smsMaxIndex = null;
  this.smsCapacity = null;
  this.smsMessages = {};
};
util.inherits(FonaSMS, Device);

FonaSMS.prototype.init = function(config) {

  config
  .name('Adafruit Fona SMS')
  .type('fona-sms')
  .monitor('smsMaxIndex')
  .state('waiting')
  .when('waiting', { allow: ['send-sms', 'read-sms', 'delete-sms', 'get-sms-count']})
  .when('sending-sms', { allow: ['read-sms','delete-sms']})
  .when('reading-sms', { allow: ['send-sms']})
  .when('deleting-sms', { allow: ['send-sms']})
  .when('getting-sms-count', { allow: []})
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
      }}])
  .map('get-sms-count', this.getSMSMaxIndexAndCapacity);

  this._setTextMode();

};

FonaSMS.prototype.sendSMS = function(phoneNumber, message, cb) {
  this.log('sendSMS #phoneNumber: ' + phoneNumber + ' #message: ' + message);  
  // TODO: move state assignment into queue worker
  this.state = 'sending-sms';

  var self = this;
  
  var tasks = [
  { command: 'AT+CMGS="' + phoneNumber + '"', regexps: [/^$/]},
  { rawCommand: message + '\u001a', regexps: [/> /, /\+CMGS: \d+/, /^$/, /OK/]}];
  
  this._serialDevice.enqueue(tasks, null, function() {
      self.state = 'waiting';
      cb();
    });
};

FonaSMS.prototype.readSMS = function(messageIndex, cb) {
  this.log('readSMS: ' + messageIndex);
  // TODO: move state assignment into queue worker
  this.state = 'reading-sms';
  
  var self = this;
  
  var cmgrRegexps = [
    /^$/,
    /^(OK)|\+(CMGR):\s"([A-Z]+)\s([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+)/
  ];
  
  var cmgrOnMatch = function (matches) {
    if (matches[1][2] === 'CMGR') {
      self.smsMessages[messageIndex] = {
        receivedState: matches[1][3],
        readState: matches[1][4],
        sendersPhoneNumber: matches[1][5],
        timeStamp: matches[1][7],
      };
      self._serialDevice.enqueue(
        { regexps: [/^(.*)$/,/^$/,/^OK$/],
          onMatch: function(matches) { self.smsMessages[messageIndex].body = matches[0][0] }
        },
        self._serialDevice.highPriority
      );
    } else {
      self.smsMessages[messageIndex] = {};
    }
  }

  var task = 
    { command: 'AT+CMGR=' + messageIndex, regexps: cmgrRegexps, onMatch: cmgrOnMatch};

  this._serialDevice.enqueue(task, null, function() {
    self.state = 'waiting';
    cb();
  });

}

FonaSMS.prototype.deleteSMS = function(messageIndex, flag, cb) {
  this.log('deleteSMS: ' + messageIndex);
  // TODO: move state assignment into queue worker
  this.state = 'deleting-sms';
  
  var deleteCommand = 'AT+CMGD=';
  if (flag) {
    // if flag then messageIndex param is ignored
    deleteCommand += '1,' + flag;
  } else {
    deleteCommand += messageIndex;
  }
  
  var task = {command: deleteCommand, regexps: [/^$/,/OK/]};
  
  var self = this;
  this._serialDevice.enqueue(task, null, function() {
      self.state = 'waiting';
      cb();
    });
}

FonaSMS.prototype.getSMSMaxIndexAndCapacity = function(cb) {
  this.log('getSMSMaxIndexAndCapacity');
  var self = this;
  
  task =
    { command: 'AT+CPMS?', regexps: [/^$/,/^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/,/^$/, /OK/],
      onMatch: function (matches) {
        self.smsMaxIndex = matches[1][1];
        self.smsCapacity = matches[1][2];
      }};
  
  this._serialDevice.enqueue(task, null, function() {
    self.state = 'waiting';
    cb();
  });
}

FonaSMS.prototype._setTextMode = function() {
  this.log('_setTextMode');
  var self = this;
  this._serialDevice.enqueue(
    [{ command: 'AT+CMGF=1', regexps: [/^$/,/OK/]},
    { command: 'AT+CSDH=1', regexps: [/^$/, /OK/]}],
    self._serialDevice.sysPriority);
}

FonaSMS.prototype._getAllSMSMessages = function() {
  this.log('_getAllSMSMessages');
  var self = this;
  
  this._getSMSMaxIndexAndCapacity(function () {
    self.log('looping through messages to read');
    for (messageIndex = 1; messageIndex <= self.smsMaxIndex; messageIndex++) {
      self.readSMS(messageIndex, function() {});
    }
  });
}

