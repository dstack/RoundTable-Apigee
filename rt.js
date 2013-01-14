var connect = require('connect'),
	dispatch = require('dispatch'),
	passport = require('passport'),
	quip = require('quip'),
	usergrid = require('usergrid'),
	swig = require('swig'),
	keys = require(__dirname + '/keys');

swig.init({
	cache: false,
	encoding: 'utf8',
	filters: {},
	root: __dirname + '/tpl',
	extensions: {}
});

var client = new usergrid.client({
	orgName:      keys['apigee-orgName'],
	appName:      keys['apigee-appName'],
	authType:     usergrid.AUTH_CLIENT_ID,
    clientId:     keys['apigee_clientId'],
    clientSecret: keys['apigee_clientSecret']
});

function view(file, ctx){
	var tpl = swig.compileFile(file);
	return tpl.render(ctx);
}

var app = connect(quip())
	.use(connect.static(__dirname + '/public'))
	.use(connect.cookieParser('Archimedes'))
	.use(connect.session({ secret: 'Merlin had an Owl, hoot hoot!'}))
	.use(connect.bodyParser())
	.use(function(req,res,next){
		req.ctx = {
			user: req.session && req.session.user? req.session.user : false
		};
		next();
	})
	.use(dispatch({
		'/auth':{
			'GET /register': function(req,res,next){
				res.ok(view('register.html'));
			},
			'GET /login': function(req,res,next){
				res.ok(view('login.html'));
			},
			'GET /logout': function(req,res,next){
				req.session.user = false;
				client.logout();
				client.authType = usergrid.AUTH_CLIENT_ID;
				res.redirect('/')
			},
			'POST /register': function(req,res,next){
				var formBody = req.body;
				// email, password, passwordConfirm
				if(formBody.email && formBody.password && formBody.passwordConfirm && formBody.password == formBody.passwordConfirm){
					client.request({
						method:'POST',
						endpoint:'users',
						body:{ username: formBody.email, password: formBody.password }
					}, function(err, data){
						if(err){
							req.ctx.errors = [{msg: JSON.stringify(err)}];
							res.ok(view('register.html', req.ctx));
						}else{
							if(formBody.email && formBody.password){
								client.login(formBody.email, formBody.password, function(err){
									if(err){
										req.ctx.errors = [{msg: 'No such user'}]
										res.ok(view('login.html', req.ctx));
										return;
									}
									client.authType = usergrid.AUTH_APP_USER;
									client.getLoggedInUser(function(err, data, user){
										if(err){
											console.log('could not get logged in user');
										} else {
											//you can then get info from the user entity object:
											req.session.user = user;
											res.redirect('/');
										}
									});
								});
							}
							else{
								req.ctx.errors = [{msg: 'Form is incomplete'}]
								res.ok(view('register.html', req.ctx));
							}
						}
					});
				}
				else{
					req.ctx.errors = [{msg: 'Form is incomplete'}]
					res.ok(view('register.html', req.ctx));
				}
			},
			'POST': function(req,res,next){
				var formBody = req.body;
				// email, password
				if(formBody.email && formBody.password){
					client.login(formBody.email, formBody.password, function(err){
						if(err){
							req.ctx.errors = [{msg: 'No such user'}]
							res.ok(view('login.html', req.ctx));
							return;
						}
						client.authType = usergrid.AUTH_APP_USER;
						client.getLoggedInUser(function(err, data, user){
							if(err){
								console.log('could not get logged in user');
							} else {
								//you can then get info from the user entity object:
								req.session.user = user;
								res.redirect('/');
							}
						});
					});
				}
				else{
					req.ctx.errors = [{msg: 'Form is incomplete'}]
					res.ok(view('register.html', req.ctx));
				}
			}
		},
		'/presentations': {
			'GET': function(req,res,next){
				res.error('Stop doing that');
			},
			'POST': function(req,res,next){
				res.error('Stop doing that');
			},
			':/id':{
				'GET': function(req,res,next,id){},
				'PUT': function(req,res,next,id){},
				'DELETE': function(req,res,next,id){},
			}
		},
		'/new-rt/:presID': function(req,res,next,presID){
			res.error('Stop doing that');
		},
		'/present-rt/:presID': function(req,res,next,presID){
			res.error('Stop doing that');
				
		},
		'/watch/:presID': function(req,res,next,presID){
			res.error('Stop doing that');
				
		},
		'/round-tables': {
			'GET': function(){},
			'POST': function(req,res,next){},
			':/id':{
				'GET': function(req,res,next,id){},
				'PUT': function(req,res,next,id){},
				'DELETE': function(req,res,next,id){},
			}
		},
		'.+': function(req,res,next){
			res.ok(view('index.html', req.ctx));
		}
	}))


var server = app.listen(4295);

console.log('Round table listening on http://localhost:4295')

var io = require('socket.io').listen(server);

// socket.io config
io.enable('browser client minification');
io.enable('browser client etag');
io.enable('browser client gzip');
io.set('log level', 0);
io.set('transports', [
	'websocket'
	, 'flashsocket'
	, 'htmlfile'
	, 'xhr-polling'
	, 'jsonp-polling'
]);

// this is where the real time happens

io.sockets.on('connection', function(socket){
	console.log('socket connected');
	socket.on('present-rt', function(data){
		socket.join(data.rtid);
		socket.set('presenting-on', data.rtid, function(){
			socket.emit('ready-to-present')
		});
	});
	socket.on('show-connect-data', function(data){
		//io.sockets.in(data.rtid).emit
		//var id = data.rtid;
		console.log('show connection data');
		socket.broadcast.emit('toggle-connect-data', data)
	});
	socket.on('join', function(data){
		socket.join(data.rtid);
	});
	socket.on('go-to-next', function(data){
		socket.broadcast.emit('next', data)
	});
	socket.on('go-to-prev', function(data){
		socket.broadcast.emit('prev', data)
	});
	socket.on('interrupt', function(data){
		socket.broadcast.emit('interrupt', data)
		//get the interupt text and interrupt user,
		// cycle this event to ONLY the presenter socket
	});
	socket.on('go-interrupt', function(data){
		console.log('sending interrupt to the front end');
		socket.broadcast.emit('show-interrupt', data)
	})
});