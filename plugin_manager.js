var fs = require('fs');
var async = require('async');
var cfg = require('./config');

var plugin_workers = {};

function mkdirs(dirpath, callback) {
    fs.access(dirpath, function(err) {
        if (!err) {
            callback();
        } else {
            var path_tmp;
            async.mapSeries(dirpath.split("/"), function(name, callback){
                if (path_tmp) {
                    path_tmp += "/" + name;
                } else {
                    path_tmp = name;
                }

                fs.access(path_tmp, function(err) {
                    if (err) {
                        fs.mkdir(path_tmp, function(err){
                            callback(err);
                        });
                    } else {
                        callback();
                    }
                });
            }, function(err){
                callback(err);
            });
        }
    });
}

function publish(opts, callback) {
    var plugin_dir = cfg.pluginPath + '/' + opts.name;
    mkdirs(plugin_dir, function(err){
        if (!!err) {
            callback(err);
        } else {
            fs.writeFile(plugin_dir + '/index.js', opts.code, function(err){
                if (!!err) {
                    callback(err);
                } else {
                    var installed_workers = plugin_workers[opts.name] || [];
                    plugin_workers[opts.name] = [];
                    callback(null, installed_workers);
                }
            });
        }
    });
}

function download(pluginName, workerName, callback) {
    if (!plugin_workers[pluginName]) {
        plugin_workers[pluginName] = [workerName];
    } else {
        plugin_workers[pluginName].push(workerName);
    }

    var plugin_file = cfg.pluginPath+'/'+pluginName+"/index.js";
    fs.access(plugin_file, fs.constants.R_OK, function(err){
        if (!!err) {
            callback("Plugin Not Found");
        } else {
            fs.readFile(plugin_file,'utf-8',function(err,data){
                if (!!err) {
                    callback("Read plugin failed -" + err);
                } else {
                    callback(null, data);
                }
            });
        }
    });
}

exports.download = download;
exports.publish = publish;