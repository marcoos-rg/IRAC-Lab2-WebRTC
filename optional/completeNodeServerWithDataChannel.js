var static = require('node-static');

var http = require('http');

// Use the PORT environment variable provided by Render, or default to 8080
var port = process.env.PORT || 8080;

// Create a node-static server instance
var file = new(static.Server)();

// We use the http module's createServer function
var app = http.createServer(function (req, res) {
  file.serve(req, res);
}).listen(port, '0.0.0.0', () => { 
  console.log('>>> Signalling server is listening on port ' + port);
});

// Use socket.io JavaScript library for real-time web applications
var io = require('socket.io')(app);

// Let's start managing connections...
io.sockets.on('connection', function (socket){


  socket.on('create or join', function (room) { // Handle 'create or join' messages
    var numClients = io.sockets.adapter.rooms.get(room)?io.sockets.adapter.rooms.get(room).size:0;

    console.log('S --> Room ' + room + ' has ' + numClients + ' client(s)');
    console.log('S --> Request to create or join room', room);

    if(numClients == 0){ // First client joining...
      socket.join(room);
      socket.emit('created', room);
    } else if (numClients == 1) { // Second client joining...
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room);
    } else { // max two clients
      socket.emit('full', room);
    }
  });

  socket.on('message', function (message) { // Handle 'message' messages
    console.log('S --> got message: ', message);
    // channel-only broadcast...
    socket.broadcast.to(message.channel).emit('message', message);
  });

  function log(){
    var array = [">>> "];
    for (var i = 0; i < arguments.length; i++) {
      array.push(arguments[i]);
    }
    socket.emit('log', array);
  }

});
