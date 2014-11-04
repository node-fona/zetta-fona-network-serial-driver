##Zetta FONA SMS serial device driver

###Install

```
$> npm install zetta-fona-sms-serial-driver
```

###Usage

```
var zetta = require('zetta');
var FonaSMS = require('zetta-fona-sms-serial-driver');

zetta()
  .use(FonaSMS)
  .listen(1337)
```

### Hardware

* any platform

###Transitions

#####write-sms(phoneNumber, message)

#####read-sms(messageIndex)

###Design

