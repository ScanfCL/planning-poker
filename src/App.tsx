import "firebase/firestore";
import { useRef, useState } from "react";
import "./App.css";

import { getAnalytics } from "firebase/analytics";
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firebaseConfig } from "./firebase";

const servers = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const firestore = getFirestore(app);

function App() {
  const localStream = useRef<MediaStream>();
  const remoteStream = useRef<MediaStream>();
  const pc = useRef(new RTCPeerConnection(servers));
  const [callInput, setCallInput] = useState("");
  const localVideoRef = useRef<HTMLVideoElement>(null);

  console.log("analytics", analytics);

  const handleClickWebcam = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    remoteStream.current = new MediaStream();

    localStream.current.getTracks().forEach((track) => {
      if (localStream.current) {
        pc.current.addTrack(track, localStream.current);
      }
    });

    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.current?.addTrack(track);
      });
    };

    if (localVideoRef?.current) {
      localVideoRef.current.srcObject = localStream.current;
    }
  };

  const handleCallButton = async () => {
    const callDoc = collection(firestore, "calls");
    const offerCandidates = collection(callDoc.firestore, "offerCandidates");
    const answerCandidates = collection(callDoc.firestore, "answerCandidates");

    setCallInput(callDoc.id);

    pc.current.onicecandidate = (event) => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(
      offerCandidates as unknown as RTCLocalSessionDescriptionInit
    );

    const offer = {
      sdp: offerDescription.sdp,
      type: offerDescription.type,
    };

    await setDoc(doc(firestore, "calls"), { offer });

    onSnapshot(callDoc, (snapshot) => {
      snapshot.forEach((result) => {
        const data = result.data();
        if (!pc.current.currentRemoteDescription && data?.answer) {
          const answerDescription = new RTCSessionDescription(data.answer);
          pc.current.setRemoteDescription(answerDescription);
        }
      });
    });

    onSnapshot(answerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current.addIceCandidate(candidate);
        }
      });
    });
  };

  const handleAnwserButton = async () => {
    const callDoc = doc(collection(firestore, "calls"), callInput);
    const answerCandidates = collection(callDoc.firestore, "answerCandidates");
    const offerCandidates = collection(callDoc.firestore, "offerCandidates");

    pc.current.onicecandidate = (event) => {
      event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    const callData = (await getDoc(callDoc)).data();
    const offerDescription = callData?.offer;

    await pc.current.setRemoteDescription(
      new RTCSessionDescription(offerDescription)
    );

    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = {
      type: answerDescription.type,
      sdp: answerDescription.sdp,
    };

    await updateDoc(callDoc, { answer });

    onSnapshot(offerCandidates, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        console.log(change);
        if (change.type === "added") {
          const data = change.doc.data();
          pc.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  return (
    <>
      <h2>1. Start your Webcam</h2>
      <div className="videos">
        <span>
          <h3>Local Stream</h3>
          <video
            ref={localVideoRef}
            id="webcamVideo"
            autoPlay
            playsInline
          ></video>
        </span>
        <span>
          <h3>Remote Stream</h3>
          <video id="remoteVideo" autoPlay playsInline></video>
        </span>
      </div>

      <button id="webcamButton" onClick={handleClickWebcam}>
        Start webcam
      </button>
      <h2>2. Create a new Call</h2>
      <button id="callButton" onClick={handleCallButton}>
        Create Call (offer)
      </button>

      <h2>3. Join a Call</h2>
      <p>Answer the call from a different browser window or device</p>

      <input id="callInput" />
      <button id="answerButton" onClick={handleAnwserButton}>
        Answer
      </button>

      <h2>4. Hangup</h2>

      <button id="hangupButton" disabled>
        Hangup
      </button>
    </>
  );
}

export default App;
