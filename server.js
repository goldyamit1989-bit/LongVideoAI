import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import {fileURLToPath} from "url";
import {buildScenes} from "./services/scenes.js";
import {createKlingTask,getKlingTask} from "./providers/kling.js";
import {downloadFile,concatMp4,addAudio} from "./services/ffmpeg.js";
import {createNarration} from "./providers/openai-tts.js";

dotenv.config();
const app=express();app.use(cors());app.use(express.json({limit:"2mb"}));
const __dirname=path.dirname(fileURLToPath(import.meta.url)),MEDIA=path.resolve(__dirname,"../media");
await fs.mkdir(MEDIA,{recursive:true});app.use("/media",express.static(MEDIA));
const jobs=new Map();
const publicUrl=f=>(process.env.PUBLIC_BASE_URL?process.env.PUBLIC_BASE_URL.replace(/\/$/,""):"")+"/media/"+f;

app.get("/health",(_,r)=>r.json({ok:true,service:"longvideoai-v4"}));
app.post("/api/jobs",(req,res)=>{
 const {story,durationMin=1,style="Cinematic",language="Hindi",aspectRatio="9:16"}=req.body;
 if(!story?.trim())return res.status(400).json({error:"story is required"});
 const id=crypto.randomUUID(),scenes=buildScenes({story,durationMin,style,language,aspectRatio});
 const job={id,status:"planned",progress:2,story,durationMin,style,language,aspectRatio,scenes,clips:[],finalUrl:null,error:null};
 jobs.set(id,job);res.status(202).json({jobId:id,status:"planned",progress:2,scenes:scenes.length});
});
app.get("/api/jobs/:id",(req,res)=>{const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:"job not found"});res.json(j);});
app.post("/api/jobs/:id/start",(req,res)=>{
 const j=jobs.get(req.params.id);if(!j)return res.status(404).json({error:"job not found"});
 if(!process.env.KLING_API_KEY)return res.status(503).json({error:"Kling API key is not configured"});
 if(j.status==="generating"||j.status==="assembling"||j.status==="audio")return res.json({ok:true,status:j.status});
 j.status="generating";j.progress=5;res.json({ok:true,status:j.status});
 runJob(j).catch(e=>{j.status="failed";j.error=e.message||String(e);});
});
async function runJob(j){
 const local=[];
 for(let i=0;i<j.scenes.length;i++){
  const s=j.scenes[i];j.progress=Math.min(80,5+Math.round(i/j.scenes.length*70));
  const task=await createKlingTask(s);j.clips[i]={sceneId:s.id,taskId:task.taskId,status:"submitted"};
  let done=false;
  for(let n=0;n<180;n++){
   await new Promise(r=>setTimeout(r,5000));const x=await getKlingTask(task.taskId),st=x.status;
   if(st.includes("succeed")||st.includes("success")||st==="completed"){
    if(!x.videoUrl)throw new Error(`Kling task ${task.taskId} completed without video URL`);
    const fn=`${j.id}-${String(i+1).padStart(3,"0")}.mp4`;
    await downloadFile(x.videoUrl,path.join(MEDIA,fn));local.push(path.join(MEDIA,fn));
    j.clips[i]={...j.clips[i],status:"completed"};done=true;break;
   }
   if(st.includes("fail")||st.includes("error")||st.includes("cancel"))throw new Error(`Kling task failed: ${task.taskId}`);
  }
  if(!done)throw new Error(`Timed out waiting for Kling task ${task.taskId}`);
 }
 j.status="assembling";j.progress=84;
 const base=`${j.id}-base.mp4`;await concatMp4(local,path.join(MEDIA,base));
 const narrationPath=path.join(MEDIA,`${j.id}-voice.mp3`);
 let narration=false;
 if(String(process.env.ENABLE_VOICE||"true")==="true" && process.env.OPENAI_API_KEY){
   j.status="audio";j.progress=90;
   narration=await createNarration(j.story,narrationPath);
 }
 const finalName=`${j.id}-final.mp4`,finalPath=path.join(MEDIA,finalName);
 if(String(process.env.ENABLE_MUSIC||"true")==="true" || narration){
   await addAudio(path.join(MEDIA,base),narration?narrationPath:null,finalPath,Number(j.durationMin)*60);
 } else {
   await fs.copyFile(path.join(MEDIA,base),finalPath);
 }
 j.status="completed";j.progress=100;j.finalUrl=publicUrl(finalName);
}
app.listen(process.env.PORT||8080,()=>console.log("LongVideoAI v4 backend running"));
