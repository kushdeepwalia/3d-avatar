"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useFBX, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Types
type MorphDictionary = Record<string, number>;

interface AvatarViewerProps {
   onReady: (mesh: THREE.Mesh, morphs: MorphDictionary) => void;
}

// ----------------------------------------------------------------------
// AvatarViewer: loads FBX, finds morphs safely, never hangs
// ----------------------------------------------------------------------
function AvatarViewer({ onReady }: AvatarViewerProps) {
   const { scene: fbx } = useGLTF("/Teacher.glb");

   useEffect(() => {
      console.log("🔍 Starting morph scan...");

      let found = false;

      // PASS 1 — Find morph targets immediately
      fbx.traverse((child: any) => {
         let scale = 0.03;
         fbx.scale.set(scale, scale, scale);
         fbx.position.set(0, -4.9, -1.3);
         fbx.rotation.y = Math.PI * 2;
         fbx.rotation.x = -0.3;
         if (child.morphTargetDictionary && child.morphTargetInfluences) {
            console.log("🎯 FOUND MORPH MESH:", child.name);
            child.morphTargetInfluences.fill(0);
            onReady(child, child.morphTargetDictionary);
            found = true;
         }
      });

      // PASS 2 — Some FBX files delay morph injection → retry
      if (!found) {
         setTimeout(() => {
            console.log("⏳ Retrying morph scan...");
            fbx.traverse((child: any) => {
               if (child.morphTargetDictionary && child.morphTargetInfluences) {
                  console.log("🎯 LATE FOUND MORPH MESH:", child.name);
                  child.morphTargetInfluences.fill(0);
                  onReady(child, child.morphTargetDictionary);
               }
            });
         }, 300);
      }
   }, [fbx, onReady]);

   return <primitive object={fbx} scale={0.01} />;
}

// ----------------------------------------------------------------------
// MAIN PAGE
// ----------------------------------------------------------------------
export default function Page() {
   const faceMeshRef = useRef<THREE.Mesh | null>(null);
   const morphIndexRef = useRef<MorphDictionary>({});
   const [ready, setReady] = useState(false);

   const handleReady = (mesh: THREE.Mesh, morphs: MorphDictionary) => {
      console.log("🔥 onReady fired!");
      faceMeshRef.current = mesh;
      morphIndexRef.current = morphs;
      setReady(true);
   };

   const toggleMorph = (name: string) => {
      const mesh = faceMeshRef.current;
      if (!mesh || !mesh.morphTargetInfluences) return;

      const index = morphIndexRef.current[name];
      if (index === undefined) return;

      const current = mesh.morphTargetInfluences[index];
      mesh.morphTargetInfluences[index] = current === 0 ? 1 : 0;
   };

   return (
      <div style={{ width: "100vw", height: "100vh", background: "#fff" }}>
         {/* UI */}
         <div
            style={{
               position: "absolute",
               zIndex: 10,
               top: 20,
               left: 20,
               display: "flex",
               flexDirection: "column",
               gap: "10px",
            }}
         >
            {ready ? (
               <>
                  <button style={btn} onClick={() => toggleMorph("Mouth_AA")}>
                     Mouth_AA
                  </button>
                  <button style={btn} onClick={() => toggleMorph("Mouth_EE")}>
                     Mouth_EE
                  </button>
                  <button style={btn} onClick={() => toggleMorph("Mouth_OO")}>
                     Mouth_OO
                  </button>
                  <button style={btn} onClick={() => toggleMorph("Smile")}>
                     Smile
                  </button>
               </>
            ) : (
               <div style={{ color: "#fff" }}>Loading morphs…</div>
            )}
         </div>

         {/* Canvas */}
         <Canvas camera={{ position: [0, 1.3, 2] }}>
            <ambientLight intensity={0.8} />
            <directionalLight intensity={10} position={[4, 4, 4]} />
            <AvatarViewer onReady={handleReady} />
            <OrbitControls />
         </Canvas>
      </div>
   );
}

const btn: React.CSSProperties = {
   padding: "10px 20px",
   borderRadius: "6px",
   fontSize: "16px",
   background: "#444",
   border: "none",
   color: "white",
   cursor: "pointer",
};
