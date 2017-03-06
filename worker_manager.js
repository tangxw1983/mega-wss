/**
 * Created by tang on 2016/5/26.
 */

var _worker_conn_a = {};
var _worker_name_queue = [];    // 用于循环分配worker

var _on_worker_changed_handler = [];

var C_WORKER_INVALID_TIME = 60;      // worker失效时间，单位秒，要根据worker的ping-pong频率设定

/**
 * 移除Worker
 * @param worker
 */
function removeWorker(worker) {
    if (!worker) return;
    if (worker.conn) worker.conn.close();
    delete(_worker_conn_a[worker.name]);

    for (var i= 0,c = _on_worker_changed_handler.length;i<c;i++) {
        if (typeof _on_worker_changed_handler[i] == "function") {
            _on_worker_changed_handler[i]({action: "delete", worker_name: worker.name});
        }
    }
}

/**
 * 检查worker是否可用
 * 1. 连接的状态是否可用
 * 2. 最后一次ping的时间是否过长
 *
 * @param worker  worker对象
 * @return bool   是否可用
 */
function isWorkerAvaiable(worker) {
    if (!worker) return false;
    if (!worker.conn) return false;
    if (worker.conn.readyState != 1 && worker.conn.readyState != 0) return false;   // 连接状态不可用
    if (worker.last_active_server_time < (new Date()) - C_WORKER_INVALID_TIME * 1000) return false;   // worker已过失效期

    return true;
}

/**
 * 保存登录的worker
 *
 * @param name  worker名称
 * @param conn  worker的连接
 * @param type  worker类型，用于指定某些专门完成一类任务的worker，如果为空，代表可以完成任何种类的任务
 */
function registerWorker(name,conn,type) {
    //TODO worker需要登陆检查
    //var f_pass_check=Worker_Login(_user,_pwd);
    //if(f_pass_check){
    //	conn.user=_user;
    //	//conn.pwd=_pwd;
    //}else{
    //	conn.loginerror="Worker_Login error";
    //}

    // name是唯一的，如果存在同名的worker并且可用，新的连接不能注册
    var worker = _worker_conn_a[name];
    if (worker) {
        if (isWorkerAvaiable(name)) return false;

        // 连接已经不可用，关闭连接
        removeWorker(worker);
    }

    _worker_conn_a[name] = {
        name: name,
        conn: conn,
        type: type,
        last_active_server_time: +(new Date())        // 最后活跃时间
    };
    _worker_name_queue.push(name);

    for (var i= 0,c = _on_worker_changed_handler.length;i<c;i++) {
        if (typeof _on_worker_changed_handler[i] == "function") {
            _on_worker_changed_handler[i]({action: "new", worker_name: name, worker_type: type, last_active_time: _worker_conn_a[name].last_active_server_time});
        }
    }

    return true;
}

function getWorkerByConnection(conn) {
    for (var k in _worker_conn_a) {
        var worker = _worker_conn_a[k];
        if (worker && worker.conn == conn) {
            if (isWorkerAvaiable(worker)) {
                return worker;
            } else {
                removeWorker(worker);
                return null;
            }
        }
    }
    return null;
}

/**
 * 维持Worker在线
 *
 * @param conn Worker的连接
 */
function activeWorker(conn,client_time) {
    var worker = getWorkerByConnection(conn);
    if (worker) {
        if (!worker.last_active_client_time || worker.last_active_client_time < client_time) {
            worker.last_active_server_time = +(new Date());
            worker.last_active_client_time = client_time;

            for (var i= 0,c = _on_worker_changed_handler.length;i<c;i++) {
                if (typeof _on_worker_changed_handler[i] == "function") {
                    _on_worker_changed_handler[i]({action: "active", worker_name: worker.name, last_active_time: worker.last_active_server_time});
                }
            }

            return true;
        } else {
            return false;
        }
    } else {
        return false;
    }
}

/**
 * 获得可用的worker
 *
 * @param name  worker的名称，不指定则自动分配
 * @param is_accept_alloc  name指定worker不存在或不可用时，是否接受自动分配一个worker
 * @param type  is_accept_alloc为true时有效，指定需要支持的类型。即worker.type=type|空
 */
function getAvailableWorker(name, is_accept_alloc, type) {
    if (name) {
        var worker = _worker_conn_a[name];
        if (!worker) {
            return is_accept_alloc ? autoAllocWorker(type) : null;
        } else if (!isWorkerAvaiable(worker)) {
            // 从worker表中删除
            removeWorker(worker);

            return is_accept_alloc ? autoAllocWorker(type) : null;
        } else {
            return worker
        }
    } else {
        return autoAllocWorker(type);
    }
}

/**
 * 自动分配worker
 *
 * @param type 需要支持的类型
 */
function autoAllocWorker(type) {
    for (var i = 0, c = _worker_name_queue.length; i < c; c--) {
        var name = _worker_name_queue[i];
        var worker = name ? _worker_conn_a[name] : null;
        if (!worker || !isWorkerAvaiable(worker)) {
            // name无效，从队列中删除
            _worker_name_queue.splice(i, 1);
        } else if (!type || !worker.type || worker.type == type) {
            // 将选中的worker name从原位置移到队尾
            _worker_name_queue.splice(i, 1);
            _worker_name_queue.push(name);
            return worker;
        } else {
            // 只是type不匹配，队列不做改变，检查下一个元素
            i++;
            c++;
        }
    }

    return null;
}

/**
 * 获得Worker列表
 */
function getWorkers() {
    var ret = [];
    for(var n in _worker_conn_a) {
        ret.push({
            worker_name: n,
            worker_type: _worker_conn_a[n].type,
            available: isWorkerAvaiable(_worker_conn_a[n]),
            last_active_time: _worker_conn_a[n].last_active_server_time
        })
    }
    return ret;
}

function addWorkerChangedHandler(func) {
    _on_worker_changed_handler.push(func);
}

function removeWorkerChangedHandler(func) {
    for (var i = 0; i < _on_worker_changed_handler.length; i++) {
        if (_on_worker_changed_handler[i] == func) {
            _on_worker_changed_handler.splice(i, 1);
            i--;
        }
    }
}

if(typeof(exports)!="undefined"){
    exports.getAvailableWorker = getAvailableWorker;
    exports.registerWorker = registerWorker;
    exports.activeWorker = activeWorker;
    exports.autoAllocWorker = autoAllocWorker;
    exports.getWorkers = getWorkers;
    exports.addWorkerChangedHandler = addWorkerChangedHandler;
    exports.removeWorkerChangedHandler = removeWorkerChangedHandler;
    exports.getWorkerByConnection = getWorkerByConnection;
}