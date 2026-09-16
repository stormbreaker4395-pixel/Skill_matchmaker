import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectMongo, getDb } from "./mongodb.js";
import { ensureStudentForUser, getStudent, listStudents, updateStudent, createStudent, listOpportunities, getOpportunity, createOpportunity, seedDatabase } from "./db.js";
import { rankMatches } from "./matcher.js";
import { parseStudentText, parseJobText, skillpulse, careerGap, interviewQuestions } from "./ai.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "client");
const port = Number(process.env.PORT || 4000);
const frontendUrl = process.env.FRONTEND_URL || `http://localhost:${port}`;
const localAuth = process.env.LOCAL_AUTH !== "false";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", frontendUrl === "*" ? "*" : frontendUrl);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Local-User, X-Local-Role");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
}
function json(res, status, data) { cors(res); res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); }
function readBody(req) { return new Promise((resolve, reject) => { let s=""; req.on("data", c => { s += c; if (s.length > 1e6) reject(new Error("Request too large")); }); req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error("Invalid JSON")); } }); }); }
function cleanList(x) { return Array.isArray(x) ? [...new Set(x.map(v => String(v).trim().toLowerCase()).filter(Boolean))] : String(x || "").split(",").map(v=>v.trim().toLowerCase()).filter(Boolean); }

async function auth(req, res) {
  if (localAuth) {
    return { uid: req.headers["x-local-user"] || "demo-student", role: req.headers["x-local-role"] || "student", email: `${req.headers["x-local-user"] || "demo-student"}@local.test` };
  }
  const { firebaseAuth } = await import("./firebase-admin.js");
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) { json(res, 401, { error: "Authentication required" }); return null; }
  try { const token = await firebaseAuth.verifyIdToken(h.slice(7)); return { ...token, role: token.role || "student" }; }
  catch { json(res, 401, { error: "Invalid or expired authentication token" }); return null; }
}

async function profile(user) {
  const students = await listStudents(user.uid);
  return students[0] || ensureStudentForUser(user.uid, user.email);
}
async function collection(name) { return getDb().collection(name); }
function noId(x) { if (!x) return x; const { _id, ...rest } = x; return rest; }

async function market() {
  const students = await listAll("students");
  const opportunities = await listOpportunities();
  const skillMap = new Map(); const roleMap = new Map();
  for (const s of students) { for (const skill of s.skills || []) skillMap.set(skill, (skillMap.get(skill)||0)+1); for (const role of (s.roles || [s.role]).filter(Boolean)) roleMap.set(role,(roleMap.get(role)||0)+1); }
  for (const o of opportunities) { for (const skill of o.skills || []) skillMap.set(skill, skillMap.get(skill)||0); }
  const skillDemand = new Map(); for (const o of opportunities) for (const skill of o.skills || []) skillDemand.set(skill,(skillDemand.get(skill)||0)+1);
  return { students: students.length, opportunities: opportunities.length, skills: [...skillMap].map(([skill, students])=>({skill, students, openings:skillDemand.get(skill)||0})).sort((a,b)=>b.students-a.students), roles:[...roleMap].map(([role,students])=>({role,students})).sort((a,b)=>b.students-a.students), years:[...new Set(students.map(s=>s.year).filter(Boolean))].sort() };
}
async function listAll(name) { return (await (await collection(name)).find({}).toArray()).map(noId); }

const server = http.createServer(async (req,res) => {
  try {
    if (req.method === "OPTIONS") { cors(res); res.writeHead(204); return res.end(); }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === "/api/health") return json(res,200,{ok:true,service:"skillbridge",localAuth,ai:true});
    if (!url.pathname.startsWith("/api/")) return serve(req,res);
    const user = await auth(req,res); if (!user) return;

    if (url.pathname === "/api/me" && req.method === "GET") return json(res,200,{user,profile:await profile(user)});
    if (url.pathname === "/api/students" && req.method === "GET") return json(res,200,await listStudents(user.uid));
    if (url.pathname === "/api/students" && req.method === "POST") { if(user.role!=="student") return json(res,403,{error:"Student account required"}); const d=await readBody(req); if(!d.name)return json(res,400,{error:"Name is required"}); return json(res,201,await createStudent({...d,skills:cleanList(d.skills),interests:cleanList(d.interests)},user.uid)); }
    if (url.pathname.startsWith("/api/students/") && req.method === "GET") { const s=await getStudent(Number(url.pathname.split("/").pop()),user.uid); return s?json(res,200,s):json(res,404,{error:"Student not found"}); }
    if (url.pathname.startsWith("/api/students/") && req.method === "PUT") { if(user.role!=="student")return json(res,403,{error:"Student account required"}); const d=await readBody(req); const s=await updateStudent(Number(url.pathname.split("/").pop()),{...d,skills:cleanList(d.skills),interests:cleanList(d.interests)},user.uid); return s?json(res,200,s):json(res,404,{error:"Student not found"}); }

    if (url.pathname === "/api/opportunities" && req.method === "GET") {
      let rows=await listOpportunities();
      const q=(url.searchParams.get("q")||"").toLowerCase(); const mode=url.searchParams.get("mode"); const year=url.searchParams.get("year"); const skill=url.searchParams.get("skill");
      if(q)rows=rows.filter(o=>`${o.company} ${o.title} ${o.description} ${(o.skills||[]).join(" ")}`.toLowerCase().includes(q));
      if(mode)rows=rows.filter(o=>o.mode===mode); if(skill)rows=rows.filter(o=>(o.skills||[]).includes(skill)); if(year)rows=rows.filter(o=>(o.targetYears||[]).map(String).includes(String(year)));
      return json(res,200,rows);
    }
    if (url.pathname === "/api/opportunities" && req.method === "POST") { if(user.role!=="organization")return json(res,403,{error:"Organization account required"}); const d=await readBody(req); if(!d.company||!d.title||!d.description)return json(res,400,{error:"Company, role and description are required"}); const parsed=parseJobText(`${d.title} ${d.description} ${(d.skills||[]).join(" ")}`); return json(res,201,await createOpportunity({...d,skills:cleanList(d.skills).concat(parsed.skills.filter(x=>!cleanList(d.skills).includes(x))),interests:cleanList(d.interests),roles:parsed.roles,organizationUid:user.uid,targetYears:d.targetYears||[]})); }
    if (url.pathname.startsWith("/api/opportunities/") && req.method === "GET") { const o=await getOpportunity(Number(url.pathname.split("/").pop())); return o?json(res,200,o):json(res,404,{error:"Opportunity not found"}); }

    if (url.pathname.startsWith("/api/matches/") && req.method === "GET") { const id=Number(url.pathname.split("/").pop()); const s=await getStudent(id,user.uid); if(!s)return json(res,404,{error:"Student not found"}); const matches=rankMatches(s,await listOpportunities()); return json(res,200,{student:s,matches}); }
    if (url.pathname === "/api/ai/profile" && req.method === "POST") { const d=await readBody(req); return json(res,200,parseStudentText(d.text||"")); }
    if (url.pathname === "/api/ai/job" && req.method === "POST") { const d=await readBody(req); return json(res,200,parseJobText(d.text||"")); }
    if (url.pathname === "/api/ai/skillpulse" && req.method === "GET") { if(user.role!=="student")return json(res,403,{error:"Student account required"}); return json(res,200,skillpulse(await profile(user),await listAll("students"),await listOpportunities())); }
    if (url.pathname === "/api/ai/career" && req.method === "GET") { const s=await profile(user); return json(res,200,careerGap(s,url.searchParams.get("role")||"software engineer",await listOpportunities())); }
    if (url.pathname.startsWith("/api/ai/interview/") && req.method === "GET") { const o=await getOpportunity(Number(url.pathname.split("/").pop())); if(!o)return json(res,404,{error:"Opportunity not found"}); return json(res,200,{opportunity:o,questions:interviewQuestions(o,await profile(user))}); }

    if (url.pathname === "/api/market" && req.method === "GET") { if(user.role!=="organization")return json(res,403,{error:"Organization account required"}); return json(res,200,await market()); }
    if (url.pathname === "/api/applications" && req.method === "GET") { const c=await collection("applications"); return json(res,200,(await c.find({uid:user.uid}).toArray()).map(noId)); }
    if (url.pathname === "/api/applications" && req.method === "POST") { if(user.role!=="student")return json(res,403,{error:"Student account required"}); const d=await readBody(req); const o=await getOpportunity(Number(d.opportunityId)); if(!o)return json(res,404,{error:"Opportunity not found"}); const c=await collection("applications"); const existing=await c.findOne({uid:user.uid,opportunityId:o.id}); if(existing)return json(res,200,noId(existing)); const a={id:`app-${Date.now()}`,uid:user.uid,opportunityId:o.id,company:o.company,title:o.title,status:"Applied",createdAt:new Date().toISOString()}; await c.insertOne(a); return json(res,201,a); }
    if (url.pathname === "/api/follows" && req.method === "GET") { const c=await collection("follows"); return json(res,200,(await c.find({uid:user.uid}).toArray()).map(noId)); }
    if (url.pathname === "/api/follows" && req.method === "POST") { const d=await readBody(req); const c=await collection("follows"); const key={uid:user.uid,company:String(d.company)}; const existing=await c.findOne(key); if(existing){await c.deleteOne?.(key);return json(res,200,{following:false});} await c.insertOne({...key,createdAt:new Date().toISOString()}); return json(res,201,{following:true}); }
    if (url.pathname === "/api/company-intel" && req.method === "GET") { const q=(url.searchParams.get("q")||"").toLowerCase(); const jobs=await listOpportunities(); const similar=jobs.filter(o=>`${o.company} ${o.title} ${(o.skills||[]).join(" ")}`.toLowerCase().includes(q)); return json(res,200,{query:q,companies:[...new Set(similar.map(o=>o.company))],offerings:similar.map(o=>({company:o.company,role:o.title,mode:o.mode,stipend:o.stipend,skills:o.skills}))}); }
    return json(res,404,{error:"API route not found"});
  } catch(error) { console.error(error); json(res,500,{error:"Unexpected server error",detail:error.message}); }
});

function serve(req,res){ let p=new URL(req.url,`http://${req.headers.host}`).pathname; if(p==="/")p="/index.html"; const file=path.join(root,path.normalize(p).replace(/^[/\\]+/,"")); if(!file.startsWith(root)||!fs.existsSync(file)||fs.statSync(file).isDirectory())return json(res,404,{error:"Not found"}); const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8"}; cors(res);res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream"});fs.createReadStream(file).pipe(res); }

await connectMongo(); await seedDatabase(); server.listen(port,()=>console.log(`SkillBridge running locally at http://localhost:${port}`));
