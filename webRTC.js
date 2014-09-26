var localStream, localPeerConnection, remotePeerConnection
  , sendChannel, receiveChannel;
var servers = { iceServers: [] };

var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');
var localData = document.getElementById('dataChannelSend');
var remoteData = document.getElementById('dataChannelReceive');

var startButton = document.getElementById('startButton');
var callButton = document.getElementById('callButton');
var sendButton = document.getElementById('sendButton');
var hangupButton = document.getElementById('hangupButton');

startButton.disabled = false;
callButton.disabled = true;
sendButton.disabled = true;
hangupButton.disabled = true;

startButton.onclick = start;
callButton.onclick = call;
sendButton.onclick = send;
hangupButton.onclick = hangup;

var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'url':'stun:23.21.150.121'}]} : // number IP
  {'iceServers': [{'url': 'stun:stun.l.google.com:19302'}]};

var pc_constraints = {
  'optional': [
    {'DtlsSrtpKeyAgreement': true},
  ]};


// Set up audio and video regardless of what devices are present.
var sdpConstraints = {'mandatory': {
  'OfferToReceiveAudio':true,
  'OfferToReceiveVideo':true }};

var isInitiator = false;
var isChannelReady = false;

/**** SOCKETS *****/
var socket = io.connect();
var room = 'frogio';

socket.emit('create or join', room);

socket.on('full', function(room) {
 console.log('Room ' + room + ' is full');
});

 socket.on('empty', function (room){
  isInitiator = true;
  console.log('Room ' + room + ' is empty');
});

socket.on('join', function (room){
  console.log('Making request to join room ' + room);
  console.log('You are the initiator!');
  isChannelReady = true;
});

socket.on('log', function (array){
  console.log.apply(console, array);
});
/**** SOCKETS *****/

/**** SERVER COMUNICATION *****/
function sendMessage(message){
  console.log('Sending message: ', message);
  socket.emit('message', message);
}

socket.on('message', function (message){
  console.log('Received message:', message);
  if (message === 'incoming call') {
    callButton.disabled = false;
    callButton.innerText = 'Answer';
    isInitiator = false;
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({sdpMLineIndex:message.label,
      candidate:message.candidate});
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});
/**** SERVER COMUNICATION *****/



/**** BHO ****/

/**** BHO ****/

/**** START ****/
function start () {
  console.log('Requesting local stream');
  startButton.disabled = true;
  navigator.getUserMedia({ video:true }, gotStream, function(error) {
    console.log('getUserMedia error: ', error);
  });
}

function gotStream (localMediaStream) {
  console.log('Got local Stream');
  localStream = localMediaStream; // stream available in console
  localVideo.src = URL.createObjectURL(localMediaStream);

  if(isInitiator) {
    callButton.disabled = false;
  }
};

/**** START ****/

function call () {
  console.log('Starting call');
  callButton.disabled = true;
  sendButton.disabled = false;
  hangupButton.disabled = false;

  if (localStream.getVideoTracks().length > 0) {
    console.log('Using video device: ' + localStream.getVideoTracks()[0].label);
  }
  if (localStream.getAudioTracks().length > 0) {
    console.log('Using audio device: ' + localStream.getAudioTracks()[0].label);
  }

  createPeerConnection();
  // Add video stream to peer connection
  pc.addStream(localStream);
  console.log('Added localStream to localPeerConnection');

  var constraints = {'optional': [], 'mandatory': {'MozDontOfferDataChannel': true}};
  // temporary measure to remove Moz* constraints in Chrome
  if (webrtcDetectedBrowser === 'chrome') {
    for (var prop in constraints.mandatory) {
      if (prop.indexOf('Moz') !== -1) {
        delete constraints.mandatory[prop];
      }
    }
  }
  constraints = mergeConstraints(constraints, sdpConstraints);
  console.log('Sending offer to peer, with constraints: \n' +
    '  \'' + JSON.stringify(constraints) + '\'.');
  pc.createOffer(setLocalAndSendMessage, null, constraints);
  sendMessage('incoming call');
}

function createPeerConnection() {
  pc = new RTCPeerConnection(pc_config, pc_constraints);
  console.log('Created peer connection object pc');
  pc.onicecandidate = gotIceCandidate;
  console.log('Created RTCPeerConnnection with:\n' +
    '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
    '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');

  pc.onaddstream = gotRemoteStream;
  pc.onremovestream = handleRemoteStreamRemoved;


  if (isInitiator) {
    sendChannel = pc.createDataChannel('sendDataChannel');
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onclose = handleSendChannelStateChange;
  }
  else{
    pc.ondatachannel = gotReceiveChannel;
  }

}

function send () {
  console.log('Grabbing data from input');
  var data = localData.value;
  console.log('Sending ' + data);
  sendChannel.send(data);
}


function gotIceCandidate (event) {
  if(event.candidate) {
    remotePeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
      console.log('Local ICE candidate: \n ' + event.candidate.candidate);
  }
}

function gotRemoteIceCandidate (event) {
  if(event.candidate) {
    localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
      console.log('Remote ICE candidate: \n ' + event.candidate.candidate);
  }
}

function gotRemoteStream (event) {
  console.log(event);
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  console.log('Received remote stream');
}

function gotMessage(event) {
  remoteData.value = event.data;
  console.log('Received remote message');
}

function gotReceiveChannel(event) {
  receiveChannel = event.channel;
  receiveChannel.onmessage = gotMessage;
}

function gotLocalDescription (desc) {
  localPeerConnection.setLocalDescription(new RTCSessionDescription(desc));
  console.log('Offer from localPeerConnection \n' + desc.sdp);
  remotePeerConnection.setRemoteDescription(new RTCSessionDescription(desc));
  remotePeerConnection.createAnswer(gotRemoteDescription, function(err) {
    console.log(err);
  });
}

function gotRemoteDescription (desc) {
  remotePeerConnection.setLocalDescription(new RTCSessionDescription(desc));
  console.log('Answer from remotePeerConnection: \n' + desc.sdp);
  localPeerConnection.setRemoteDescription(new RTCSessionDescription(desc));
}

function handleSendChannelStateChange (event) {
  console.log('DataChannel is now ' + event.type);
}

function hangup () {
  console.log('Ending call');
  localPeerConnection.close();
  remotePeerConnection.close();
  localPeerConnection = null;
  remotePeerConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  sendButton.disabled = true;
}
