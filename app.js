var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var exphbs = require('express-handlebars');
var methodOverride = require('method-override');
var session = require('cookie-session');
var passport = require('passport');
var LocalStrategy = require('passport-local');
var debug = require('debug')('MoviePush');

var port = 8000;
var app = express();

var funct = require(path.join(__dirname, 'functions.js'));

//===============PASSPORT=================

// Passport session setup.
passport.serializeUser(function(user, done) {
  debug("serializing " + user.username);
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  debug("deserializing " + obj);
  done(null, obj);
});

// Use the LocalStrategy within Passport to login users.
passport.use('local-signin', new LocalStrategy(
  { passReqToCallback: true }, //allows us to pass back the request to the callback
  function(req, username, password, done) {
    funct.localAuth(username, password)
    .then(function (user) {
      if (user) {
        debug("LOGGED IN AS: " + user.username);
        req.session.success = 'You are successfully logged in ' + user.username + '!';
        done(null, user);
      } else {
        debug("COULD NOT LOG IN");
        req.session.error = 'Could not log user in. Please try again.'; //inform user could not log them in
        done(null, user);
      }
    })
    .fail(function (err){
      debug(err.body);
      req.session.error = 'unknown error!';
      done(null, false);
    });
  }
));

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  req.session.error = 'Please sign in!';
  res.redirect('/');
}


//===============EXPRESS=================
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(methodOverride('X-HTTP-Method-Override'));
app.use(session({secret: 'moviepush'}));
app.use(passport.initialize());
app.use(passport.session());

// Session-persisted message middleware
app.use(function(req, res, next){
  var err = req.session.error,
      msg = req.session.notice,
      success = req.session.success;

  delete req.session.error;
  delete req.session.success;
  delete req.session.notice;

  if (err) res.locals.error = err;
  if (msg) res.locals.notice = msg;
  if (success) res.locals.success = success;

  next();
});

// Configure express to use handlebars templates
exphbs.ExpressHandlebars.prototype.layoutsDir = path.join(__dirname, 'views/layouts');
var hbs = exphbs.create({
  defaultLayout: 'main', //we will be creating this layout shortly
});
app.engine('handlebars', hbs.engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'handlebars');

app.get('/', function(req, res){
  if (req.user) res.redirect('/user');
  else res.render('home');
});

app.get('/user', function(req, res){
  debug('req.user');
  debug(req.user);
  debug(req.session);
  if (req.user) {
    funct.getDevice(req.user.username)
    .then(function (device) {
      debug(device);
      res.render('user', {user: req.user, device: device});
    })
    .fail(function (err){
      debug('getDevice: '+err.body);
      res.locals.error = 'unknown error!';
      res.render('user', {user: req.user, device: false});
    });
  } else {
    res.locals.notice = '로그인이 필요합니다!';
    res.render('user', {user: false});
  }
});

app.get('/reg_push', function(req, res){
  if (!req.user) {
    res.locals.notice = '로그인이 필요합니다!';
    return res.render('user', {user: false});
  }

  funct.getPushUser(req.user.username)
  .then(function (device) {
    debug('-- device');
    debug(device);
    if (!device) {
      res.locals.notice = 'OfficeHard 앱 로그인이 필요합니다.';
      return res.render('user', {user: req.user, device: false});
    }
    funct.getMoviePush(device[0].uid,device[0].deviceid)
    .then(function (mdevice) {
      debug('-- mdevice');
      debug(mdevice);
      if (mdevice) {
        return res.redirect('/user');
      }
      funct.regMoviePush(req.user.username)
      .then(function(muid) {
        req.session.success = 'MoviePush 등록이 완료되었습니다.';
        return res.redirect('/user');
      })
      .fail(function (err){
        debug('regMoviePush: '+err.body);
        res.locals.error = 'MoviePush 등록이 실패하였습니다. 다시 시도해주세요.';
        return res.render('user', {user: req.user, device: false});
      });
    })
    .fail(function (err){
      debug('getMoviePush: '+err.body);
      res.locals.error = 'unknown error!';
      return res.render('user', {user: req.user, device: false});
    });
  })
  .fail(function (err){
    debug('getDevice: '+err.body);
    res.locals.error = 'unknown error!';
    return res.render('user', {user: req.user, device: false});
  });
});

app.get('/del_push', function(req, res){
  if (req.user) {
    funct.delMoviePush(req.user.username)
    .then(function (del_user) {
      debug('delMoviePush: '+del_user);
      res.redirect('/user');
    })
    .fail(function (err){
      debug('delMoviePush: '+err.body);
      res.locals.error = 'unknown error!';
      res.render('user', {user: req.user, device: false});
    });
  } else {
    res.locals.notice = '로그인이 필요합니다!';
    res.render('user', {user: false});
  }
});

//sends the request through our local login/signin strategy, and if successful takes user to homepage, otherwise returns then to signin page
app.post('/login', passport.authenticate('local-signin', { successRedirect: '/user', failureRedirect: '/'}));

//logs user out of site, deleting them from the session, and returns to homepage
app.get('/logout', function(req, res){
  if (req.user) {
    var name = req.user.username;
    debug("LOGGED OUT " + name)
    req.session.notice = "You have successfully been logged out " + name + "!";
  }
  req.logout();
  res.redirect('/');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

module.exports = app;
