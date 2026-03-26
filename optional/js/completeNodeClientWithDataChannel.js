'use strict';

// Clean-up function:
// collect garbage before unloading browser's window
window.onbeforeunload = function(e){
  hangup();
}

// Data channel information
var sendChannel, receiveChannel;
var sendButton = document.getElementById("sendButton");
var muteButton = document.getElementById("muteButton");
var sendTextarea = document.getElementById("dataChannelSend");
var chatMessages = document.getElementById("chatMessages");

// File transfer elements
var fileInput = document.getElementById("fileInput");
var sendFileButton = document.getElementById("sendFileButton");
var fileStatus = document.getElementById("fileStatus");
var fileProgress = document.getElementById("fileProgress");
var fileProgressInner = document.getElementById("fileProgressInner");

// HTML5 <video> elements
var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

// Mobile UI elements
var chatContainer = document.getElementById("chatContainer");
var fileSection = document.getElementById("fileSection");
var btnToggleChat = document.getElementById("btnToggleChat");
var btnToggleFiles = document.getElementById("btnToggleFiles");

// Handler associated with 'Send' button
sendButton.addEventListener('click', sendData);
sendFileButton.addEventListener('click', sendFile);

if (muteButton) {
  muteButton.addEventListener('click', toggleMute);
}

// Mobile toggle logic
if (btnToggleChat) {
  btnToggleChat.addEventListener('click', function() {
    chatContainer.classList.toggle('active');
    fileSection.classList.remove('active');
    btnToggleChat.classList.toggle('active');
    if (btnToggleFiles) btnToggleFiles.classList.remove('active');
  });
}

if (btnToggleFiles) {
  btnToggleFiles.addEventListener('click', function() {
    fileSection.classList.toggle('active');
    chatContainer.classList.remove('active');
    btnToggleFiles.classList.toggle('active');
    if (btnToggleChat) btnToggleChat.classList.remove('active');
  });
}

// Flags...
var isChannelReady = false;
var isInitiator = false;
var isStarted = false;

// WebRTC data structures
// Streams
var localStream;
var remoteStream;
// Peer Connection
var pc;

/*
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;

if (navigator.mozGetUserMedia) {
  console.log("This appears to be Firefox");
  webrtcDetectedBrowser = "firefox";
  webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);
}
else if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");
  webrtcDetectedBrowser = "chrome";
  webrtcDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);
else {
  console.log("This appears to be other Browser");
} */

/*
var pc_config = webrtcDetectedBrowser === 'firefox' ?
  // {'iceServers': [{'urls': 'stun:23.21.150.121'}]} :
  {'iceServers': [{'urls': 'stun:stun.services.mozilla.com'}]} :
  {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]
}; */

var pc_config = {
  'iceServers': [
    { 'urls': 'stun:stun.l.google.com:19302' },
    { 'urls': 'stun:stun1.l.google.com:19302' },
    {
      'urls': 'turn:openrelay.metered.ca:80',
      'username': 'openrelayproject',
      'credential': 'openrelayproject'
    },
    {
      'urls': 'turn:openrelay.metered.ca:443',
      'username': 'openrelayproject',
      'credential': 'openrelayproject'
    },
    {
      'urls': 'turn:openrelay.metered.ca:443?transport=tcp',
      'username': 'openrelayproject',
      'credential': 'openrelayproject'
    }
  ]
};

var pc_constraints = {
  'optional': [ {'DtlsSrtpKeyAgreement': true} ]
};

// Session Description Protocol constraints:
var sdpConstraints = {};

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}

/////////////////////////////////////////////
// Let's get started: prompt user for input (room name)
var room = prompt('Enter room name:');

var urlServer = location.origin;
console.log("socket.io client connecting to server ", urlServer );
// Connect to signalling server
var socket = io.connect(urlServer);

// Send 'Create or join' message to singnalling server
if (room !== '') {
  console.log('Create or join room', room);
  socket.emit('create or join', room);
}

// Set getUserMedia constraints
var constraints = {video: true, audio: true};

// From this point on, execution proceeds based on asynchronous events...

/////////////////////////////////////////////
// getUserMedia() handlers...
function handleUserMedia(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
  console.log('Adding local stream.');
  sendMessage('got user media');
  
  // Ensure mute button refers to the correct stream tracks
  if (muteButton) {
    muteButton.disabled = false;
  }
}

function handleUserMediaError(error){
  console.log('navigator.getUserMedia error: ', error);
}
/////////////////////////////////////////////
// Server-mediated message exchanging...

/////////////////////////////////////////////
// 1. Server-->Client...

// Handle 'created' message coming back from server:
// this peer is the initiator
socket.on('created', function (room){
  console.log('Created room ' + room);
  isInitiator = true;

  // Call getUserMedia()
  navigator.mediaDevices.getUserMedia(constraints).then(handleUserMedia).catch(handleUserMediaError);
  console.log('Getting user media with constraints', constraints);

  checkAndStart();
});

// Handle 'full' message coming back from server:
// this peer arrived too late :-(
socket.on('full', function (room){
  console.log('Room ' + room + ' is full');
});

// Handle 'join' message coming back from server:
// another peer is joining the channel
socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

// Handle 'joined' message coming back from server:
// this is the second peer joining the channel
socket.on('joined', function (room){
  console.log('This peer has joined room ' + room);
  isChannelReady = true;

  // Call getUserMedia()
  navigator.mediaDevices.getUserMedia(constraints).then(handleUserMedia).catch(handleUserMediaError);
  console.log('Getting user media with constraints', constraints);
});

// Server-sent log message...
socket.on('log', function (array){
  console.log.apply(console, array);
});

// Receive message from the other peer via the signalling server
socket.on('message', function (message){
  console.log('Received message:', message);
  if (message.message === 'got user media') {
    checkAndStart();
  } else if (message.message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      checkAndStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message.message));
    doAnswer();
  } else if (message.message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message.message));
  } else if (message.message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.message.label,
      candidate:message.message.candidate});
    pc.addIceCandidate(candidate);
  } else if (message.message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});
////////////////////////////////////////////////
// 2. Client-->Server

// Send message to the other peer via the signalling server
function sendMessage(message){
  console.log('Sending message: ', message);
  socket.emit('message', {
              channel: room,
              message: message});
}

////////////////////////////////////////////////////
// Channel negotiation trigger function
function checkAndStart() {
  if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {
    createPeerConnection();
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }
}

/////////////////////////////////////////////////////////
// Peer Connection management...
function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);

    console.log("Adding local tracks to PeerConnection! Initiator: " + isInitiator);
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.onicecandidate = handleIceCandidate;
    console.log('Created RTCPeerConnnection with:\n' +
      '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
      '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }

  pc.ontrack = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;

  if (isInitiator) {
    try {
      // Create a reliable data channel
      sendChannel = pc.createDataChannel("sendDataChannel",
        {reliable: true});
      sendChannel.binaryType = 'arraybuffer';
      trace('Created send data channel');
    } catch (e) {
      alert('Failed to create data channel. ');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onmessage = handleMessage;
    sendChannel.onclose = handleSendChannelStateChange;
  } else { // Joiner
    pc.ondatachannel = gotReceiveChannel;
  }
}

// Data channel management
function sendData() {
  var data = sendTextarea.value;
  if (!data.trim()) return;

  var msg = { type: 'text', data: data };
  var msgString = JSON.stringify(msg);

  if(isInitiator) sendChannel.send(msgString);
  else receiveChannel.send(msgString);
  
  appendMessage(data, 'sent');
  sendTextarea.value = '';
  trace('Sent text: ' + data);
}

function appendMessage(text, side) {
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message ' + side;
  msgDiv.innerText = text;
  chatMessages.appendChild(msgDiv);
  
  // Use scrollIntoView for better reliability on some mobile browsers
  msgDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handlers...

function toggleMute() {
  console.log('toggleMute called');
  if (localStream) {
    var audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      alert('No audio track found in local stream.');
      return;
    }
    
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });

    if (audioTracks[0].enabled) {
      muteButton.innerText = "Mute";
      muteButton.classList.remove("muted");
    } else {
      muteButton.innerText = "Unmute";
      muteButton.classList.add("muted");
    }
    // Simple console log instead of alert for better mobile UX
    console.log('Audio ' + (audioTracks[0].enabled ? 'activated' : 'deactivated'));
  } else {
    console.warn('Local stream not available.');
  }
}

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.binaryType = 'arraybuffer';
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  if (typeof event.data === 'string') {
    try {
      var msg = JSON.parse(event.data);
      if (msg.type === 'text') {
        appendMessage(msg.data, 'received');
      } else if (msg.type === 'file-start') {
        incomingFileMetadata = msg;
        incomingFileBuffer = [];
        receivedSize = 0;
        fileStatus.innerText = 'Receiving file: ' + msg.name;
        fileProgress.style.display = 'block';
      } else if (msg.type === 'file-end') {
        const receivedBlob = new Blob(incomingFileBuffer);
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(receivedBlob);
        downloadLink.download = incomingFileMetadata.name;
        
        appendFileDownloadLink(incomingFileMetadata.name, downloadLink.href);
        
        fileStatus.innerText = 'File received: ' + incomingFileMetadata.name;
        fileProgress.style.display = 'none';
        incomingFileMetadata = null;
        incomingFileBuffer = [];
      }
    } catch (e) {
      // Fallback for simple strings
      appendMessage(event.data, 'received');
    }
  } else {
    // Binary data
    incomingFileBuffer.push(event.data);
    receivedSize += event.data.byteLength;
    if (incomingFileMetadata) {
      var percent = Math.round((receivedSize / incomingFileMetadata.size) * 100);
      fileProgressInner.style.width = percent + '%';
    }
  }
}

function appendFileDownloadLink(name, url) {
  var msgDiv = document.createElement('div');
  msgDiv.className = 'message received';
  msgDiv.innerHTML = `File received: <a href="${url}" download="${name}" style="color: #818cf8; text-decoration: underline;">${name}</a>`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

var incomingFileMetadata = null;
var incomingFileBuffer = [];
var receivedSize = 0;

function handleSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "Escribe un mensaje...";
    sendButton.disabled = false;
    fileInput.disabled = false;
    sendFileButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
    fileInput.disabled = true;
    sendFileButton.disabled = true;
  }
}

function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "Type a message...";
    sendButton.disabled = false;
    fileInput.disabled = false;
    sendFileButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
    fileInput.disabled = true;
    sendFileButton.disabled = true;
  }
}

// File sending logic
var fileReader = new FileReader();
var chunkCount = 0;
const CHUNK_SIZE = 16384; 

function sendFile() {
  var file = fileInput.files[0];
  if (!file) {
    alert('Please select a file first');
    return;
  }
  
  console.log('Starting file send:', file.name, 'size:', file.size);
  if (!sendChannel || sendChannel.readyState !== 'open') {
    if (!receiveChannel || receiveChannel.readyState !== 'open') {
      alert('Data channel not open. Wait for connection.');
      return;
    }
  }

  fileStatus.innerText = 'Sending: ' + file.name;
  fileProgress.style.display = 'block';
  fileProgressInner.style.width = '0%';

  // Send metadata
  var metadata = {
    type: 'file-start',
    name: file.name,
    size: file.size,
    mime: file.type
  };
  
  var metaString = JSON.stringify(metadata);
  if(isInitiator) sendChannel.send(metaString);
  else receiveChannel.send(metaString);

  var offset = 0;
  fileReader.onload = (e) => {
    var chunk = e.target.result;
    if(isInitiator) sendChannel.send(chunk);
    else receiveChannel.send(chunk);
    
    offset += chunk.byteLength;
    var percent = Math.round((offset / file.size) * 100);
    fileProgressInner.style.width = percent + '%';

    if (offset < file.size) {
      readNextChunk();
    } else {
      // Send end message
      var endMsg = JSON.stringify({ type: 'file-end' });
      if(isInitiator) sendChannel.send(endMsg);
      else receiveChannel.send(endMsg);
      
      fileStatus.innerText = 'File sent successfully';
      setTimeout(() => { fileProgress.style.display = 'none'; }, 2000);
      appendMessage('You sent the file: ' + file.name, 'sent');
    }
  };

  function readNextChunk() {
    var slice = file.slice(offset, offset + CHUNK_SIZE);
    fileReader.readAsArrayBuffer(slice);
  }

  readNextChunk();
}

// ICE candidates management
function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate});
  } else {
    console.log('End of candidates.');
  }
}

// Create Offer
function doCall() {
  console.log('Creating Offer...');
  pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Signalling error handler
function onSignalingError(error) {
	console.log('Failed to create signaling message : ' + error.name);
}

// Create Answer
function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription);
}

/////////////////////////////////////////////////////////
// Remote stream handlers...

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  if (event.streams && event.streams[0]) {
    if (remoteVideo.srcObject !== event.streams[0]) {
      remoteVideo.srcObject = event.streams[0];
      remoteStream = event.streams[0];
      console.log('Remote stream attached!!.');
      remoteVideo.play().catch(e => console.warn('remoteVideo.play() failed:', e));
    }
  } else {
    console.warn('ontrack fired but event.streams is empty');
  }
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}
/////////////////////////////////////////////////////////
// Clean-up functions...

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  if (pc) pc.close();
  pc = null;
  sendButton.disabled=true;
}

///////////////////////////////////////////
