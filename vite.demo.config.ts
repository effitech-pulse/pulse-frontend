import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({plugins:[react()],resolve:{alias:{'@':path.resolve(__dirname,'src')}},define:{'process.env.NODE_ENV':JSON.stringify('production'),'import.meta.env.VITE_API_KEY':'undefined','import.meta.env.VITE_API_URL':JSON.stringify('')},build:{outDir:'.landing-demo-build',lib:{entry:path.resolve(__dirname,'src/landingDemo.tsx'),name:'PulseLandingDemo',formats:['iife'],fileName:()=> 'demo.js'},cssCodeSplit:false,emptyOutDir:true}});
