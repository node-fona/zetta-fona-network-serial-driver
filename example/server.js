var zetta = require('zetta');
var SerialDevice = require('zetta-serial-device-driver');
var FonaSMS = require('../index');

zetta()
  .use(SerialDevice, '/dev/cu.usbserial')
  .use(FonaSMS)
  .listen(1337);
