'use strict';
/* jshint unused: false */
var _ = require('lodash');
var assert = require('assert');
var should = require('chai').should();
var expect = require('chai').expect;
var bitcore = require('..');
var errors = bitcore.errors.HDPrivateKey.InvalidArgument;
var buffer = require('buffer');
var bufferUtil = bitcore.util.buffer;
var HDPrivateKey = bitcore.HDPrivateKey;
var Base58Check = bitcore.encoding.Base58Check;

var xprivkey = 'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi';
var json = '{"network":"livenet","depth":0,"fingerPrint":876747070,"parentFingerPrint":0,"childIndex":0,"chainCode":"873dff81c02f525623fd1fe5167eac3a55a049de3d314bb42ee227ffed37d508","privateKey":"e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35","checksum":-411132559,"xprivkey":"xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi"}';

describe('HDPrivate key interface', function() {
  /* jshint maxstatements: 50 */
  var expectFail = function(func, error) {
    var got = null;
    try {
      func();
    } catch (e) {
      got = e instanceof error;
    }
    expect(got).to.equal(true);
  };

  var expectDerivationFail = function(argument, error) {
    return expectFail(function() {
      var privateKey = new HDPrivateKey(xprivkey);
      privateKey.derive(argument);
    }, error);
  };

  var expectFailBuilding = function(argument, error) {
    return expectFail(function() {
      return new HDPrivateKey(argument);
    }, error);
  };

  var expectSeedFail = function(argument, error) {
    return expectFail(function() {
      return HDPrivateKey.fromSeed(argument);
    }, error);
  };

  it('should make a new private key from random', function() {
    (new HDPrivateKey().xprivkey).should.exist();
  });

  it('should error with an invalid checksum', function() {
    expectFailBuilding(xprivkey + '1', errors.InvalidB58Checksum);
  });

  it('can be rebuilt from a json generated by itself', function() {
    var regenerate = new HDPrivateKey(json);
    regenerate.xprivkey.should.equal(xprivkey);
  });

  it('builds a json keeping the structure and same members', function() {
    assert(_.isEqual(
      JSON.parse(new HDPrivateKey(json).toJson()),
      JSON.parse(new HDPrivateKey(xprivkey).toJson())
    ));
  });

  describe('should error with a nonsensical argument', function() {
    it('like a number', function() {
      expectFailBuilding(1, errors.UnrecognizedArgument);
    });
  });

  it('allows no-new calling', function() {
    HDPrivateKey(xprivkey).toString().should.equal(xprivkey);
  });

  it('allows the use of a copy constructor', function() {
    HDPrivateKey(HDPrivateKey(xprivkey))
      .xprivkey.should.equal(xprivkey);
  });

  it('fails when trying to derive with an invalid argument', function() {
    expectDerivationFail([], errors.InvalidDerivationArgument);
  });

  it('catches early invalid paths', function() {
    expectDerivationFail('s', errors.InvalidPath);
  });

  it('allows derivation of hardened keys by passing a very big number', function() {
    var privateKey = new HDPrivateKey(xprivkey);
    var derivedByNumber = privateKey.derive(0x80000000);
    var derivedByArgument = privateKey.derive(0, true);
    derivedByNumber.xprivkey.should.equal(derivedByArgument.xprivkey);
  });

  it('returns itself with "m" parameter', function() {
    var privateKey = new HDPrivateKey(xprivkey);
    privateKey.should.equal(privateKey.derive('m'));
  });

  it('returns InvalidArgument if invalid data is given to getSerializedError', function() {
    expect(
      HDPrivateKey.getSerializedError(1) instanceof
      errors.UnrecognizedArgument
    ).to.equal(true);
  });

  it('returns InvalidLength if data of invalid length is given to getSerializedError', function() {
    expect(
      HDPrivateKey.getSerializedError(Base58Check.encode(new buffer.Buffer('onestring'))) instanceof
      errors.InvalidLength
    ).to.equal(true);
  });

  it('returns InvalidNetworkArgument if an invalid network is provided', function() {
    expect(
      HDPrivateKey.getSerializedError(xprivkey, 'invalidNetwork') instanceof
      errors.InvalidNetworkArgument
    ).to.equal(true);
  });

  it('recognizes that the wrong network was asked for', function() {
    expect(
      HDPrivateKey.getSerializedError(xprivkey, 'testnet') instanceof
      errors.InvalidNetwork
    ).to.equal(true);
  });

  it('recognizes the correct network', function() {
    expect(HDPrivateKey.getSerializedError(xprivkey, 'livenet')).to.equal(null);
  });

  describe('on creation from seed', function() {
    it('converts correctly from an hexa string', function() {
      HDPrivateKey.fromSeed('01234567890abcdef01234567890abcdef').xprivkey.should.exist();
    });
    it('fails when argument is not a buffer or string', function() {
      expectSeedFail(1, errors.InvalidEntropyArgument);
    });
    it('fails when argument doesn\'t provide enough entropy', function() {
      expectSeedFail('01', errors.InvalidEntropyArgument.NotEnoughEntropy);
    });
    it('fails when argument provides too much entropy', function() {
      var entropy = '0';
      for (var i = 0; i < 129; i++) {
        entropy += '1';
      }
      expectSeedFail(entropy, errors.InvalidEntropyArgument.TooMuchEntropy);
    });
  });

  it('correctly errors if an invalid checksum is provided', function() {
    var privKey = new HDPrivateKey(xprivkey);
    var error = null;
    try {
      var buffers = privKey._buffers;
      buffers.checksum = bufferUtil.integerAsBuffer(0);
      var privateKey = new HDPrivateKey(buffers);
    } catch (e) {
      error = e;
    }
    expect(error instanceof errors.InvalidB58Checksum).to.equal(true);
  });
  it('correctly validates the checksum', function() {
    var privKey = new HDPrivateKey(xprivkey);
    expect(function() {
      var buffers = privKey._buffers;
      return new HDPrivateKey(buffers);
    }).to.not.throw();
  });

  it('shouldn\'t matter if derivations are made with strings or numbers', function() {
    var privateKey = new HDPrivateKey(xprivkey);
    var derivedByString = privateKey.derive('m/0\'/1/2\'');
    var derivedByNumber = privateKey.derive(0, true).derive(1).derive(2, true);
    derivedByNumber.xprivkey.should.equal(derivedByString.xprivkey);
  });
});

