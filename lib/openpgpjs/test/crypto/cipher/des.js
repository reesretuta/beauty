'use strict';

var openpgp = typeof window != 'undefined' && window.openpgp ? window.openpgp : require('openpgp');

var util = openpgp.util,
  chai = require('chai'),
  expect = chai.expect;

describe('TripleDES (EDE) cipher test with test vectors from http://csrc.nist.gov/publications/nistpubs/800-20/800-20.pdf', function() {
  var key = util.bin2str([1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]);
  var testvectors = [[[0x80,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x95,0xF8,0xA5,0xE5,0xDD,0x31,0xD9,0x00]],
                     [[0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0xDD,0x7F,0x12,0x1C,0xA5,0x01,0x56,0x19]],
                     [[0x20,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x2E,0x86,0x53,0x10,0x4F,0x38,0x34,0xEA]],
                     [[0x10,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x4B,0xD3,0x88,0xFF,0x6C,0xD8,0x1D,0x4F]],
                     [[0x08,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x20,0xB9,0xE7,0x67,0xB2,0xFB,0x14,0x56]],
                     [[0x04,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x55,0x57,0x93,0x80,0xD7,0x71,0x38,0xEF]],
                     [[0x02,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x6C,0xC5,0xDE,0xFA,0xAF,0x04,0x51,0x2F]],
                     [[0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00],[0x0D,0x9F,0x27,0x9B,0xA5,0xD8,0x72,0x60]],
                     [[0x00,0x80,0x00,0x00,0x00,0x00,0x00,0x00],[0xD9,0x03,0x1B,0x02,0x71,0xBD,0x5A,0x0A]],
                     [[0x00,0x40,0x00,0x00,0x00,0x00,0x00,0x00],[0x42,0x42,0x50,0xB3,0x7C,0x3D,0xD9,0x51]],
                     [[0x00,0x20,0x00,0x00,0x00,0x00,0x00,0x00],[0xB8,0x06,0x1B,0x7E,0xCD,0x9A,0x21,0xE5]],
                     [[0x00,0x10,0x00,0x00,0x00,0x00,0x00,0x00],[0xF1,0x5D,0x0F,0x28,0x6B,0x65,0xBD,0x28]],
                     [[0x00,0x08,0x00,0x00,0x00,0x00,0x00,0x00],[0xAD,0xD0,0xCC,0x8D,0x6E,0x5D,0xEB,0xA1]],
                     [[0x00,0x04,0x00,0x00,0x00,0x00,0x00,0x00],[0xE6,0xD5,0xF8,0x27,0x52,0xAD,0x63,0xD1]],
                     [[0x00,0x02,0x00,0x00,0x00,0x00,0x00,0x00],[0xEC,0xBF,0xE3,0xBD,0x3F,0x59,0x1A,0x5E]],
                     [[0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00],[0xF3,0x56,0x83,0x43,0x79,0xD1,0x65,0xCD]],
                     [[0x00,0x00,0x80,0x00,0x00,0x00,0x00,0x00],[0x2B,0x9F,0x98,0x2F,0x20,0x03,0x7F,0xA9]],
                     [[0x00,0x00,0x40,0x00,0x00,0x00,0x00,0x00],[0x88,0x9D,0xE0,0x68,0xA1,0x6F,0x0B,0xE6]],
                     [[0x00,0x00,0x20,0x00,0x00,0x00,0x00,0x00],[0xE1,0x9E,0x27,0x5D,0x84,0x6A,0x12,0x98]],
                     [[0x00,0x00,0x10,0x00,0x00,0x00,0x00,0x00],[0x32,0x9A,0x8E,0xD5,0x23,0xD7,0x1A,0xEC]],
                     [[0x00,0x00,0x08,0x00,0x00,0x00,0x00,0x00],[0xE7,0xFC,0xE2,0x25,0x57,0xD2,0x3C,0x97]],
                     [[0x00,0x00,0x04,0x00,0x00,0x00,0x00,0x00],[0x12,0xA9,0xF5,0x81,0x7F,0xF2,0xD6,0x5D]],
                     [[0x00,0x00,0x02,0x00,0x00,0x00,0x00,0x00],[0xA4,0x84,0xC3,0xAD,0x38,0xDC,0x9C,0x19]],
                     [[0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00],[0xFB,0xE0,0x0A,0x8A,0x1E,0xF8,0xAD,0x72]],
                     [[0x00,0x00,0x00,0x80,0x00,0x00,0x00,0x00],[0x75,0x0D,0x07,0x94,0x07,0x52,0x13,0x63]],
                     [[0x00,0x00,0x00,0x40,0x00,0x00,0x00,0x00],[0x64,0xFE,0xED,0x9C,0x72,0x4C,0x2F,0xAF]],
                     [[0x00,0x00,0x00,0x20,0x00,0x00,0x00,0x00],[0xF0,0x2B,0x26,0x3B,0x32,0x8E,0x2B,0x60]],
                     [[0x00,0x00,0x00,0x10,0x00,0x00,0x00,0x00],[0x9D,0x64,0x55,0x5A,0x9A,0x10,0xB8,0x52]],
                     [[0x00,0x00,0x00,0x08,0x00,0x00,0x00,0x00],[0xD1,0x06,0xFF,0x0B,0xED,0x52,0x55,0xD7]],
                     [[0x00,0x00,0x00,0x04,0x00,0x00,0x00,0x00],[0xE1,0x65,0x2C,0x6B,0x13,0x8C,0x64,0xA5]],
                     [[0x00,0x00,0x00,0x02,0x00,0x00,0x00,0x00],[0xE4,0x28,0x58,0x11,0x86,0xEC,0x8F,0x46]],
                     [[0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00],[0xAE,0xB5,0xF5,0xED,0xE2,0x2D,0x1A,0x36]],
                     [[0x00,0x00,0x00,0x00,0x80,0x00,0x00,0x00],[0xE9,0x43,0xD7,0x56,0x8A,0xEC,0x0C,0x5C]],
                     [[0x00,0x00,0x00,0x00,0x40,0x00,0x00,0x00],[0xDF,0x98,0xC8,0x27,0x6F,0x54,0xB0,0x4B]],
                     [[0x00,0x00,0x00,0x00,0x20,0x00,0x00,0x00],[0xB1,0x60,0xE4,0x68,0x0F,0x6C,0x69,0x6F]],
                     [[0x00,0x00,0x00,0x00,0x10,0x00,0x00,0x00],[0xFA,0x07,0x52,0xB0,0x7D,0x9C,0x4A,0xB8]],
                     [[0x00,0x00,0x00,0x00,0x08,0x00,0x00,0x00],[0xCA,0x3A,0x2B,0x03,0x6D,0xBC,0x85,0x02]],
                     [[0x00,0x00,0x00,0x00,0x04,0x00,0x00,0x00],[0x5E,0x09,0x05,0x51,0x7B,0xB5,0x9B,0xCF]],
                     [[0x00,0x00,0x00,0x00,0x02,0x00,0x00,0x00],[0x81,0x4E,0xEB,0x3B,0x91,0xD9,0x07,0x26]],
                     [[0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00],[0x4D,0x49,0xDB,0x15,0x32,0x91,0x9C,0x9F]],
                     [[0x00,0x00,0x00,0x00,0x00,0x80,0x00,0x00],[0x25,0xEB,0x5F,0xC3,0xF8,0xCF,0x06,0x21]],
                     [[0x00,0x00,0x00,0x00,0x00,0x40,0x00,0x00],[0xAB,0x6A,0x20,0xC0,0x62,0x0D,0x1C,0x6F]],
                     [[0x00,0x00,0x00,0x00,0x00,0x20,0x00,0x00],[0x79,0xE9,0x0D,0xBC,0x98,0xF9,0x2C,0xCA]],
                     [[0x00,0x00,0x00,0x00,0x00,0x10,0x00,0x00],[0x86,0x6E,0xCE,0xDD,0x80,0x72,0xBB,0x0E]],
                     [[0x00,0x00,0x00,0x00,0x00,0x08,0x00,0x00],[0x8B,0x54,0x53,0x6F,0x2F,0x3E,0x64,0xA8]],
                     [[0x00,0x00,0x00,0x00,0x00,0x04,0x00,0x00],[0xEA,0x51,0xD3,0x97,0x55,0x95,0xB8,0x6B]],
                     [[0x00,0x00,0x00,0x00,0x00,0x02,0x00,0x00],[0xCA,0xFF,0xC6,0xAC,0x45,0x42,0xDE,0x31]],
                     [[0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00],[0x8D,0xD4,0x5A,0x2D,0xDF,0x90,0x79,0x6C]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x80,0x00],[0x10,0x29,0xD5,0x5E,0x88,0x0E,0xC2,0xD0]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x40,0x00],[0x5D,0x86,0xCB,0x23,0x63,0x9D,0xBE,0xA9]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x20,0x00],[0x1D,0x1C,0xA8,0x53,0xAE,0x7C,0x0C,0x5F]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x10,0x00],[0xCE,0x33,0x23,0x29,0x24,0x8F,0x32,0x28]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x08,0x00],[0x84,0x05,0xD1,0xAB,0xE2,0x4F,0xB9,0x42]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x04,0x00],[0xE6,0x43,0xD7,0x80,0x90,0xCA,0x42,0x07]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x02,0x00],[0x48,0x22,0x1B,0x99,0x37,0x74,0x8A,0x23]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00],[0xDD,0x7C,0x0B,0xBD,0x61,0xFA,0xFD,0x54]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x80],[0x2F,0xBC,0x29,0x1A,0x57,0x0D,0xB5,0xC4]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x40],[0xE0,0x7C,0x30,0xD7,0xE4,0xE2,0x6E,0x12]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x20],[0x09,0x53,0xE2,0x25,0x8E,0x8E,0x90,0xA1]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x10],[0x5B,0x71,0x1B,0xC4,0xCE,0xEB,0xF2,0xEE]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x08],[0xCC,0x08,0x3F,0x1E,0x6D,0x9E,0x85,0xF6]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x04],[0xD2,0xFD,0x88,0x67,0xD5,0x0D,0x2D,0xFE]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x02],[0x06,0xE7,0xEA,0x22,0xCE,0x92,0x70,0x8F]],
                     [[0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01],[0x16,0x6B,0x40,0xB4,0x4A,0xBA,0x4B,0xD6]]];

  it('3DES EDE test vectors', function (done) {
    for (var i = 0; i < testvectors.length; i++) {
      var des = new openpgp.crypto.cipher.tripledes(key);

      var encr = util.bin2str(des.encrypt(testvectors[i][0], key));

      expect(encr, 'vector with block ' + util.hexidump(testvectors[i][0]) +
                   ' and key ' + util.hexstrdump(key) +
                   ' should be ' + util.hexidump(testvectors[i][1]) +
                   ' != ' + util.hexidump(encr)).to.be.equal(util.bin2str(testvectors[i][1]));
    }
    done();
  });

  it('DES encrypt/decrypt padding tests', function (done) {
    var key = util.bin2str([0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF]);
    var testvectors = new Array();
    testvectors[0] = [[[0x01], [0x24, 0xC7, 0x4A, 0x9A, 0x79, 0x75, 0x4B, 0xC7]],
	                  [[0x02, 0x03], [0xA7, 0x7A, 0x9A, 0x59, 0x8A, 0x86, 0x85, 0xC5]],
	                  [[0x03, 0x04, 0x05], [0x01, 0xCF, 0xEB, 0x6A, 0x74, 0x60, 0xF5, 0x02]],
	                  [[0x04, 0x05, 0x06, 0x07], [0xA8, 0xF0, 0x3D, 0x59, 0xBA, 0x6B, 0x0E, 0x76]],
	                  [[0x05, 0x06, 0x07, 0x08, 0x09], [0x86, 0x40, 0x33, 0x61, 0x3F, 0x55, 0x73, 0x49]],
	                  [[0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B], [0x13, 0x21, 0x3E, 0x0E, 0xCE, 0x2C, 0x94, 0x01]],
	                  [[0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D], [0x30, 0x49, 0x97, 0xC1, 0xDA, 0xD5, 0x59, 0xA5]],
	                  [[0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F], [0x83, 0x25, 0x79, 0x06, 0x54, 0xA4, 0x44, 0xD9]]];
    testvectors[1] = [[[0x01], [0xF2, 0xAB, 0x1C, 0x9E, 0x70, 0x7D, 0xCC, 0x92]],
	                  [[0x02, 0x03], [0x6B, 0x4C, 0x67, 0x24, 0x9F, 0xB7, 0x4D, 0xAC]],
	                  [[0x03, 0x04, 0x05], [0x68, 0x95, 0xAB, 0xA8, 0xEA, 0x53, 0x13, 0x23]],
	                  [[0x04, 0x05, 0x06, 0x07], [0xC8, 0xDE, 0x60, 0x8F, 0xF6, 0x09, 0x90, 0xB5]],
	                  [[0x05, 0x06, 0x07, 0x08, 0x09], [0x19, 0x13, 0x50, 0x20, 0x70, 0x40, 0x2E, 0x09]],
	                  [[0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B], [0xA8, 0x23, 0x40, 0xC6, 0x17, 0xA6, 0x31, 0x4A]],
	                  [[0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D], [0x36, 0x62, 0xF2, 0x99, 0x68, 0xD4, 0xBF, 0x7C]],
	                  [[0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F], [0x83, 0x25, 0x79, 0x06, 0x54, 0xA4, 0x44, 0xD9, 0x08, 0x6F, 0x9A, 0x1D, 0x74, 0xC9, 0x4D, 0x4E]]];
    testvectors[2] = [[[0x01], [0x83, 0x68, 0xE4, 0x9C, 0x84, 0xCC, 0xCB, 0xF0]],
	                  [[0x02, 0x03], [0xBB, 0xA8, 0x0B, 0x66, 0x1B, 0x62, 0xC4, 0xC8]],
	                  [[0x03, 0x04, 0x05], [0x9A, 0xD7, 0x5A, 0x24, 0xFD, 0x3F, 0xBF, 0x22]],
	                  [[0x04, 0x05, 0x06, 0x07], [0x14, 0x4E, 0x68, 0x6D, 0x2E, 0xC1, 0xB7, 0x52]],
	                  [[0x05, 0x06, 0x07, 0x08, 0x09], [0x12, 0x0A, 0x51, 0x08, 0xF9, 0xA3, 0x03, 0x74]],
	                  [[0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B], [0xB2, 0x07, 0xD1, 0x05, 0xF6, 0x67, 0xAF, 0xBA]],
	                  [[0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D], [0xCA, 0x59, 0x61, 0x3A, 0x83, 0x23, 0x26, 0xDD]],
	                  [[0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F], [0x83, 0x25, 0x79, 0x06, 0x54, 0xA4, 0x44, 0xD9]]];

    var des = new openpgp.crypto.cipher.des(key);

    for (var padding = 0; padding < 3; padding++) {
      var thisVectorSet = testvectors[padding];

      for (var i = 0; i < thisVectorSet.length; i++) {
        var encrypted = des.encrypt(thisVectorSet[i][0], padding);
        var decrypted = des.decrypt(encrypted, padding);

        expect(util.bin2str(encrypted), 'vector with block [' + util.hexidump(thisVectorSet[i][0]) +
          '] and key [' + util.hexstrdump(key) +
          '] and padding [' + padding +
          '] should be ' + util.hexidump(thisVectorSet[i][1]) +
          ' - Actually [' + util.hexidump(encrypted) +
          ']').to.equal(util.bin2str(thisVectorSet[i][1]));
        expect(util.bin2str(decrypted), 'vector with block [' + util.hexidump(thisVectorSet[i][0]) +
          '] and key [' + util.hexstrdump(key) +
          '] and padding [' + padding +
          '] should be ' + util.hexidump(thisVectorSet[i][0]) +
          ' - Actually [' + util.hexidump(decrypted) +
          ']').to.equal(util.bin2str(thisVectorSet[i][0]));
      }
    }
    done();
  });
});