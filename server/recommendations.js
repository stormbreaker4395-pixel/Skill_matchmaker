import { getDb } from "./mongodb.js";
import { rankMatches } from "./matcher.js";

const rows=async(n,q={})=>(await getDb().collection(n).find(q).toArray()).map(({_id,...x})=>x);
const decay=t=>Math.exp(-Math.max(0,(Date.now()-new Date(t||Date.now()).getTime())/86400000)/21);

function companyBoost(company,follows,events){let b=follows.some(x=>x.company===company)?7:0;for(const e of events.filter(x=>x.company===company)){const w=decay(e.createdAt);if(e.type==="view")b+=2.5*w;if(e.type==="save")b+=4*w;if(e.type==="apply")b+=5*w;}return b;}

export async function personalizedRecommendations(student){
  const [jobs,follows,events]=await Promise.all([rows("opportunities"),rows("follows",{uid:student.uid}),rows("activity",{uid:student.uid})]);
  return rankMatches(student,jobs).map(x=>{const boost=companyBoost(x.opportunity.company,follows,events);const score=Math.min(100,Math.round(x.score+boost));const reasons=[...(x.reasons||[])];if(follows.some(f=>f.company===x.opportunity.company))reasons.unshift("From a company you follow");if(boost>3)reasons.unshift("Matches recent activity");return {...x,score,baseScore:x.score,personalization:Math.round(boost*10)/10,personalizedReasons:[...new Set(reasons)].slice(0,5)};}).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.score-a.score);
}

export async function candidatePool(filters={}){
  const students=await rows("students",{candidateOptIn:true});const sk=String(filters.skill||"").toLowerCase(),role=String(filters.role||"").toLowerCase(),year=filters.year?Number(filters.year):null;
  return students.filter(s=>(!sk||(s.skills||[]).some(x=>String(x).toLowerCase()===sk))&&(!role||(s.roles||[]).some(x=>String(x).toLowerCase().includes(role)))&&(!year||Number(s.year)===year)).map(s=>({id:s.id,name:s.name,headline:s.headline,college:s.college,degree:s.degree,branch:s.branch,year:s.year,graduationYear:s.graduationYear,skills:s.skills,skillDetails:s.skillDetails,roles:s.roles,preferredMode:s.preferredMode,preferredLocations:s.preferredLocations,projects:s.projects,experience:s.experience}));
}

export async function marketByCompany(){
  const jobs=await rows("opportunities"),m=new Map();
  for(const j of jobs){if(!m.has(j.company))m.set(j.company,{company:j.company,openings:0,roles:[],skills:new Map(),stipends:[]});const c=m.get(j.company);c.openings++;c.roles.push(j.title);for(const s of j.skills||[])c.skills.set(s,(c.skills.get(s)||0)+1);const n=Number(String(j.stipend||"").replace(/[^0-9.]/g,""));if(n>0)c.stipends.push(n);}
  return [...m.values()].map(c=>({company:c.company,openings:c.openings,roles:c.roles,topSkills:[...c.skills.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8).map(([skill,count])=>({skill,count})),stipend:c.stipends.length?{min:Math.min(...c.stipends),max:Math.max(...c.stipends),average:Math.round(c.stipends.reduce((a,b)=>a+b,0)/c.stipends.length)}:null}));
}
