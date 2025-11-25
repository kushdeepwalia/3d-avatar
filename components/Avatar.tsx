"use client";

import React, { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import {
   createAnimationManager,
   useFBXAnimations,
   AnimationManager,
} from "./animations/animationManager";

interface AvatarProps {
   isActive: boolean;
   emotion: string;
   speaking: boolean;
   modelPosition: string;
   thinking: boolean;
}

export default function Avatar({
   isActive,
   emotion,
   speaking,
   modelPosition,
   thinking,
}: AvatarProps) {
   const { scene: avatar } = useGLTF("/avatarGLB.glb");
   const rootRef = useRef<THREE.Group>(null);

   const clips = useFBXAnimations(
      [
         "/animations/ClappingFBX.fbx",
         "/animations/GreetingFBX.fbx",
         "/animations/HappyHandFBX.fbx",
         "/animations/HeadNodYesFBX.fbx",
         "/animations/HeadNoFBX.fbx",
         "/animations/IdleFBX.fbx",
         "/animations/PointingFBX.fbx",
         "/animations/SadIdleFBX.fbx",
         "/animations/TalkingFBX.fbx",
         "/animations/ThinkingFBX.fbx",
      ],
      avatar
   );

   const managerRef = useRef<AnimationManager | null>(null);
   const headRef = useRef<THREE.SkinnedMesh | null>(null);
   const t = useRef(0);

   useEffect(() => {
      const manager = createAnimationManager(avatar);

      const names = [
         "Clapping",
         "Greeting",
         "HappyHand",
         "HeadNodYes",
         "HeadNo",
         "Idle",
         "Pointing",
         "SadIdle",
         "Talking",
         "Thinking",
      ];

      clips.forEach((clip, index) => {
         clip.name = names[index];
         manager.actions[clip.name] = manager.mixer.clipAction(clip);
      });

      managerRef.current = manager;
   }, [clips]);

   // 🔥 Auto animation logic
   useEffect(() => {
      if (!isActive || !managerRef.current || !rootRef.current) return;

      const obj = "Wolf3D_Head";
      const head = avatar.getObjectByName(obj) as THREE.SkinnedMesh;
      if (head && head.morphTargetDictionary) {
         headRef.current = head;
         console.log("✅ Morph targets:", head.morphTargetDictionary);
      } else {
         console.warn("⚠️ No morph targets found on " + obj);
      }

      const manager = managerRef.current;

      // GPT is thinking → thinking animation
      if (thinking) {
         manager.play("Thinking");
         return;
      }

      // If speaking → talking animation
      if (speaking && manager.actions["Idle"].isRunning()) {
         manager.play("Talking");
         return;
      }

      console.log(emotion);

      // Emotion → animation
      switch (emotion) {
         case "happy":
            manager.play("HappyHand");
            break;
         case "greet":
            manager.play("Greeting");
            break;
         case "sad":
            manager.play("SadIdle");
            break;
         case "clap":
            manager.play("Clapping");
            break;
         case "yes":
            manager.play("HeadNodYes");
            break;
         case "no":
            manager.play("HeadNo");
            break;
         case "point":
            manager.play("Pointing");
            break;
         case "think":
            manager.play("Thinking");
            break;
         case "talk":
            manager.play("Talking");
            break;
         case "idle":
         default:
            // avatar.rotation.x = -0.2;
            manager.play("Idle");
            break;
      }
   }, [emotion, speaking, thinking, isActive]);

   // 🎙️ Lip sync animation
   useFrame((_, delta) => {
      if (!headRef.current) return;
      if (isActive) managerRef.current?.update(delta);
      const dict = headRef.current.morphTargetDictionary;
      const influences = headRef.current.morphTargetInfluences;
      if (!dict || !influences) return;

      const mouthIndex = dict["mouthOpen"];
      const smileIndex = dict["mouthSmile"];
      // console.log(mouthIndex, smileIndex);

      // console.log("speaking:", speaking);

      if (speaking) {
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

   return (
      <group
         ref={rootRef}
         position={modelPosition === "near" ? [0, -7.8, -1.3] : [0, -2.7, -1.3]}
         rotation={modelPosition === "near" ? [-0.26, 0, 0] : [-0.35, 0, 0]}
      >
         <primitive
            object={avatar}
            scale={modelPosition === "near" ? 4.55 : 1.7}
         />
      </group>
   );
}
