/**
 * Created by tang on 2016/5/28.
 */

var fs = require('fs');
var cfg = require('./config.js');
var mg_core=require("mega-common").core;
var s2o=mg_core.s2o;
var o2s=mg_core.o2s;

var _user_keys_a = {};

function setUserKey(user,data) {
    _user_keys_a[user] = data;

    var tryToSave = function(c) {
        fs.writeFile(cfg.keyPath+"/"+user+".s.txt", o2s(data), function(err){
            if (err) {
                if (c < 3)
                    tryToSave(c+1);
                else
                    console.log("save setting failed.", err);
            }
        });
    };

    tryToSave(0);
}

function getUserKey(user) {
    if (!_user_keys_a[user]) {
        // load from file
        try {
            _user_keys_a[user] = s2o(fs.readFileSync(cfg.keyPath+'/'+user+".s.txt",'utf-8'))
        }catch(ex){}
    }

    return _user_keys_a[user];
}

if(typeof(exports)!="undefined"){
    exports.setUserKey = setUserKey;
    exports.getUserKey = getUserKey;
}