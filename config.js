
var config = {

  // address and port on which to listen
  // omit address to listen on all addresses
  listen: {

//    address: '127.0.0.1',

    port: 8124
  },

  housekeeping: {

    // how long should we wait to remove peers
    expire_after: 3600,

    // how often should we run housekeeping
    frequency: 300
  },

  tracking: {
  }
}

// FIXME: read about hoisting again
exports.config = config;
