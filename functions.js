var path = require('path');
var mysql = require('mysql');
var Q = require('q');
var CONF = require(path.join(__dirname, 'conf'));
var debug = require('debug')('MoviePush');
var connection = mysql.createConnection({
  user : CONF.DB_USER,
  password : CONF.DB_PASS,
  socketPath: CONF.DB_PATH,
  database: CONF.DB_NAME,
});

exports.localAuth = function(username, password) {
  var deferred = Q.defer();
  connection.query(CONF.QRY_USER_LOGIN, [username, password], function(err, result) {
    if (err) {
      debug('login error');
      deferred.reject(new Error(err));
    } else if (result.length > 0) {
      debug('login success');
      deferred.resolve(result[0]);
    } else {
      debug('login no user');
      deferred.resolve(false);
    }
  });
  return deferred.promise;
}

exports.getDevice = function(username) {
  debug(username);
  var deferred = Q.defer();
  var qry = "select uid,case when devicetype='I' then 'iPhone' else 'Android' end as type"+
            ", substring(deviceid,1,12) as deviceid from movie_push where uid=?";
  connection.query(qry, username, function(err, result) {
    if (err) {
      debug('db error');
      deferred.reject(new Error(err));
    } else if (result.length > 0) {
      deferred.resolve(result);
    } else {
      deferred.resolve(false);
    }
  });
  return deferred.promise;
}

exports.getPushUser = function(username) {
  debug("getPushUser: "+username);
  var deferred = Q.defer();
  var qry = "select uid,devicetype,deviceid from user_info ui join push_user pu on ui.idx=pu.receiver where uid=?";
  connection.query(qry, username, function(err, result) {
    if (err) {
      debug('db error');
      deferred.reject(new Error(err));
    } else if (result.length>0) {
      deferred.resolve(result);
    } else {
      deferred.resolve(false);
    }
  });
  return deferred.promise;
}

exports.getMoviePush = function(uid, deviceid) {
  debug("getMoviePush: "+uid+" "+deviceid);
  var deferred = Q.defer();
  var qry = "select uid,devicetype,deviceid from movie_push where uid=? and deviceid=?";
  connection.query(qry, [uid, deviceid], function(err, result) {
    if (err) {
      debug('db error');
      deferred.reject(new Error(err));
    } else if (result.length>0) {
      debug('deviceid '+result.length);
      deferred.resolve(result);
    } else {
      deferred.resolve(false);
    }
  });
  return deferred.promise;
}

exports.regMoviePush = function(uid) {
  debug("regMoviePush: "+uid);
  var deferred = Q.defer();
  var qry = "insert into movie_push(uid,devicetype,deviceid) "+
            " select uid,devicetype,deviceid from push_user pu join user_info ui on pu.receiver=ui.idx where ui.uid=?";
  connection.query(qry, uid, function(err, result) {
    if (err) {
      debug('db error');
      deferred.reject(new Error(err));
    } else {
      deferred.resolve(uid);
    }
  });
  return deferred.promise;
}

exports.delMoviePush = function (uid) {
  debug("delMoviePush: "+uid);
  var deferred = Q.defer();
  var qry = "delete from movie_push where uid=?";
  connection.query(qry, uid, function(err, result) {
    if (err) {
      debug('db error');
      deferred.reject(new Error(err));
    } else {
      deferred.resolve(uid);
    }
  });
  return deferred.promise;
}
