"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useFBX, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Maximize, MicrophoneLarge, Minimize } from "@solar-icons/react";

// --- Type Definitions ---

// We need to define the shape of our chat messages for the backend
interface ChatMessage {
   role: "user" | "model";
   parts: string[];
}

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

async function askGPT(
   prompt: string,
   speakWithEmotion: (dialogue: string) => void,
   chatHistory: ChatMessage[],
   setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
   thinking: boolean,
   setThinking: React.Dispatch<React.SetStateAction<boolean>>
) {
   // BUSINESS LOGIC STARTS HERE
   const requestBody = {
      message: prompt,
      history: chatHistory,
   };

   try {
      setThinking(true);
      const response = await fetch("https://9joeylte75.execute-api.ap-south-1.amazonaws.com/chat", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify(requestBody),
      });
      // const response = await fetch("http://127.0.0.1:8000/chat", {
      //    method: "POST",
      //    headers: { "Content-Type": "application/json" },
      //    body: JSON.stringify(requestBody),
      // });

      // const response = await fetch(
      //    `https://api.billioncolors.com/ask?prompt=${encodeURIComponent(
      //       prompt
      //    )}`
      // );

      const data = await response.json();

      // speak result
      setThinking(false);
      // speakWithEmotion(data.response);
      speakWithEmotion(data.reply);

      // update history
      setChatHistory((prev) => [
         ...prev,
         { role: "user", parts: [prompt] },
         { role: "model", parts: [data.reply] },
      ]);
   } catch (err) {
      console.error(err);
      speakWithEmotion("[sad] Something went wrong. Try again.");
   }
}

async function initSpeechRecognition(
   setListening: React.Dispatch<React.SetStateAction<boolean>>,
   setTranscript: React.Dispatch<React.SetStateAction<string>>,
   chatHistory: ChatMessage[],
   setChatHistory: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
   speakWithEmotion: (dialogue: string) => void,
   thinking: boolean,
   setThinking: React.Dispatch<React.SetStateAction<boolean>>,
   testDialogue: string
) {
   // 1. Request microphone permission FIRST
   try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // stop all tracks immediately — we just needed permission
      stream.getTracks().forEach((t) => t.stop());
      console.log("Microphone permission granted.");
   } catch (err) {
      console.error("Microphone permission denied:", err);
      alert("Microphone permission is required to use voice features.");
      return null; // stop initialization
   }
   const RecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

   if (!RecognitionClass) {
      alert("Speech Recognition not supported on this browser.");
      return null;
   }

   const recognition = new RecognitionClass();
   recognition.lang = "en-US";
   recognition.interimResults = false;
   recognition.continuous = false;

   // -----------------------
   // ALL YOUR BUSINESS LOGIC
   // -----------------------

   recognition.onstart = () => {
      setListening(true);
      setTranscript("");
   };

   recognition.onresult = async (event) => {
      const userMessage = event.results[0][0].transcript;

      setTranscript(userMessage);
      setListening(false);

      await askGPT(
         userMessage,
         speakWithEmotion,
         chatHistory,
         setChatHistory,
         thinking,
         setThinking
      );
   };

   recognition.onerror = (e) => {
      console.error("Speech error:", e.error);
      setListening(false);
   };

   recognition.onend = () => {
      setListening(false);
   };

   speakWithEmotion(testDialogue);
   return recognition; // return recognizer instance
}

// --- 3D Avatar Component (Unchanged) ---
function Avatar({
   modelPosition,
   isRecognizer,
   isSpeaking,
}: {
   modelPosition: string;
   isRecognizer: boolean;
   isSpeaking: boolean;
}) {
   // --- This component is identical to your provided code ---
   // const scene = useFBX("/Teacher.fbx");
   const { scene } = useGLTF("/avatar1.glb");
   const headRef = useRef<THREE.SkinnedMesh | null>(null);
   const t = useRef(0);

   useEffect(() => {
      if (modelPosition === "far" && isRecognizer) {
         let scale = 1.8;
         scene.scale.set(scale, scale, scale);
         scene.position.set(0, -2.7, -1.3);
         scene.rotation.y = Math.PI * 2;
         scene.rotation.x = -0.2;
      } else {
         let scale = 4.8;
         scene.scale.set(scale, scale, scale);
         scene.position.set(0, -7.9, -1.3);
         scene.rotation.y = Math.PI * 2;
         scene.rotation.x = -0.3;
      }
      console.log(scene);
      const obj = "Wolf3D_Head";
      const head = scene.getObjectByName(obj) as THREE.SkinnedMesh;
      if (head && head.morphTargetDictionary) {
         headRef.current = head;
         // console.log("✅ Morph targets:", head.morphTargetDictionary);
      } else {
         console.warn("⚠️ No morph targets found on " + obj);
      }
   }, [scene, isRecognizer, modelPosition]);

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

// --- Main Page Component (Updated) ---
export default function Page() {
   const [isSpeaking, setIsSpeaking] = useState(false);
   const [recognizer, setRecognizer] = useState<SpeechRecognition | null>(null);
   const [expression, setExpression] = useState("neutral");
   const [thinking, setThinking] = useState(false);
   const [showSuggestions, setShowSuggestions] = useState(true);
   const [transcript, setTranscript] = useState("");
   const [modelPosition, setModelPosition] = useState("near");
   const [listening, setListening] = useState(false);

   // *** 1. NEW: Add state to store the chat history ***
   // This is required for our FastAPI backend
   const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);

   // 💬 Text-to-Speech with emotion
   // *** 2. UPDATED: Made this function safer ***
   const speakWithEmotion = (dialogue: string) => {
      setIsSpeaking(true);
      let textToSpeak = dialogue;
      let mood = "happy"; // Default to happy for our teacher

      // Check if the dialogue *already* has an emotion tag
      if (dialogue.startsWith("[")) {
         const parts = dialogue.split(/\[(.*?)\]/).filter(Boolean);
         if (parts.length >= 2) {
            mood = parts[0].trim().toLowerCase();
            textToSpeak = parts[1].trim();
         }
      }
      // If no tag, we'll just use the default 'happy' mood and speak the full text

      setExpression(mood);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      const voices = speechSynthesis.getVoices();

      // Find a good voice
      const voiceSelected =
         voices.find((v) => v.name.includes("Microsoft Heera")) || // Good natural voice
         voices.find((v) => v.name.includes("Samantha")) ||
         voices.find((v) => v.lang === "en-US") || // Find any US-English voice
         voices[0]; // Fallback

      utterance.voice = voiceSelected;

      switch (mood) {
         case "happy":
            utterance.pitch = 1.3;
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
         default: // 'neutral' or any other
            utterance.pitch = 1.0;
            utterance.rate = 1.0;
      }

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
         setIsSpeaking(false);
      };

      speechSynthesis.cancel(); // Clear queue
      speechSynthesis.speak(utterance);
   };

   useEffect(() => {
      // This is a good cleanup, no changes needed
      if (!isSpeaking) {
         speechSynthesis.cancel();
      }
   }, [isSpeaking]);

   // Your test dialogue, unchanged
   const testDialogue =
      "[happy] Hey there! It’s great to see you. [calm] Let's take a moment to think carefully. [sad] I can’t believe that happened! [angry] Sometimes things just don’t go our way.";

   return (
      // --- JSX is unchanged, it looks great ---
      <div className="relative w-screen h-screen overflow-hidden bg-[#7cb5ec] p-10">
         {/* Background image layer */}
         <div className="absolute inset-0 bg-size-[500px_500px] bg-[url('/objects.png')] bg-repeat opacity-50"></div>

         {/* Your actual content */}
         <div className="relative z-10 w-full h-full flex flex-col items-center justify-center">
            <div className="h-max w-full flex justify-end">
               <img
                  src={"/logo.png"}
                  alt="Appshala Logo"
                  className="w-80 h-max"
               />
            </div>
            <div
               style={{ height: "calc(100vh - 200px)" }}
               className="w-full flex flex-col items-center gap-y-[60px]"
            >
               <Canvas
                  className={`w-3/5! h-2/3! ${
                     modelPosition === "far" && recognizer !== null
                        ? ""
                        : "rounded-[150px]!"
                  }`}
                  camera={{ position: [0, 1.4, 2.5], fov: 40 }}
               >
                  <ambientLight intensity={0.6} />
                  <directionalLight position={[2, 2, 5]} intensity={1} />
                  <OrbitControls
                     enableRotate={false}
                     enableZoom={false}
                     enablePan={false}
                  />
                  <Avatar
                     modelPosition={modelPosition}
                     isRecognizer={recognizer !== null}
                     isSpeaking={isSpeaking}
                  />
               </Canvas>
               {recognizer === null && (
                  <button
                     onClick={async () =>
                        setRecognizer(
                           await initSpeechRecognition(
                              setListening,
                              setTranscript,
                              chatHistory,
                              setChatHistory,
                              speakWithEmotion,
                              thinking,
                              setThinking,
                              testDialogue
                           )
                        )
                     }
                     className="
                  relative px-[72px] py-5 rounded-full text-white font-semibold
                  bg-white/10 backdrop-blur-xs
                  border border-white/30
                  shadow-[0_8px_20px_rgba(0,0,0,0.15)]
                  overflow-hidden
                  active:shadow-none
                  "
                  >
                     <span className="relative z-10 text-3xl">Let’s Start</span>

                     <div
                        className="
                     absolute inset-0 rounded-full
                     bg-linear-to-b from-white/40 to-transparent
                     opacity-40
                     pointer-events-none
                  "
                     ></div>

                     <div
                        className="
                     absolute inset-0 rounded-full
                     shadow-[inset_0_0_10px_rgba(255,255,255,0.6)]
                     opacity-50
                     pointer-events-none
                     "
                     ></div>
                  </button>
               )}
               {recognizer !== null && (
                  <>
                     <div className="absolute top-1/2 -translate-y-1/2 -right-5">
                        <div
                           className="
                        relative w-24 h-max flex flex-col px-4 py-[50px] rounded-[40px]
                        bg-white/10 backdrop-blur-3xl
                        border border-white/30
                        overflow-hidden
                        
                        shadow-[0_20px_60px_rgba(0,0,0,0.25)]
                        "
                        >
                           <div className="z-20 w-full h-max flex flex-col gap-x-10">
                              <div
                                 onClick={() => {
                                    modelPosition === "far"
                                       ? setModelPosition("near")
                                       : setModelPosition("far");
                                 }}
                                 className={`${
                                    isSpeaking
                                       ? ""
                                       : !listening
                                       ? ""
                                       : "bg-white"
                                 } flex items-center border-white border-2 justify-center px-3 py-3 w-full rounded-full`}
                              >
                                 {modelPosition === "far" ? (
                                    <Minimize
                                       className="stroke-3"
                                       color="white"
                                       size={50}
                                    />
                                 ) : (
                                    <Maximize color="white" size={50} />
                                 )}
                              </div>
                              <div
                                 onClick={() =>
                                    isSpeaking
                                       ? setIsSpeaking(false)
                                       : !listening
                                       ? recognizer.start()
                                       : recognizer.stop()
                                 }
                                 className={`${
                                    !listening ? "" : "bg-white"
                                 } flex items-center border-white mt-10 border-2 justify-center ${
                                    isSpeaking
                                       ? "px-4 py-[23px] bg-white"
                                       : "px-3 py-3"
                                 } w-full rounded-full`}
                              >
                                 {isSpeaking ? (
                                    <div className="w-7 h-7 bg-[#F01E68]"></div>
                                 ) : (
                                    <MicrophoneLarge
                                       size={50}
                                       weight="Bold"
                                       color={!listening ? "white" : "#7cb5ec"}
                                    />
                                 )}
                              </div>
                           </div>
                           <div
                              className="
                           absolute inset-0 rounded-[40px]
                           bg-[linear-gradient(97deg,rgba(255,255,255,0.45),rgba(255,255,255,0.05))]
                           opacity-80
                           pointer-events-none
                           "
                           ></div>
                        </div>
                     </div>
                     {showSuggestions && (
                        <div className="relative w-full">
                           <div className="w-full px-20 overflow-x-auto grid gap-x-0 gap-y-5 grid-rows-2 grid-flow-col">
                              {[
                                 "Why can’t I eat only chocolate?",
                                 "Why do I have to go to school?",
                                 "Why do I need to brush my teeth?",
                                 "Why do birds fly and we don’t?",
                                 "Why do I need to share my toys?",
                                 "Why do I have to say sorry?",
                              ].map((ques, index) => (
                                 <div
                                    key={index}
                                    onClick={async () => {
                                       setShowSuggestions(false);
                                       setThinking(true);
                                       await askGPT(
                                          ques,
                                          speakWithEmotion,
                                          chatHistory,
                                          setChatHistory,
                                          thinking,
                                          setThinking
                                       );
                                    }}
                                    className={`
                              relative min-w-96 w-max max-w-4xl
                              px-8 py-4
                              rounded-full
                              text-center text-white text-xl font-semibold

                              bg-white/10 backdrop-blur-lg
                              border border-white/30
                              overflow-hidden
${index % 2 === 1 ? "ml-10" : ""}
                              `}
                                 >
                                    <span className="relative z-20">
                                       {ques}
                                    </span>

                                    <div
                                       className="
                                 absolute inset-0 rounded-full
                                 bg-[linear-gradient(-45deg,rgba(255,255,255,0.45),rgba(255,255,255,0))]
                                 opacity-80
                                 pointer-events-none
                              "
                                    ></div>

                                    <div
                                       className="
                                 absolute inset-0 rounded-full
                                 shadow-[inset_0_0_40px_rgba(255,255,255,0.55)]
                                 opacity-70
                                 pointer-events-none
                              "
                                    ></div>

                                    <div
                                       className="
                                 absolute inset-0 rounded-full
                                 shadow-[inset_0_0_40px_rgba(120,200,255,0.4)]
                                 opacity-40
                                 pointer-events-none
                              "
                                    ></div>

                                    <div
                                       className="
                                 absolute inset-0 rounded-full
                                 bg-white/5 backdrop-blur-md
                                 opacity-30
                                 pointer-events-none
                              "
                                    ></div>
                                 </div>
                              ))}
                           </div>
                           {/* Right fade overlay */}
                           <div
                              className="
                              pointer-events-none
                              absolute top-0 right-0 h-full w-24 
                              bg-linear-to-l from-[#7cb5ec] to-transparent
                           "
                           ></div>
                           <div
                              className="
                              pointer-events-none
                              absolute top-0 left-0 h-full w-24
                              bg-linear-to-r from-[#7cb5ec] to-transparent
                           "
                           ></div>
                        </div>
                     )}
                  </>
               )}
            </div>
         </div>
      </div>
   );
}
