var openpgp = require('openpgp');

var key = ["-----BEGIN PGP PUBLIC KEY BLOCK-----",
    "Version: GnuPG v1",
    "",
    "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",
    "YPxuUDQHu0aR58vdYj4E/LXBH4Y3Yw==",
    "=jeuV",
    "-----END PGP PUBLIC KEY BLOCK-----"];

var publicKey = openpgp.key.readArmored(key.join("\n"));

var offset = 000;

for (var i=1; i <= 1000; i++) {
    console.error("num", i);
    var ssn = {
        "ssn":"100-00-" + ("0000" + (i+offset)).substr(-4,4)
    };

    var ssnData = JSON.stringify(ssn);
    var encrypted = openpgp.encryptMessage(publicKey.keys, ssnData);
    encrypted = encrypted.trim();
    console.error("ssn", ssnData);

    //console.log("encrypted ssn data:");
    //console.log(encrypted);
    //var encoded = encrypted.replace(/\r\n/g, "\\r\\n");
    //encoded = encoded.replace(/\n/g, "\\n");
    //console.log("encoded encrypted ssn data:")
    console.log('"' + encrypted + '"');

}

