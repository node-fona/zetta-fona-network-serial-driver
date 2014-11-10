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

  this._listenForIncomingSMS();
  this._getAllSMSMessages();

};

FonaSMS.prototype.sendSMS = function(phoneNumber, message, cb) {
  this.log('sendSMS #phoneNumber: ' + phoneNumber + ' #message: ' + message);  

  var self = this;
  
  var tasks = [
  {    
    before: function() {self.state = 'sending-sms'},
    command: 'AT+CMGS="' + phoneNumber + '"', 
    regexp: /^$/
  },
  {
    rawCommand: message + '\u001a',
    regexp: /> /
  },
  {
    regexp: /\+CMGS: \d+/
  },
  {
    regexp: /^$/
  },
  {
    regexp: /OK/
  }
  ];

  this._serialDevice.enqueue(tasks, null, function() {
    self.state = 'waiting';
    cb();
  });
};

FonaSMS.prototype.readSMS = function(messageIndex, cb) {
  this.log('readSMS: ' + messageIndex);

  var self = this;

  var onMatchCMGR = function (match) {
    if (match[2] !== 'CMGR') {
       self.smsMessages[messageIndex] = {};
    } else {
      self.smsMessages[messageIndex] = {
        receivedState: match[3],
        readState: match[4],
        sendersPhoneNumber: match[5],
        timeStamp: match[7],
      };
      var subTasks = [
      {
        regexp: /^(.*)$/,
        onMatch: function(match) { self.smsMessages[messageIndex].body = match[0] }
      },
      {
        regexp: /^$/
      },
      {
        regexp: /^OK$/
      }
      ];
      self._serialDevice.enqueue(subTasks, self._serialDevice.highPriority);
    }
  }

  var tasks = [
  { 
    before: function() {self.state = 'reading-sms'},
    command: 'AT+CMGR=' + messageIndex,
    regexp: /^$/,
  },
  {
    regexp: /^(OK)|\+(CMGR):\s"([A-Z]+)\s([A-Z]+)","([^"]*)","([^"]*)","([^"]*)",(\d+),(\d+),(\d+),(\d+),"([^"]*)",(\d+),(\d+)/,
    onMatch: onMatchCMGR
  }
  ];

  this._serialDevice.enqueue(tasks, null, function() {
    self.state = 'waiting';
    cb();
  });
}

FonaSMS.prototype.deleteSMS = function(messageIndex, flag, cb) {
  this.log('deleteSMS: ' + messageIndex);
  
  var deleteCommand = 'AT+CMGD=';
  if (flag) {
    // if flag then messageIndex param is ignored
    deleteCommand += '1,' + flag;
  } else {
    deleteCommand += messageIndex;
  }
  
  var tasks = [
  {
    before: function() { self.state = 'deleting-sms' },
    command: deleteCommand,
    regexp: /^$/
  },
  {
    regexps: /OK/
  }
  ];
  
  var self = this;
  this._serialDevice.enqueue(task, null, function() {
      self.state = 'waiting';
      cb();
    });
}

FonaSMS.prototype.getSMSMaxIndexAndCapacity = function(cb) {
  this.log('getSMSMaxIndexAndCapacity');
  var self = this;

  var tasks = [
  {
    before: function() {self.state = 'getting-sms-max-index-and-capacity'},
    command: 'AT+CPMS?',
    regexp: /^$/
  },
  {
    regexp: /^\+CPMS: "[A-Z_]+",(\d+),(\d+),.*$/,
    onMatch: function (match) {
      self.smsMaxIndex = match[1];
      self.smsCapacity = match[2];
    }
  },
  {
    regexp: /^$/
  },
  {
    regexp: /OK/
  }
  ];

  this._serialDevice.enqueue(tasks, null, function() {
    self.state = 'waiting';
    cb();
  });
}

FonaSMS.prototype._listenForIncomingSMS = function() {
  this.log('_listenForIncomingSMS');
  var self = this;
  
  var task = {
    perennial: true,
    before: function() {self.state = 'receiving-sms'},
    regexp: /\+CMTI: "SM",(\d+)/,
    onMatch: function (match) {
      var messageIndex = match[1];
      self.log('!!! incoming SMS: ' + messageIndex);
      self.readSMS(messageIndex, function() {});
    }
  };

  this._serialDevice.enqueue(task);
}

FonaSMS.prototype._setTextMode = function() {
  this.log('_setTextMode');
  var self = this;
  var tasks = [
  {
    before: function() {self.state = 'setting-text-mode'},
    command: 'AT+CMGF=1',
    regexp: /^$/
  },
  {
    regexp: /OK/
  },
  {
    command: 'AT+CSDH=1',
    regexp: /^$/
  },
  {
    regexp: /OK/
  },
  ];

  var self = this;
  this._serialDevice.enqueue(tasks, self._serialDevice.sysPriority, function() {
    self.state = 'waiting';
  });
}

FonaSMS.prototype._getAllSMSMessages = function() {

  // TODO: instead of looping through the indices
  // consider calling the AT command to get all SMS

  this.log('_getAllSMSMessages');
  var self = this;

  this.getSMSMaxIndexAndCapacity(function () {
    self.log('looping through messages to read');
    for (messageIndex = 1; messageIndex <= self.smsMaxIndex; messageIndex++) {
      self.readSMS(messageIndex, function() {});
    }
  });
}

