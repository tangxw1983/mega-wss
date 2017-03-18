var _d_=console.log;

var mg_core=require("mega-common").core;
var s2o=mg_core.s2o;
var o2s=mg_core.o2s;
var len=mg_core.len;

var ws = require("nodejs-websocket");
var mg_ws=require("mega-common").ws;
var WS_Send_Raw=mg_ws.WS_Send_Raw;
var WS_Request=mg_ws.WS_Request;
var WS_Reply=mg_ws.WS_Reply;
var WS_OnMessage=mg_ws.WS_OnMessage;
var WorkerManager = require('./worker_manager');
var PluginManager = require('./plugin_manager');
var UserKey = require('./user_key');

var _worker_observer = [];

WorkerManager.addWorkerChangedHandler(function(content){
    for (var i= 0;i<_worker_observer.length;i++) {
        var conn = _worker_observer[i];
        if (!conn || (conn.readyState != 1 && conn.readyState != 0)) {
            if (conn) conn.close();
            _worker_observer.splice(i, 1);
            i--;
        } else {
            WS_Send_Raw(conn, o2s({
                _c: "worker_manager",
                _m: "worker_changed",
                _p: content
            }));
        }
    }
});

//function Worker_Login(_user,_pwd){
//	var f_pass_check=false;
//
//	//TODO 先判断本地帐号缓存？或者去一个远程地址（可以放到启动的第四个参数？）检验
//	f_pass_check=true;
//	return f_pass_check;
//}

function Worker_Get(idx){
    for(k in _client_conn_a){
        return _client_conn_a[k];//TODO 这个是临时返回第一个...
        if(k==idx){
            return _client_conn_a[k];
        }
    }
    return null;
}
var g_worker_a={};
function BusinessLogic(conn,data_o,_token){
    // 自适用请求数据结构
    var _req=data_o;
    if(data_o && data_o.req){
        _req=data_o.req;
    }
    if(data_o==null)data_o={};
    var _req=data_o.req;
    if(_req==null) _req=data_o;

    // 处理
    if (_req._c == "worker_manager") {
        switch (_req._m) {
            case "registerWorker":
                var worker_info = typeof _req._p == "string" ? s2o(_req._p) : _req._p;
                _d_("worker [" + worker_info.name + "] signin", worker_info);
                //保存下来
                var sts;
                if (WorkerManager.registerWorker(worker_info.name, conn, worker_info.type)) {
                    sts = "OK";
                } else {
                    sts = "KO";
                }
                //返回
                WS_Reply(
                    conn,
                    {STS: sts},
                    _token
                );
                break;
            case "getPlugin":

            case "observe":
                _worker_observer.push(conn);
                var worker_list = WorkerManager.getWorkers();
                WS_Reply(
                    conn,
                    {STS: "OK", data: worker_list},
                    _token
                );
                break;
            case "list_wsw":
                WS_Reply(
                    conn,
                    {STS: "OK", data: WorkerManager.getWorkers()},
                    _token
                );
                break;
            case "ping":
                WS_Reply(
                    conn,
                    {
                        STS: WorkerManager.activeWorker(conn, _req._p) ? "OK" : "KO",
                        data: {ping: _req._p, pong: +(new Date())}
                    },
                    _token
                );
                break;
            default:
                WS_Reply(
                    conn,
                    {STS: "KO", MSG: "_m " + _req._c + "." + _req._m + " TODO"},
                    _token
                );
                break;
        }
    } else if (_req._c == "plugin") {
        switch (_req._m) {
            case "publish":
                var p = typeof _req._p == "string" ? s2o(_req._p) : _req._p;
                PluginManager.publish(p, function (err, installedWorkers) {
                    if (!!err) {
                        WS_Reply(
                            conn,
                            {STS: "KO", MSG: err},
                            _token
                        );
                    } else {
                        WS_Reply(
                            conn,
                            {STS: "OK"},
                            _token
                        );

                        for (var i = 0; i < installedWorkers.length; i++) {
                            var worker = WorkerManager.getAvailableWorker(installedWorkers[i], true);
                            var wsw_conn = worker ? worker.conn : null;
                            if (wsw_conn) {
                                WS_Request(wsw_conn, {
                                    _c: "worker",
                                    _m: "deprecatePlugin",
                                    _p: p.name
                                }, function () {

                                });
                            }
                        }
                    }
                });
                break;
            case "download":
                var worker = WorkerManager.getWorkerByConnection(conn);
                if (!worker) {
                    WS_Reply(
                        conn,
                        {STS: "KO", MSG: "Worker is unregistered"},
                        _token
                    );
                } else {
                    PluginManager.download(_req._p, worker.name, function (err, code) {
                        if (!!err) {
                            WS_Reply(
                                conn,
                                {STS: "KO", MSG: err},
                                _token
                            );
                        } else {
                            WS_Reply(
                                conn,
                                {STS: "OK", data: {code: code}},
                                _token
                            );
                        }
                    });
                }
                break;
            default:
                WS_Reply(
                    conn,
                    {STS: "KO", MSG: "_m " + _req._c + "." + _req._m + " TODO"},
                    _token
                );
                break;
        }
    } else if (_req._c == "client") {
        switch (_req._m) {
            case "OnWSClientOpen":
                WS_Reply(
                    conn,
                    {
                        STS: "OK",
                        data: {ping: _req.ping, pong: +(new Date())}
                    },
                    _token
                );
                break;
            default:
                WS_Reply(
                    conn,
                    {STS: "KO", MSG: "_m " + _req._c + "." + _req._m + " TODO"},
                    _token
                );
                break;
        }
    } else {
        var worker = WorkerManager.getAvailableWorker(_req.pipe, true);
        var wsw_conn= worker ? worker.conn : null; //TODO 权限问题(考虑先行一个登陆持有验证code？auth2.0?)
        if(!wsw_conn) {
            WS_Reply(
                conn,
                {STS: "KO", errcode:4002, errmsg:"未找到可用的 worker "+_req.pipe},
                _token
            );
            return;
        }
        if(_req.user_key) {   // User Key
            _req._d = UserKey.getUserKey(_req.user_key);
        }
        var req_time = (new Date()).pattern("hh:mm:ss.S");
        WS_Request(wsw_conn,_req,function(rto){
            if (_req.user_key && rto._d) {
                UserKey.setUserKey(_req.user_key, rto._d);
                delete rto._d;
            }
            rto.req_time = req_time;
            rto.rsp_time = (new Date()).pattern("hh:mm:ss.S");
            rto.pipe = worker.name;

            WS_Reply(
                conn,
                rto,
                _token
            );
            //TODO gzip
        });
    }
}
/////////////////////////////////////////////////////////
var _client_conn_a={};//buffer of conn
function Main(){
    if(!ws){
        _d_("nodejs-websocket api needed");
        process.exit(2);
    }
    //_d_(process.versions);
    //_d_(process.config);
    _d_("pid=",process.pid);
    process.on("exit",function(){
        process.nextTick(function(){
            _d_('This will not run');
        });
        _d_('About to exit.');
    });

    //argv返回的是一组包含命令行参数的数组。第一项为”node”，第二项为执行的js的完整路径，后面是附加在命令行后的参数
    //@ref: http://www.nodecn.org/process.html#process.argv
    var args= process.argv.splice(2);
    //_d_(args);
    var _port=args[0];
    var _name=args[1];
    if(_port>1024){
    }else{
        _d_("port incorrect:"+_port);
        process.exit(3);//外面针对 3不做循环
    }

    try{
        ws.setMaxBufferLength(20971520);
        var ws_server = ws.createServer(
            //TODO 加密 tls
            //@ref: http://nodejs.org/api/tls.html
            //{"secure":true},//options pfx,key...

            // function(conn){
            // 	var _addr=(conn.socket.remoteAddress);
            // 	var _port=(conn.socket.remotePort);
            // 	var _key=""+_addr+":"+_port;
            // 	_d_("on conn "+_key);

            // 	conn.key=_key;//用IP加PORT的方法来识别每个conn

            // 	_client_conn_a[_key]=conn;

            // 	conn.on("error", function (e){
            // 		_d_("ws_server.conn.error",e);
            // 	});
            // 	conn.on("text", function (data_s) {
            // 		try{
            // 			WS_OnMessage(conn,data_s,BusinessLogic);
            // 		}catch(ex){
            // 			_d_("conn.text.err",ex);
            // 			WS_Send_Raw(conn,o2s({
            // 				token:s2o(data_s).token,resp:{errcode:999,errmsg:ex.message}}
            // 			));
            // 		}
            // 	});
            // 	conn.on("close", function (code, reason){
            // 		//clean up
            // 		_client_conn_a[_key]=null;
            // 		delete _client_conn_a[_key];

            // 		_d_("ws_server.close="+code+","+reason,"key="+this.key);
            // 	});
            // }
        );

        ws_server.on('connection',function(conn){
            //TODO 加密 tls
            //@ref: http://nodejs.org/api/tls.html
            //{"secure":true},//options pfx,key...
            var _addr=(conn.socket.remoteAddress);
            var _port=(conn.socket.remotePort);
            var _key=""+_addr+":"+_port;
            _d_("on conn "+_key);

            conn.key=_key;//用IP加PORT的方法来识别每个conn

            _client_conn_a[_key]=conn;

            conn.on("error", function (e){
                _d_("ws_server.conn.error",e);
            });
            conn.on("text", function (data_s) {
                _d_("on text",data_s);
                try{
                    WS_OnMessage(conn,data_s,BusinessLogic);
                }catch(ex){
                    _d_("conn.text.err",ex);
                    try {
                        var data_o = s2o(data_s);
                        if (data_o.token) {
                            WS_Reply(
                                conn,
                                {STS: "KO", errcode:999, errmsg:ex.message},
                                data_o.token
                            );
                        }
                    } catch(ex2) {
                        _d_("conn.reply.err",ex2);
                    }
                }
            });
            conn.on("close", function (code, reason){
                //clean up
                _client_conn_a[_key]=null;
                delete _client_conn_a[_key];

                _d_("ws_server.close="+code+","+reason,"key="+this.key);
            });
        });
        ws_server.on('error', function(e){
            _d_("ws_server.error",e);
            if (e.code == 'EADDRINUSE'){
                _d_('Address in use');
                process.exit(3);
            }
        });
        _d_(_name +" listen on "+_port);
        ws_server.listen(_port);
    }catch(e){
        _d_(_name +" ProcStartServer.e=",e);
    }
}
Main();

//npm http GET https://registry.npmjs.org/nodejs-websocket
//npm http 200 https://registry.npmjs.org/nodejs-websocket
//npm http GET https://registry.npmjs.org/nodejs-websocket/-/nodejs-websocket-0.1.5.tgz
//npm http 200 https://registry.npmjs.org/nodejs-websocket/-/nodejs-websocket-0.1.5.tgz
//nodejs-websocket@0.1.5 node_modules\nodejs-websocket
