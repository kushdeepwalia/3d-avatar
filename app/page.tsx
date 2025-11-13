"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Define SpeechRecognition types (for TS)
interface SpeechRecognition extends EventTarget {
   lang: string;
   continuous: boolean;
   interimResults: boolean;
   onstart: (() => void) | null;
   onresult: ((event: SpeechRecognitionEvent) => void) | null;
   onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
   onend: (() => void) | null;
   start: () => void;
   stop: () => void;
}

interface SpeechRecognitionEvent extends Event {
   results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
   error: string;
   message: string;
}

declare global {
   interface Window {
      SpeechRecognition: new () => SpeechRecognition;
      webkitSpeechRecognition: new () => SpeechRecognition;
   }
}

// 🧠 Avatar component
function Avatar({ isSpeaking }: { isSpeaking: boolean }) {
   const { scene } = useGLTF("/avatar.glb");
   const headRef = useRef<THREE.SkinnedMesh | null>(null);
   const t = useRef(0);

   useEffect(() => {
      const head = scene.getObjectByName("Wolf3D_Head") as THREE.SkinnedMesh;
      if (head && head.morphTargetDictionary) {
         headRef.current = head;
         console.log("✅ Morph targets:", head.morphTargetDictionary);
      } else {
         console.warn("⚠️ No morph targets found on Wolf3D_Head");
      }
   }, [scene]);

   // 🎙️ Lip sync animation
   useFrame((_, delta) => {
      if (!headRef.current) return;
      const dict = headRef.current.morphTargetDictionary;
      const influences = headRef.current.morphTargetInfluences;
      if (!dict || !influences) return;

      const mouthIndex = dict["mouthOpen"];
      const smileIndex = dict["mouthSmile"];

      if (isSpeaking) {
         t.current += delta * 10;
         influences[mouthIndex] = ((Math.sin(t.current) + 1) / 2) * 0.6;
         influences[smileIndex] = 0.2;
      } else {
         influences[mouthIndex] = THREE.MathUtils.lerp(
            influences[mouthIndex],
            0,
            0.2
         );
         influences[smileIndex] = THREE.MathUtils.lerp(
            influences[smileIndex],
            0,
            0.2
         );
      }
   });

   return <primitive object={scene} position={[0, -1, 0]} />;
}

// 🎤 Main Page
export default function Page() {
   const [isSpeaking, setIsSpeaking] = useState(false);
   const [expression, setExpression] = useState("neutral");
   const [transcript, setTranscript] = useState("");
   const [listening, setListening] = useState(false);

   // 💬 Text-to-Speech with emotion
   const speakWithEmotion = (dialogue: string) => {
      const parts = dialogue.split(/\[(.*?)\]/).filter(Boolean);

      const playNext = (index: number) => {
         if (index >= parts.length) return;
         const mood = parts[index].trim().toLowerCase() as
            | "happy"
            | "calm"
            | "angry"
            | "sad"
            | "neutral";
         const text = parts[index + 1]?.trim();
         if (!text) return;

         setExpression(mood);
         const utterance = new SpeechSynthesisUtterance(text);
         const voices = speechSynthesis.getVoices();
         console.log(voices);
         console.log(utterance);
         const voiceSelected =
            voices.find((v) => v.name.includes("Microsoft Heera")) || voices[0];
         console.log(voiceSelected);
         utterance.voice = voiceSelected;

         switch (mood) {
            case "happy":
               utterance.pitch = 2.3;
               utterance.rate = 1.5;
               break;
            case "calm":
               utterance.pitch = 1.0;
               utterance.rate = 0.9;
               break;
            case "angry":
               utterance.pitch = 0.8;
               utterance.rate = 1.3;
               break;
            case "sad":
               utterance.pitch = 0.7;
               utterance.rate = 0.8;
               break;
            default:
               utterance.pitch = 1.0;
               utterance.rate = 1.0;
         }

         utterance.onstart = () => setIsSpeaking(true);
         utterance.onend = () => {
            setIsSpeaking(false);
            playNext(index + 2);
         };

         speechSynthesis.speak(utterance);
      };

      speechSynthesis.cancel();
      playNext(0);
   };

   useEffect(() => {
      if (!isSpeaking) {
         speechSynthesis.cancel();
      }
   }, [isSpeaking]);

   // 🗣️ Speech-to-Text (typed)
   const startListening = () => {
      const RecognitionClass =
         window.SpeechRecognition || window.webkitSpeechRecognition;

      if (!RecognitionClass) {
         alert("Speech Recognition not supported in this browser.");
         return;
      }

      const recognition = new RecognitionClass();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onstart = () => {
         setListening(true);
         setTranscript("");
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
         const result = event.results[0][0].transcript;
         console.log("Prompt: ", result);
         setTranscript(result);
         setListening(false);

         fetch(
            `https://api.billioncolors.com/ask?prompt=${encodeURIComponent(result)}`,
            {
               method: "GET",
            }
         )
            .then((res) => {
               if (!res.ok) {
                  throw new Error(`HTTP error! Status: ${res.status}`);
               }
               return res.json(); // convert response to JSON
            })
            .then((data) => {
               console.log("Response from server:", data);
               speakWithEmotion("[happy]" + data.response);
            })
            .catch((err) => {
               console.error("Fetch error:", err);
            });

         // if (result.toLowerCase().includes("hello")) {
         //   speakWithEmotion("[happy] Hello there! How are you today?");
         // } else if (result.toLowerCase().includes("sad")) {
         //   speakWithEmotion(
         //     "[sad] I'm sorry to hear that. Everything will be okay."
         //   );
         // } else if (result.toLowerCase().includes("angry")) {
         //   speakWithEmotion(
         //     "[angry] Take a deep breath. Let's calm down together."
         //   );
         // } else {
         //   speakWithEmotion("[calm] I heard you say " + result);
         // }
      };

      recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
         console.error("Recognition error:", e.error, e.message);
         setListening(false);
      };

      recognition.onend = () => setListening(false);
      recognition.start();
   };

   const testDialogue =
      "[happy] Hey there! It’s great to see you. Let's take a moment to think carefully. I can’t believe that happened!  Sometimes things just don’t go our way.";

   return (
      <div className="w-screen h-screen bg-gray-900 flex flex-col items-center justify-center">
         <Canvas camera={{ position: [0, 1.5, 3] }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[2, 2, 5]} intensity={1} />
            <OrbitControls />
            <Avatar isSpeaking={isSpeaking} />
         </Canvas>

         <div className="absolute bottom-10 flex flex-col items-center gap-3 text-center">
            <p className="text-white text-lg">
               Expression: <b className="text-blue-400">{expression}</b>
            </p>
            <p className="text-gray-300 italic">
               {transcript && `"${transcript}"`}
            </p>

            <div className="flex gap-4 mt-2">
               <button
                  onClick={() => speakWithEmotion(testDialogue)}
                  disabled={isSpeaking}
                  className={`px-6 py-3 rounded-lg text-white font-semibold transition ${
                     isSpeaking
                        ? "bg-gray-500"
                        : "bg-blue-500 hover:bg-blue-600"
                  }`}
               >
                  {isSpeaking ? "Speaking..." : "🗣️ Speak Demo"}
               </button>

               <button
                  onClick={() => {
                     setIsSpeaking(false);
                     startListening();
                  }}
                  disabled={listening}
                  className={`px-6 py-3 rounded-lg text-white font-semibold transition ${
                     listening
                        ? "bg-gray-500"
                        : "bg-green-500 hover:bg-green-600"
                  }`}
               >
                  {listening ? "🎧 Listening..." : "🎤 Start Listening"}
               </button>
            </div>
         </div>
      </div>
   );
}
