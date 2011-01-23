
var config = {
  listen: {
//    address: '127.0.0.1',
    port: 8124
  },
  housekeeping: {
    expire_after: 3600,
    frequency: 300
  },
  tracking: {
  }
}

// FIXME: read about hoisting again
exports.config = config;
