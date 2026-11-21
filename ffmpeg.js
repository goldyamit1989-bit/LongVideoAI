import fs from "fs/promises";
import path from "path";
import {execFile} from "child_process";
import {promisify} from "util";
const exec=promisify(execFile);

export async function downloadFile(url,destination){
 const r=await fetch(url); if(!r.ok) throw new Error(`Clip download failed: ${r.status}`);
 await fs.writeFile(destination,Buffer.from(await r.arrayBuffer())); return destination;
}
export async function concatMp4(files,output){
 const list=`${output}.txt`;
 await fs.writeFile(list,files.map(f=>`file '${path.resolve(f).replaceAll("'","'\\\\''")}'`).join("\\n"));
 await exec("ffmpeg",["-y","-f","concat","-safe","0","-i",list,"-c:v","libx264","-preset","veryfast","-pix_fmt","yuv420p","-movflags","+faststart",output],{maxBuffer:10*1024*1024});
 await fs.rm(list,{force:true}); return output;
}
export async function addAudio(video, narration, output, durationSec){
 const args=["-y","-i",video];
 if(narration) args.push("-i",narration);
 // A quiet generated ambient bed keeps the pipeline self-contained when no music file is supplied.
 args.push("-f","lavfi","-t",String(durationSec),"-i","anoisesrc=color=pink:amplitude=0.015");
 if(narration){
   args.push("-filter_complex","[1:a]volume=1.0[voice];[2:a]volume=0.12[music];[voice][music]amix=inputs=2:duration=longest[a]");
   args.push("-map","0:v:0","-map","[a]");
 } else {
   args.push("-map","0:v:0","-map","2:a:0");
 }
 args.push("-c:v","copy","-c:a","aac","-shortest","-movflags","+faststart",output);
 await exec("ffmpeg",args,{maxBuffer:10*1024*1024});
 return output;
}
