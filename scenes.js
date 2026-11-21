export function buildScenes({story,durationMin,style,language,aspectRatio}){
 const total=Math.max(60,Math.min(Number(durationMin)*60,30*60)), clip=10, count=Math.ceil(total/clip);
 return Array.from({length:count},(_,i)=>({id:`scene-${i+1}`,index:i+1,
  duration:i===count-1?Math.min(clip,total-i*clip):clip,aspectRatio,
  prompt:`${style} cinematic video, scene ${i+1}. Story: ${story}. Maintain character, wardrobe, location and visual continuity. Language context: ${language}. No text, subtitles or watermark.`}));
}
