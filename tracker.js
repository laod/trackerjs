var TRACKERJS = function() {

  var http    = require('http'),
      url     = require('url'),
      net     = require('net'),
      qs      = require('querystring'),
      bencode = require('./bencode'),
      ba      = require('./byte_array'),
      config  = require('./config').config;

  var peer_state_by_torrent = {};

  var each = function(things, cb){
    var i,
        l;

    if(typeof(things) === 'array'){
      l = things.length;
      for(i = 0; i < l; i += 1){
        cb(i,things[i]);
      }
    } else if(typeof(things) === 'object'){
      for(i in things){
        if(things.hasOwnProperty(i)){
          cb(i,things[i]);
        }
      }
    }
  };

  // Parse a query string into a map
  // map[string key] = byteArray value
  //
  // Node can do this but it doesn't seem to be binary safe
  var pqs = function(url){
    var r = {},
        kvps = url.split('?')[1].split('&');

    each(kvps, function(i,kvs){
      var kv = [],
          k,
          v;

      kv = kvs.split('=');
      k = kv[0];
      v = new ba.byteArray();
      if(kv.length === 2){ 
        v.appendString(kv[1]);
      }
      r[k] = v;
    });
    return(r);
  };

  var packIPAndPort = function(ip_str,port_int){
    var packed = new ba.byteArray(),
        octets;

    if(net.isIP(ip_str) === 4){
      octets = ip_str.split('.');
      each(octets, function(i,octet){
        packed.set(i,parseInt(octet,10));
      });
    }
    packed.set(4, port_int >> 8);
    packed.set(5, port_int & 255);
    return packed;
  };

  var track = function(query,res){
    var torrent_key,
        peer_id, 
        port,
        uploaded,
        downloaded,
        left,
        ip,
        ip_str,
        ev,
        compact,
        ip_port,
        port_int,
        peers,
        resp,
        rbuf;

    query.must_have = function(key){
      if( !(key in this) ){
        throw('Didn\'t receive '+key+' in the GET params');
      }
      return(this[key]);
    };

    query.may_have = function(key,default_value){
      return(!(key in this) ?  default_value : this[key]);
    };

    try{

      // could technically get away with only info_hash
      // and port.
      torrent_key = query.must_have('info_hash');
      peer_id = query.must_have('peer_id');
      port = query.must_have('port');
      uploaded = query.must_have('uploaded');
      downloaded = query.must_have('downloaded');
      left = query.must_have('left');

    }catch(e){
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end((bencode.bencode({'failure reason':e})).toBuffer());
      return;
    }

    // FIXME: to be consistent, may_have should return byteArrays
    // for the default value case where appropriate
    ip = query.may_have('ip',query.peer_ip);
    ip_str = ip.toString();
    ev = query.may_have('event','announce');
    compact = query.compact.toString() === '1' ? true : false;

    ip_port = ip+':'+port;

    // unknown torrent
    if( !(torrent_key in peer_state_by_torrent) ){
      peer_state_by_torrent[torrent_key] = {};
    }

    // unknown peer
    if( !(ip_port in peer_state_by_torrent[torrent_key]) ){
      port_int = parseInt(port.toString(),10);
      peer_state_by_torrent[torrent_key][ip_port] = {'compact': packIPAndPort(ip_str,port_int),'peer_id': peer_id};
    }

    if (ev.toString() === 'stopped'){
      delete peer_state_by_torrent[torrent_key][ip_port];
    } else {
      peer_state_by_torrent[torrent_key][ip_port].last_announce = new Date();
    }

    peers = compact ? new ba.byteArray() : [];
    each(peer_state_by_torrent[torrent_key], function(peer, peer_info){
      var pinfo;

      // Don't return the announcing client to itself
      if (peer === ip_port){
        return;
      }

      pinfo = peer.split(':');
      if(compact){
        peers.appendByteArray(peer_info.compact);
      }else{
        peers.push({'id': peer_info.peer_id, 'ip': pinfo[0], 'port': pinfo[1]});
      }
    });

    resp = bencode.bencode({'interval': 30,'peers': peers});
    rbuf = resp.toBuffer();

    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end(rbuf);
  };

  // START HERE
  http.createServer(function (req, res) {

    switch(url.parse(req.url).pathname){
      case "/announce":
        var t = pqs(req.url);
        t.peer_ip = req.client.remoteAddress;
        track(t,res);
        break;
      case "/status":
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end('OK to go\n');
        break;
      default:
        res.writeHead(404);
        res.end();
    }

  }).listen(config.listen.port, config.listen.address);

  // Squawk to the console periodically. This will get noisy quickly
  setInterval(function(){
    console.log('peer_state_by_torrent:',JSON.stringify(peer_state_by_torrent));
  },60000);

  // Schedule missing peer removal
  setInterval( function(){
    var now = new Date();
  
    each(peer_state_by_torrent, function(torrent, peers){
      each(peers, function(peer, peer_info){
        if('last_announce' in peer_info){
          if( (now - peer_info.last_announce) > config.housekeeping.expire_after*1000){
            console.log('Pruning dead peer:',peer,peer_info.last_announce);
            delete peer_state_by_torrent[torrent][peer];
          }
        }
      })
    });
  }, config.housekeeping.frequency*1000);

}();
