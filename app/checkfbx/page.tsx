"use client";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import React, { useEffect } from "react";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

const page = () => {
   const loader = new GLTFLoader();
   const loader2 = new FBXLoader();

   useEffect(() => {
      loader.load("/ignore/avatarGLB.glb", (glb) => {
         glb.scene.traverse((obj) => {
            if (obj.isBone) console.log("GLB Bone:", obj.name);
         });
      });
      loader2.load("/ignore/animations/ClappingFBX.fbx", (fbx) => {
         fbx.traverse((obj) => {
            if (obj.isBone) console.log("FBX Bone:", obj.name);
         });

         fbx.animations[0].tracks.forEach((track) => {
            console.log("FBX Track:", track.name);
         });
      });
   }, []);

   return <div>page</div>;
};

export default page;
