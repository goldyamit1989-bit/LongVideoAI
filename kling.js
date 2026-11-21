function baseUrl(){return (process.env.KLING_BASE_URL||"https://api-singapore.klingai.com").replace(/\/$/,"");}
function headers(){const k=process.env.KLING_API_KEY;if(!k)throw new Error("KLING_API_KEY is not configured");return {"Content-Type":"application/json","Authorization":k.startsWith("Bearer ")?k:`Bearer ${k}`};}
function createUrl(){return baseUrl()+(process.env.KLING_CREATE_PATH||"/v1/videos/text2video");}
function statusUrl(id){return baseUrl()+(process.env.KLING_STATUS_PATH||"/v1/videos/text2video/{task_id}").replace("{task_id}",encodeURIComponent(id));}

export async function createKlingTask(scene){
  const payload={model_name:process.env.KLING_MODEL||"kling-v1",prompt:scene.prompt,
    negative_prompt:"blurry, low quality, watermark, distorted face, extra fingers",
    duration:String(Math.min(10,Math.max(5,scene.duration))),aspect_ratio:scene.aspectRatio||"9:16",mode:"std"};
  const r=await fetch(createUrl(),{method:"POST",headers:headers(),body:JSON.stringify(payload)});
  const t=await r.text(); if(!r.ok) throw new Error(`Kling create ${r.status}: ${t}`);
  const d=JSON.parse(t); const taskId=d?.data?.task_id??d?.task_id??d?.data?.id??d?.id;
  if(!taskId) throw new Error(`Kling response did not contain task_id: ${t}`);
  return {taskId,raw:d};
}
export async function getKlingTask(id){
  const r=await fetch(statusUrl(id),{headers:headers()}); const t=await r.text();
  if(!r.ok) throw new Error(`Kling status ${r.status}: ${t}`);
  const d=JSON.parse(t); const x=d?.data??d;
  const status=String(x?.task_status??x?.status??"").toLowerCase();
  const videoUrl=x?.task_result?.videos?.[0]?.url??x?.task_result?.videos?.[0]?.video_url??x?.videos?.[0]?.url??x?.video_url??x?.url;
  return {status,videoUrl,raw:d};
}
