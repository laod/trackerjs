var http = require('http');
var url  = require('url');
var net  = require('net');
var qs  = require('querystring');
var bencode = require('./bencode');
var ba = require('./byte_array');

var peer_state_by_torrent = {};

http.createServer(function (req, res) {

  switch(url.parse(req.url).pathname){
    case "/announce":
      var t = pqs(req.url);
      t['peer_ip'] = req.client.remoteAddress;
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

//}).listen(8124, "127.0.0.1");
}).listen(8124);

// Squawk to the console periodically. This will get noisy quickly
setInterval(function(){
  console.log('peer_state_by_torrent:',JSON.stringify(peer_state_by_torrent));
},60000);

// Schedule missing peer removal
setInterval( function(){
  var now = new Date();
  console.log('House-keeping running. Time:',now);
  
  for(var torrent in peer_state_by_torrent){
    for(var peer in peer_state_by_torrent[torrent]){
      if('last_announce' in peer_state_by_torrent[torrent][peer]){
        if( (now - peer_state_by_torrent[torrent][peer].last_announce) > 3600*1000){
          console.log('Dead peer:',peer,peer_state_by_torrent[torrent][peer].last_announce);
          delete peer_state_by_torrent[torrent][peer];
        }
      }
    }
  }
}, 30*1000);

// Parse a query string into a map
// map[string key] = byteArray value
//
// Node can do this but it doesn't seem to be binary safe
var pqs = function(url){
  var r = {};
  var x = url.split('?');
  if(x.length == 2) {
    var kvps = x[1].split('&');
    for(var p in kvps){
      var kvp = kvps[p].split('=');
      var k = kvp[0];
      var v = new ba.byteArray();
      if(kvp.length == 2){ 
        v.appendString(kvp[1]);
      }
//      console.log('k:',k,'v:',v.toString());
      r[k] = v;
    }
  }
  return(r);
}

var track = function(query,res){

  console.log('================');

  query.must_have = function(key){
    if( !(key in this) ){
      throw('Didn\'t receive '+key+' in the GET params');
    }
    return(this[key]);
  }

  query.may_have = function(key,default_value){
    return(!(key in this) ?  default_value : this[key]);
  }

  try{

    // could technically get away with only info_hash
    // and port.

    var torrent_key = query.must_have('info_hash');
    console.log('torrent key:',torrent_key.toString());

    var peer_id = query.must_have('peer_id');
    console.log('peer_id: ',peer_id.toString());

    var port = query.must_have('port');
    var uploaded = query.must_have('uploaded');
    var downloaded = query.must_have('downloaded');
    var left = query.must_have('left');

  }catch(e){
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end((bencode.bencode({'failure reason':e})).toBuffer());
    return;
  }

  // FIXME: to be consistent, may_have should return byteArrays
  // for the default value case where appropriate
  var ip = query.may_have('ip',query.peer_ip);
  var ip_str = ip.toString();
  var ev = query.may_have('event','announce');
  var compact = query['compact'] == 1 ? true : false;

  var ip_port = ip+':'+port;

  // unknown torrent
  if( !(torrent_key in peer_state_by_torrent) ){
    peer_state_by_torrent[torrent_key] = {};
  }

  // unknown peer
  if( !(ip_port in peer_state_by_torrent[torrent_key]) ){
    var port_int = parseInt(port.toString());
    peer_state_by_torrent[torrent_key][ip_port] = {'compact': packIPAndPort(ip_str,port_int),'peer_id': peer_id};
  } else if (ev == 'stopped'){
    delete peer_state_by_torrent[torrent_key][ip_port];
  } else {
    // check if client has missed too many announces
    // update state
    peer_state_by_torrent[torrent_key][ip_port].last_announce = new Date();
  }

  var peers = compact ? new ba.byteArray() : [];
  for(peer in peer_state_by_torrent[torrent_key]){
    // Don't return the announcing client to itself
    if (peer == ip_port) { continue; }
    var pinfo = peer.split(':');
    if(compact){
      peers.appendByteArray(peer_state_by_torrent[torrent_key][peer].compact);
    }else{
      peers.push({'id': peer_state_by_torrent[torrent_key][peer].peer_id, 'ip': pinfo[0], 'port': pinfo[1]});
    }
  }

  var resp = bencode.bencode({'interval': 30,'peers': peers});
  var rbuf = resp.toBuffer();
  //console.log('rbuf:',rbuf);

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(rbuf);
}

var packIPAndPort = function(ip_str,port_int){
  var packed = new ba.byteArray();
  if(net.isIP(ip_str) == 4){
    var nums = ip_str.split('.');
    for(var i in nums){
      packed.set(i,parseInt(nums[i]));
    }
  }
  packed.set(4, port_int >> 8);
  packed.set(5, port_int & 255);
  return packed;
}
