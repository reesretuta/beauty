var soap = require('soap');
var url = 'http://ws.strikeiron.com/EMV6Hygiene?WSDL';
 var options = {
   ignoredNamespaces: {
     namespaces: ['q1', 'q2']
   }
 }
soap.createClient(url, options, function(err, client) {
    var userId = process.env.LICENSE;
    console.log("license", userId);

    client.addSoapHeader({LicenseInfo: {RegisteredUser: {UserID: userId}}});
    client.VerifyEmail({"Email":"arimus@gmail.com","Timeout":15}, function(err, result) {
        if (err) { console.log(err); return };
        console.log("result", result.VerifyEmailResult.ServiceResult.Reason);
    });
});
