/* Based on bencode.js by Anton Ekblad, see below */

/* Copyright (c) 2009 Anton Ekblad

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software. */

var ba = require('./byte_array.js');

// bencode an object, produces a byteArray
function bencode(obj) {
    switch(btypeof(obj)) {
        case "string":     return bstring(obj);
        case "number":     return bint(obj);
        case "list":       return blist(obj);
        case "dictionary": return bdict(obj);
        case "bytearray":  return bba(obj);
        default:           return null;
    }
}

// decode a bencoded string into a javascript object
// FIXME: currently not the reverse of bencode
//        expects strings instead of byte arrays
// You probably shouldn't use this as-is
function bdecode(str) {
    var dec = bparse(str);
    if(dec != null && dec[1] == "")
        return dec[0];
    return null;
}

//exports.bdecode = bdecode;
exports.bencode = bencode;

// parse a bencoded string; bdecode is really just a wrapper for this one.
// all bparse* functions return an array in the form
// [parsed object, remaining string to parse]
function bparse(str) {
    switch(str.charAt(0)) {
        case "d": return bparseDict(str.substr(1));
        case "l": return bparseList(str.substr(1));
        case "i": return bparseInt(str.substr(1));
        default:  return bparseString(str);
    }
}

// parse a bencoded string
function bparseString(str) {
    str2 = str.split(":", 1)[0];
    if(isNum(str2)) {
        len = parseInt(str2);
        return [str.substr(str2.length+1, len),
                str.substr(str2.length+1+len)];
    }
    return null;
}

// parse a bencoded integer
function bparseInt(str) {
    var str2 = str.split("e", 1)[0];
    if(!isNum(str2))
        return null;
    return [str2, str.substr(str2.length+1)];
}

// parse a bencoded list
function bparseList(str) {
    var p, list = [];
    while(str.charAt(0) != "e" && str.length > 0) {
        p = bparse(str);
        if(null == p)
            return null;
        list.push(p[0]);
        str = p[1];
    }
    if(str.length <= 0)
        return null;
    return [list, str.substr(1)];
}

// parse a bencoded dictionary
function bparseDict(str) {
    var key, val, dict = {};
    while(str.charAt(0) != "e" && str.length > 0) {
        key = bparseString(str);
        if(null == key)
            return;

        val = bparse(key[1]);
        if(null == val)
            return null;

        dict[key[0]] = val[0];
        str = val[1];
    }
    if(str.length <= 0)
        return null;
    return [dict, str.substr(1)];
}

// is the given string numeric?
function isNum(str) {
    var i, c;
    str = str.toString();
    if(str.charAt(0) == '-')
        i = 1;
    else
        i = 0;

    for(; i < str.length; i++) {
        c = str.charCodeAt(i);
        if(c < 48 || c > 57) {
            return false;
        }
    }
    return true;
}

// returns the bencoding type of the given object
function btypeof(obj) {
    var type = typeof obj;
    if(type == "object") {
        if(obj instanceof ba.byteArray)
            return "bytearray";
        if(typeof obj.length == "undefined")
            return "dictionary";
        return "list";
    }
    return type;
}

// bencode a string
function bstring(str) {
  var nba = new ba.byteArray();
  nba.appendString(str.length + ':' + str);
  //console.log('bstring:',nba.toString());
  return nba;
}

// bencode a byteArray, binary-safe version of bstring
function bba(oba) {
  //console.log('bba oba:',oba.toString());
  var nba = new ba.byteArray();
  nba.appendString(oba.length().toString() + ':');
  nba.appendByteArray(oba);
  //console.log('bba:',nba.toString());
  return nba;
}

// bencode an integer
function bint(num) {
  var nba = new ba.byteArray();
  nba.appendString('i' + num + 'e');
  //console.log('bint:',nba.toString());
  return nba;
}

// bencode a list
function blist(list) {
  var nba = new ba.byteArray();
  var enclist;
  enclist = [];
  for(key in list) {
    enclist.push(bencode(list[key]));
  }
  enclist.sort();

  nba.appendString('l');
  for(key in enclist) {
    nba.appendByteArray(enclist[key]);
  }
  nba.appendString('e');
  //console.log('blist:',nba.toString());
  return nba;
}

// bencode a dictionary
//  keys should be sorted, as per bep0003
function bdict(dict) {
  var nba = new ba.byteArray();
  var ordered_keys = [];    
  for(key in dict) {
    ordered_keys.push(key);
  }
  ordered_keys.sort();

  nba.appendString('d');
  for(key in ordered_keys) {
    k = ordered_keys[key]; // ugh
    nba.appendByteArray(bstring(k));
    nba.appendByteArray(bencode(dict[k]));
  }
  nba.appendString('e');
  //console.log('bdict:',nba.toString());
  return nba;
}
