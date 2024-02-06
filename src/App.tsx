import Peer from "peerjs";
import { useEffect, useRef, useState } from "react";
import "./App.css";

import { initializeApp } from "firebase/app";
import { getDatabase, onValue, ref, set } from "firebase/database";
import { firebaseConfig } from "./firebase";

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function App() {
  const [count, setCount] = useState(0);
  const [peerId, setPeerId] = useState("");
  const peerRef = useRef<Peer | null>(null);
  const [remotePeerId, setRemotePeerId] = useState("");

  useEffect(() => {
    // Initialize Peer
    const peer = new Peer("", {
      // Your PeerJS config here
    });
    peerRef.current = peer;

    peer.on("open", (id) => {
      setPeerId(id);
      // Register this peer in the database
      const peersRef = ref(database, "peers/" + id);
      set(peersRef, { id });
    });

    // Listen for remote connections
    peer.on("connection", (conn) => {
      conn.on("data", (data) => {
        console.log("Received:", data);
      });
    });

    // Listen for remote IDs
    const peersRef = ref(database, "peers/");
    onValue(peersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const [remoteId] = Object.keys(data).filter((key) => key !== peerId);
        setRemotePeerId(remoteId);
      }
    });

    return () => {
      peer.destroy();
    };
  }, []);

  const connectToPeer = () => {
    const conn = peerRef?.current?.connect(remotePeerId);
    console.log("conn", conn);
    if (!conn) return;

    conn.on("open", () => {
      console.log("hello");
      conn.send("Hello!");
    });
  };

  return (
    <>
      <div>
        <h1>Peer-to-Peer Communication</h1>
        <p>Your ID: {peerId}</p>
        <button onClick={connectToPeer}>Connect to Peer</button>
      </div>
    </>
  );
}

export default App;
