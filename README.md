##Zetta FONA network serial device driver

###Install

```
$> npm install zetta-fona-network-serial-driver
```

###Usage

```
var zetta = require('zetta');
var FonaNetwork = require('zetta-fona-network-serial-driver');

zetta()
  .use(FonaNetwork)
  .listen(1337)
```

### Hardware

* any platform

###Transitions

#####get-battery-voltage()

#####get-adc-voltage()

###Design

