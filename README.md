##Zetta FONA power serial device driver

###Install

```
$> npm install zetta-fona-power-serial-driver
```

###Usage

```
var zetta = require('zetta');
var FonaPower = require('zetta-fona-power-serial-driver');

zetta()
  .use(FonaPower)
  .listen(1337)
```

### Hardware

* any platform

###Transitions

#####get-battery-voltage()

#####get-adc-voltage()

###Design

