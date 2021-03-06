      navigator.getUserMedia = navigator.getUserMedia
        || navigator.webkitGetUserMedia
        || navigator.mozGetUserMedia
        || navigator.msGetUserMedia;

      var RTCPeerConnection = window.mozRTCPeerConnection
        || window.RTCPeerConnection
        || window.webkitRTCPeerConnection;

      var RTCSessionDescription = window.mozRTCSessionDescription
        || window.RTCSessionDescription
        || window.webkitRTCSessionDescription;

      var RTCIceCandidate = window.mozRTCIceCandidate
        || window.RTCIceCandidate
        || window.webkitRTCIceCandidate;

      var localStream, localPeerConnection, remotePeerConnection;

      var localVideo = document.getElementById('localVideo');
      var remoteVideo = document.getElementById('remoteVideo');

      var startButton = document.getElementById('startButton');
      var callButton = document.getElementById('callButton');
      var hangupButton = document.getElementById('hangupButton');

      startButton.disabled = false;
      callButton.disabled = true;
      hangupButton.disabled = true;

      startButton.onclick = start;
      callButton.onclick = call;
      hangupButton.onclick = hangup;

      function start () {
        console.log('Requesting local stream');
        startButton.disabled = true;
        navigator.getUserMedia({ audio:true, video:true }, gotStream,
          function(error) {
            console.log('getUserMedia error: ', error);
          });
      }

      function gotStream (stream) {
        console.log('Received local stream');
        localVideo.src = URL.createObjectURL(stream);
        localStream = stream;
        callButton.disabled = false;
      }

      function call() {
        console.log('Starting call');

        callButton.disabled = true;
        hangupButton.disabled = false;

        if (localStream.getVideoTracks().length > 0) {
          console.log('Using video device: ' + localStream.getVideoTracks()[0].label);
        }
        if (localStream.getAudioTracks().length > 0) {
          console.log('Using audio device: ' + localStream.getAudioTracks()[0].label);
        }

        localPeerConnection = new RTCPeerConnection({ iceServers: [] });
        console.log('Created local peer connection object localPeerConnection');
        localPeerConnection.onicecandidate = gotLocalIceCandidate;

        remotePeerConnection = new RTCPeerConnection({ iceServers: [] });
        console.log('Created remote peer connection object remotePeerConnection');
        remotePeerConnection.onicecandidate = gotRemoteIceCandidate;
        remotePeerConnection.onaddstream = gotRemoteStream;

        localPeerConnection.addStream(localStream);
        console.log('Added localStream to localPeerConnection');
        localPeerConnection.createOffer(gotLocalDescription, handleError);
      }

      function gotLocalIceCandidate (event) {
        if (event.candidate) {
          remotePeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
          console.log('Local ICE candidate: \n' + event.candidate.candidate);
        }
      }

      function gotRemoteIceCandidate (event) {
        if (event.candidate) {
          localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
          console.log('Remote ICE candidate: \n ' + event.candidate.candidate);
        }
      }

      function gotRemoteStream (event) {
        remoteVideo.src = URL.createObjectURL(event.stream);
        console.log('Received remote stream');
      }

      function gotLocalDescription (description) {
        localPeerConnection.setLocalDescription(new RTCSessionDescription(description));
        console.log('Offer from localPeerConnection: \n' + description.sdp);
        remotePeerConnection.setRemoteDescription(new RTCSessionDescription(description));
        remotePeerConnection.createAnswer(gotRemoteDescription, handleError);
      }

      function gotRemoteDescription (description) {
        remotePeerConnection.setLocalDescription(new RTCSessionDescription(description));
        console.log('Answer from remotePeerConnection: \n' + description.sdp);
        localPeerConnection.setRemoteDescription(new RTCSessionDescription(description));
      }

      function hangup () {
        console.log('Ending call');
        localPeerConnection.close();
        remotePeerConnection.close();
        localPeerConnection = null;
        remotePeerConnection = null;
        hangupButton.disabled = true;
        callButton.disabled = false;
      }

      function handleError (err) {
        console.error(err);
      }
