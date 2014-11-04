var zetta = require('zetta');
var SerialDevice = require('zetta-serial-device-driver');
var FonaSMS = require('../index');
var app = require('./app');

zetta()
  .use(SerialDevice, '/dev/ttyO1')
  .use(FonaSMS)
  .use(app)
  .listen(1337);
