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

function view(file, ctx){
	var tpl = swig.compileFile(file);
	return tpl.render(ctx);
}

var app = connect(quip())
	.use(connect.static(__dirname + '/public'))
	.use(connect.cookieParser('Archimedes'))
	.use(connect.session({ secret: 'Merlin had an Owl, hoot hoot!'}))
	.use(connect.bodyParser())
	.use(dispatch({
		'/auth':{
			'GET /register': function(req,res,next){
				res.ok(view('register.html'));
			},
			'GET /login': function(req,res,next){
				res.ok(view('login.html'));
			},
			'GET /logout': function(req,res,next){},
			'POST': function(req,res,next){
				// attempt login
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
			res.ok(view('index.html'));
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