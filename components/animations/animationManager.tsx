import * as THREE from "three";
import { Object3D } from "three";
import { useFBX } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// --------------------------------------------------
// TYPES
// --------------------------------------------------
export interface AnimationManager {
   mixer: THREE.AnimationMixer;
   actions: Record<string, THREE.AnimationAction>;
   play: (name: string, fadeTime?: number) => void;
   stop: (name: string) => void;
   update: (delta: number) => void;
}

// --------------------------------------------------
// NORMALIZER (remove mixamo prefixes)
// --------------------------------------------------
function normalize(name: string): string {
   return name.replace(/mixamo|mixamorig|armature|_|:|\./gi, "").toLowerCase();
}

// --------------------------------------------------
// AUTO MAP BONES (FBX → GLB)
// --------------------------------------------------
function autoMapBones(fbxRoot: Object3D, glbRoot: Object3D) {
   const fbxBones: Record<string, THREE.Bone> = {};
   const glbBones: Record<string, THREE.Bone> = {};

   fbxRoot.traverse((o) => {
      if ((o as any).isBone) fbxBones[o.name] = o as THREE.Bone;
   });

   glbRoot.traverse((o) => {
      if ((o as any).isBone) glbBones[o.name] = o as THREE.Bone;
   });

   const map: Record<string, string> = {};

   Object.keys(fbxBones).forEach((fbxName) => {
      const n1 = normalize(fbxName);

      const match = Object.keys(glbBones).find((glbName) => {
         const n2 = normalize(glbName);
         return n1 === n2 || n1.includes(n2) || n2.includes(n1);
      });

      if (match) map[fbxName] = match;
   });

   return { fbxBones, glbBones, map };
}

// --------------------------------------------------
// RENAME BONES IN FBX TO MATCH GLB
// --------------------------------------------------
function renameBones(
   fbxBones: Record<string, THREE.Bone>,
   mapping: Record<string, string>
) {
   Object.keys(mapping).forEach((oldName) => {
      const newName = mapping[oldName];
      fbxBones[oldName].name = newName;
   });
}

// --------------------------------------------------
// REMAP ANIMATION TRACKS
// --------------------------------------------------
function remapTracks(
   clip: THREE.AnimationClip,
   mapping: Record<string, string>
) {
   clip.tracks.forEach((track) => {
      const boneName = track.name.split(".")[0];

      if (mapping[boneName]) {
         track.name = track.name.replace(boneName, mapping[boneName]);
      }
   });
}

// --------------------------------------------------
// CREATE ANIMATION MANAGER
// --------------------------------------------------
export function createAnimationManager(glb: Object3D): AnimationManager {
   const mixer = new THREE.AnimationMixer(glb);
   const actions: Record<string, THREE.AnimationAction> = {};

   let currentAction: THREE.AnimationAction | null = null;

   return {
      mixer,
      actions,

      play(name: string, fadeTime = 0.3) {
         const next = actions[name];
         if (!next) return;

         if (currentAction && currentAction !== next) {
            currentAction.fadeOut(fadeTime);
            next.reset().fadeIn(fadeTime).play();
         } else {
            next.reset().fadeIn(fadeTime).play();
         }

         currentAction = next;
      },
      stop(name: string) {
         actions[name]?.stop();
      },

      update(delta: number) {
         mixer.update(delta);
      },
   };
}

// --------------------------------------------------
// LOAD MULTIPLE FBX + RETARGET TO GLB
// --------------------------------------------------
export function useFBXAnimations(
   paths: string[],
   glb: Object3D
): THREE.AnimationClip[] {
   const fbxs: THREE.Group[] = paths.map((p) => useFBX(p));

   return fbxs.map((fbxGroup) => {
      const clip = fbxGroup.animations[0];

      const { fbxBones, glbBones, map } = autoMapBones(fbxGroup, glb);

      renameBones(fbxBones, map);
      remapTracks(clip, map);

      return clip;
   });
}
