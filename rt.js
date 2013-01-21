var connect = require('connect'),
	dispatch = require('dispatch'),
	passport = require('passport'),
	quip = require('quip'),
	usergrid = require('usergrid'),
	swig = require('swig'),
	keys = require(__dirname + '/keys'),
	PATH = require('path'),
	fs   = require('fs'),
	tnr  = require('2nr13');

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

function getDeckBySessionId(id, cb){
	client.request({
		method: 'GET',
		endpoint: 'deckSessions',
		uuid: id
	},function(err,data){
		if(err){ cb('not a real deck session'); return; }
		var deckId = data.entities[0].relatedDeck;
		client.request({
			method: 'GET',
			endpoint: 'decks',
			uuid: deckId
		},function(error,data){
			if(error){ cb('not a real deck'); return; }
			var deck = data.entities[0];
			var deckFile = deck.fileName;
			fs.readFile(__dirname+'/ups/'+deckFile, 'utf8', function(error2,data){
				if(error2){ cb('unable to read deck file'); return; }
				cb(false, deck, data);
			});
		});
	});
}

function logDeckSessionEvent(id, eventData){
	var ts = Date.NOW,
		ropt = {
		method: 'PUT',
		endpoint: 'deckSessions',
		uuid: id,
		body:{}
	};
	ropt.body['evt-'+ts] = eventData;
	client.request(ropt,function(err,deckSession){
		if(err){
			return console.log('unable to log deck session details');
		}
	});
}
var roomsWithControllers = new Array();
var io;
var app = connect(quip())
	.use(connect.multipart({ uploadDir: __dirname + '/ups' }))
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
								req.session.user = data.entities[0];
								res.redirect('/presentations');
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
				client.createCollection({
					type: 'decks',
					ql: 'where fromUser = \'' + req.session.user.uuid + '\' order by index'
				}, function(err, decks){
					if(err){
						res.error('unable to get presentations');
						return;
					}
					req.ctx.presentations = new Array();
					while(decks.hasNextEntity()) {
						var deck = decks.getNextEntity()._data;
						req.ctx.presentations.push(deck);
					}
					res.ok(view('my-profile.html', req.ctx));
				});
			},
			'POST': function(req,res,next){
				var tup = req.files.file;
				var upa = tup.path.split(PATH.sep),
					ufn = upa[upa.length - 1];

				var deck = {
					type: 'decks',
					name: tup.name,
					fromUser: req.session.user.uuid,
					fileName: ufn
				};
				// fire and forget, create deck
				client.createEntity(deck, function(err,data){});
				res.redirect('/presentations');
			}
		},
		'/set-the-table/:id': function(req,res,next,id){
			client.request({
				method: 'GET',
				endpoint: 'decks',
				uuid: id
			}, function(err, data){
				if(err){
					res.error('failed to load presentation ' + id)
				}
				// there should be exactly 1 entities
				var deck = data.entities[0];
				req.session.currentDeck = deck;
				var deckSession = {
					type: 'deckSessions',
					relatedDeck: deck.uuid
				};
				// fire and forget, create deck
				client.createEntity(deckSession, function(err,data){
					if(err){ res.error('Could not set the table'); return; }
					var roomId = data._data.uuid;
					req.session.currentDeckRoom = roomId
					req.session.presentSecret = tnr.encode(roomId);
					res.redirect('/big-screen/'+roomId);
					//setup the socket.io namespace
					io
						.of('/'+roomId)
						.on('connection', function(socket){
							socket.on('show-connect-data', function(){
								socket.broadcast.emit('toggle-connect-data');
							});
							socket.on('go-to-next', function(){
								socket.broadcast.emit('next');
								socket.emit('next');
								logDeckSessionEvent(roomId, {
									evtName: 'next'
								});
							});
							socket.on('go-to-prev', function(){
								socket.broadcast.emit('prev');
								socket.emit('prev');
								logDeckSessionEvent(roomId, {
									evtName: 'prev'
								});
							});
							socket.on('interrupt', function(data){
								socket.broadcast.emit('interrupt', data);
								logDeckSessionEvent(roomId, {
									evtName: 'interrupt',
									evtData: data
								});
							});
							socket.on('go-interrupt', function(data){
								console.log('sending interrupt to the front end');
								socket.broadcast.emit('show-interrupt', data);
								logDeckSessionEvent(roomId, {
									evtName: 'go-interrupt',
									evtData: data
								});
							});
							socket.on('check-for-controller', function(){
								if(roomsWithControllers.indexOf(roomId) < 0){
									socket.emit('no-controller');
								}
								else{
									socket.emit('yes-controller');
								}
							});
							socket.on('controller-connect', function(){
								socket.broadcast.emit('yes-controller');
								roomsWithControllers.push(roomId);
							})
						});
				});
			});
		},
		'/present/:id': function(req,res,next,id){
			getDeckBySessionId(id, function(err,deck,deckFile){
				req.ctx.deckContents = deckFile;
				req.ctx.deck = deck;
				req.ctx.room = id;
				res.ok(view('presenter.html',req.ctx))
			});
		},
		'/big-screen/:id': function(req,res,next,id){
			getDeckBySessionId(id, function(err,deck,deckFile){
				req.ctx.deckContents = deckFile;
				req.ctx.deck = deck;
				req.ctx.room = id;
				res.ok(view('presentation.html',req.ctx))
			});
		},
		'/view/:id': function(req,res,next,id){
			getDeckBySessionId(id, function(err,deck,deckFile){
				req.ctx.deckContents = deckFile;
				req.ctx.deck = deck;
				req.ctx.room = id;
				res.ok(view('viewer.html',req.ctx))
			});
		},
		'.+': function(req,res,next){
			res.ok(view('index.html', req.ctx));
		}
	}));


var server = app.listen(4295);
io = require('socket.io').listen(server);

console.log('Round table listening on http://localhost:4295')

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