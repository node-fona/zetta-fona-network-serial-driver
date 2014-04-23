var zetta = require('zetta');
var SerialDevice = require('zetta-serial-device-driver');
var FonaSMS = require('../index');

zetta()
  .use(SerialDevice, '/dev/ttyO1')
  .use(FonaSMS)
  .listen(1337);
