"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
   OrbitControls,
   useFBX,
   useGLTF,
   useAnimations,
} from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import {
   Keyboard,
   Maximize,
   MicrophoneLarge,
   Minimize,
} from "@solar-icons/react";
import Avatar from "@/components/Avatar";

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
      const response = await fetch(
         "https://9joeylte75.execute-api.ap-south-1.amazonaws.com/chat",
         {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
         }
      );
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

// --- Main Page Component (Updated) ---
export default function Page() {
   const [avatarEmotion, setAvatarEmotion] = useState("idle");
   const [isSpeaking, setIsSpeaking] = useState(false);
   const [thinking, setThinking] = useState(false);
   const [recognizer, setRecognizer] = useState<SpeechRecognition | null>(null);
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
      // Flexible parser: splits anywhere tags appear
      const regex = /\[(.*?)\]/g;

      const segments: { mood: string; text: string }[] = [];

      let lastIndex = 0;
      let currentMood = ""; // default mood
      let match;

      while ((match = regex.exec(dialogue)) !== null) {
         const moodTag = match[1].trim().toLowerCase();
         const textBeforeTag = dialogue.slice(lastIndex, match.index).trim();

         if (textBeforeTag.length > 0) {
            segments.push({ mood: currentMood, text: textBeforeTag });
         }

         currentMood = moodTag;
         lastIndex = regex.lastIndex;
      }

      // final text after last tag
      const remainingText = dialogue.slice(lastIndex).trim();
      if (remainingText.length > 0) {
         segments.push({ mood: currentMood, text: remainingText });
      }

      console.log("Segments:", segments);

      // If no emotion tags were found → speak normally
      if (segments.length === 1 && segments[0].mood === "neutral") {
         speechSynthesis.cancel();
         const utter = new SpeechSynthesisUtterance(segments[0].text);
         const voices = speechSynthesis.getVoices();
         const voiceSelected =
            voices.find((v) => v.name.includes("Microsoft Heera")) ||
            voices.find((v) => v.name.includes("Samantha")) ||
            voices.find((v) => v.lang === "en-US") ||
            voices[0];

         console.log("Voice Selected: ", voiceSelected);

         utter.voice = voiceSelected;

         // Apply voice settings for the mood
         switch (segments[0].mood as any) {
            case "greet":
            case "happy":
               utter.pitch = 1.3;
               utter.rate = 1.4;
               break;
            case "thinking":
            case "calm":
               utter.pitch = 1.0;
               utter.rate = 0.9;
               break;
            case "angry":
               utter.pitch = 0.8;
               utter.rate = 1.2;
               break;
            case "sad":
               utter.pitch = 0.7;
               utter.rate = 0.85;
               break;
            case "neutral":
            default:
               utter.pitch = 1.0;
               utter.rate = 1.0;
         }

         utter.onend = () => {
            setIsSpeaking(false);
            speakNext();
         };

         setIsSpeaking(true);
         speechSynthesis.speak(utter);
         return;
      }

      // Sequential speaking
      let index = 0;

      const speakNext = () => {
         if (index >= segments.length) {
            setIsSpeaking(false);
            setAvatarEmotion("idle");
            return;
         }

         const { mood, text } = segments[index];
         index++;

         setAvatarEmotion(mood);

         const utter = new SpeechSynthesisUtterance(text);

         const voices = speechSynthesis.getVoices();
         const voiceSelected =
            voices.find((v) => v.name.includes("Microsoft Ravi")) ||
            voices.find((v) => v.name.includes("Samantha")) ||
            voices.find((v) => v.lang === "en-US") ||
            voices[0];

         console.log("Voice Selected: ", voiceSelected);

         utter.voice = voiceSelected;

         // Apply voice settings for the mood
         switch (mood) {
            case "happy":
               utter.pitch = 1.3;
               utter.rate = 1.4;
               break;
            case "thinking":
            case "calm":
               utter.pitch = 1.0;
               utter.rate = 0.9;
               break;
            case "angry":
               utter.pitch = 0.8;
               utter.rate = 1.2;
               break;
            case "sad":
               utter.pitch = 0.7;
               utter.rate = 0.85;
               break;
            default:
               utter.pitch = 1.0;
               utter.rate = 1.0;
         }

         utter.onend = () => {
            setIsSpeaking(false);
            speakNext();
         };

         setIsSpeaking(true);
         speechSynthesis.speak(utter);
      };

      speechSynthesis.cancel();
      setIsSpeaking(false);
      speakNext();
   };

   useEffect(() => {
      // This is a good cleanup, no changes needed
      if (!isSpeaking) {
         speechSynthesis.cancel();
      }
   }, [isSpeaking]);

   // Your test dialogue, unchanged
   const testDialogue =
      "[greet] Hey there! It’s great to see you. [thinking] Let's take a moment to think carefully. [sad] I can’t believe that happened! [angry] Sometimes things just don’t go our way.";

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
                     isActive={recognizer !== null}
                     emotion={avatarEmotion}
                     speaking={isSpeaking}
                     modelPosition={modelPosition}
                     thinking={thinking}
                  />
               </Canvas>
               {recognizer === null && (
                  <button
                     onClick={async () => {
                        setModelPosition("far");
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
                        );
                     }}
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
                           <div className="z-20 w-full h-max flex flex-col gap-y-10">
                              <div
                                 onClick={() => {
                                    modelPosition === "far"
                                       ? setModelPosition("near")
                                       : setModelPosition("far");
                                 }}
                                 className={` flex items-center border-white border-2 justify-center px-3 py-3 w-full rounded-full`}
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
                                 } flex items-center border-white border-2 justify-center ${
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
                              {/* <div>
                                 <select
                                    onChange={(e) =>
                                       setAvatarEmotion(e.target.value)
                                    }
                                    value={avatarEmotion}
                                    name="animate"
                                    id="animate"
                                 >
                                    <option value="idle">Nothing</option>
                                    <option value="clap">Clap</option>
                                    <option value="greet">Greet</option>
                                    <option value="happy">Happy Hand</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                    <option value="point">Point</option>
                                    <option value="sad">Sad</option>
                                    <option value="talk">Talk</option>
                                    <option value="think">Think</option>
                                 </select>
                              </div> */}
                              <div
                                 onClick={async () => {
                                    let pro = prompt("Ask ?");
                                    if (pro !== null) {
                                       await askGPT(
                                          pro,
                                          speakWithEmotion,
                                          chatHistory,
                                          setChatHistory,
                                          thinking,
                                          setThinking
                                       );
                                    }
                                 }}
                                 className="flex cursor-pointer items-center border-white border-2 justify-center px-3 py-3 w-full rounded-full"
                              >
                                 <Keyboard
                                    size={50}
                                    weight="Bold"
                                    color={"white"}
                                 />
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
                              cursor-pointer
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
