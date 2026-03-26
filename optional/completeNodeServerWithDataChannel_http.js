var static = require('node-static');
var http = require('http');

// Create a node-static server instance
var file = new(static.Server)();

var PORT = process.env.PORT || 8080;

var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(PORT, '0.0.0.0', () => {
  console.log('>>> Signalling server is listening on http://0.0.0.0:' + PORT);
});

// Use socket.io JavaScript library for real-time web applications
var io = require('socket.io')(app);

// Let's start managing connections...
io.sockets.on('connection', function (socket) {

  socket.on('create or join', function (room) {
    var numClients = io.sockets.adapter.rooms.get(room) ? io.sockets.adapter.rooms.get(room).size : 0;

    console.log('S --> Room ' + room + ' has ' + numClients + ' client(s)');
    console.log('S --> Request to create or join room', room);

    if (numClients == 0) {
      socket.join(room);
      socket.emit('created', room);
    } else if (numClients == 1) {
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room);
    } else {
      socket.emit('full', room);
    }
  });

  socket.on('message', function (message) {
    console.log('S --> got message: ', message);
    socket.broadcast.to(message.channel).emit('message', message);
  });

  function log() {
    var array = [">>> "];
    for (var i = 0; i < arguments.length; i++) {
      array.push(arguments[i]);
    }
    socket.emit('log', array);
  }

});
