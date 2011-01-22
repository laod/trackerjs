/*
   Provide a binary-safe datatype more flexible than node's
   Buffers. 

   Store a string of bytes as an array of ints (terrible!)

   The intent is to parse a URL-encoded binary string, safely
   store it, and convert it to a node Buffer to be output. 

   Currently only supports URL-encoding in parsing and output
   but could (should) be extended to support more efficient
   encodings.
*/

exports.byteArray = byteArray;

function byteArray(){
  this._ba = new Array();
}

byteArray.prototype.get = function get(i){
  return this._ba[i];
}

byteArray.prototype.set = function set(i,v){
  this._ba[i] = v;
}

byteArray.prototype.length = function length(){
  return this._ba.length;
}

// parse a (for now) URL-encoded string and return
// an array of ints. Used internally.
byteArray.prototype.parseString = function parseString(str,enc){
  // FIXME: more/better encodings
  enc || (enc = 'url');

  var i = 0, i2 = 0;
  var chars = str.split('');
  var new_array = new Array();
  while(i < chars.length){
    if(chars[i] == '%'){
      new_array[i2] = parseInt(chars[i+1]+chars[i+2],16);
      i += 3;
    }else{
      new_array[i2] = chars[i].charCodeAt(0);
      i++;
    }
    i2++;
  }
  //console.log('new_array:',new_array);
  return new_array;
}

// replace the contents of this byteArray with the decoded contents of str
byteArray.prototype.replaceWithString = function replaceWithString(str,enc){
  this._ba = this.parseString(str,enc);
  //console.log('replaceWithString:',this._ba);
}

// append the decoded contents of str to this byteArray
byteArray.prototype.appendString = function appendString(str,enc){
  this._ba = this._ba.concat(this.parseString(str,enc));
  //console.log('appendString:',this._ba);
}

// append the contents of ba to this byteArray
byteArray.prototype.appendByteArray = function appendByteArray(ba){
  this._ba = this._ba.concat(ba._ba);
  //console.log('appendByteArray:',this._ba);
}

// As it stands this approximates escape()'s functionality.
// FIXME: verify correctness.
byteArray.prototype.toString = function toString(enc){
  // FIXME: more/better encodings
  enc || (enc = 'url');
  var safe_chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$-_.+!*'(),".split('');
  var safe = {};
  for(var i in safe_chars) { safe[safe_chars[i].charCodeAt(0)] = 1; }
  var b, str = '';
  for(var bi in this._ba){
    b = this._ba[bi];
    //console.log('b:',b,'b in safe?',b in safe);
    if(!(b in safe)){
      str += (b < 17 ? '%0' : '%') + b.toString(16).toUpperCase();
    }else{
      str += String.fromCharCode(b);
    }
  }
  return str;
}

byteArray.prototype.inspect = function inspect(){
  return '['+this._ba.join(',')+']';
}

// return a node Buffer object containing this byteArray's data
byteArray.prototype.toBuffer = function toBuffer(){
  //console.log('this._ba:',this._ba);
  var rbuf = new Buffer(this.length());
  for(var i in this._ba){
    rbuf[i] = this._ba[i];
  }
  return rbuf;
}
