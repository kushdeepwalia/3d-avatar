"use client";

import React, { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

function TestAvatar() {
   const { scene: glb } = useGLTF("/ignore/avatarGLB.glb");

   // Load FBX animation
   const fbx = useFBX("/ignore/animations/ClappingFBX.fbx");

   const mixerRef = useRef<THREE.AnimationMixer | null>(null);

   // -------------------------------------------
   // 1️⃣ GET ALL BONES FROM GLB
   // -------------------------------------------
   function getGLBBones(root) {
      const bones = {};
      root.traverse((o) => {
         if (o.isBone) bones[o.name] = o;
      });
      return bones;
   }

   // -------------------------------------------
   // 2️⃣ GET ALL FBX BONES
   // -------------------------------------------
   function getFBXBones(root) {
      const bones = {};
      root.traverse((o) => {
         if (o.isBone) bones[o.name] = o;
      });
      return bones;
   }

   // -------------------------------------------
   // 3️⃣ SMART NAME NORMALIZER
   // -------------------------------------------
   function normalize(name) {
      return name.replace(/mixamo|mixamorig|Armature|_|:/gi, "").toLowerCase();
   }

   // -------------------------------------------
   // 4️⃣ AUTO-MAP FBX → GLB BONES
   // -------------------------------------------
   function autoMapBones(fbxBones, glbBones) {
      const map = {};

      Object.keys(fbxBones).forEach((fbxName) => {
         const n1 = normalize(fbxName);

         let match = Object.keys(glbBones).find((glbName) => {
            const n2 = normalize(glbName);
            return n1 === n2 || n1.includes(n2) || n2.includes(n1);
         });

         if (match) map[fbxName] = match;
      });

      return map;
   }

   // -------------------------------------------
   // 5️⃣ RENAME FBX BONES TO GLB NAMES
   // -------------------------------------------
   function renameBones(fbxBones, map) {
      Object.keys(map).forEach((fbxName) => {
         const newName = map[fbxName];
         fbxBones[fbxName].name = newName;
      });
   }

   // -------------------------------------------
   // 6️⃣ APPLY ANIMATION TO GLB
   // -------------------------------------------
   useEffect(() => {
      const glbBones = getGLBBones(glb);
      const fbxBones = getFBXBones(fbx);

      console.log("GLB Bones:", Object.keys(glbBones));
      console.log("FBX Bones:", Object.keys(fbxBones));

      // Auto-map
      const boneMap = autoMapBones(fbxBones, glbBones);
      console.log("Auto Bone Mapping:", boneMap);

      // Rename FBX bones to match GLB
      renameBones(fbxBones, boneMap);

      // Now FBX animation targets have SAME bone names as GLB
      const clip = fbx.animations[0];
      clip.name = "ImportedAnim";

      // Fix animation target paths
      clip.tracks.forEach((track) => {
         const parts = track.name.split(".");
         const boneName = parts[0];
         if (boneMap[boneName]) {
            track.name = track.name.replace(boneName, boneMap[boneName]);
         }
      });

      // Play
      const mixer = new THREE.AnimationMixer(glb);
      mixerRef.current = mixer;

      const action = mixer.clipAction(clip);
      action.play();
   }, []);

   useFrame((_, delta) => {
      if (mixerRef.current) mixerRef.current.update(delta);
   });

   return <primitive object={glb} scale={3} position={[0, -2.5, 0]} />;
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
      console.log(mesh);
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
            <TestAvatar />
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
