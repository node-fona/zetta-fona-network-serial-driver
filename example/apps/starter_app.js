module.exports = function testApp(server) {
  
  var fonaSMSQuery = server.where({type: 'fona-sms'});
  
  server.observe([fonaSMSQuery], function(fonaSMS){
    setInterval(function(){
      fonaSMS.call('read-sms', 1, function() {});
    }, 5000);
  });
  
}