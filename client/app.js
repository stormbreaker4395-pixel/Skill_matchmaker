const app = document.getElementById("app");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const tags = (s) =>
  String(s || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
let state = {
  mode: "student",
  students: [],
  student: null,
  matches: [],
  opportunities: [],
  open: null,
  msg: "",
};
async function api(url, opt) {
  const r = await fetch(url, opt);
  if (!r.ok) throw new Error((await r.json()).error || "Request failed");
  return r.json();
}
async function load() {
  state.students = await api("/api/students");
  state.opportunities = await api("/api/opportunities");
  state.student =
    (state.student && state.students.find((s) => s.id === state.student.id)) ||
    state.students[0];
  await reloadMatches();
  render();
}
async function reloadMatches() {
  if (!state.student) return;
  const x = await api("/api/matches/" + state.student.id);
  state.matches = x.matches || [];
}
function header() {
  return `<header class="topbar"><div class="brand"><div class="mark">✦</div><div><div class="brand-name">SkillBridge</div><div class="brand-sub">Student Skill Matcher · SDG 8</div></div></div><div class="switch"><button class="${state.mode === "student" ? "active" : ""}" data-mode="student">Student</button><button class="${state.mode === "org" ? "active" : ""}" data-mode="org">Organization</button></div></header>`;
}
function studentView() {
  const top = state.matches[0],
    strong = state.matches.filter((x) => x.score >= 70).length,
    avg = Math.round(
      state.matches.reduce((a, x) => a + x.score, 0) /
        Math.max(1, state.matches.length),
    ),
    s = state.student;
  return `${header()}<main class="page"><section class="hero"><div><div class="eyebrow"><span class="dot"></span> Explainable AI matching</div><h1>Find the internships that fit <span>your skills.</span></h1><p class="lead">One profile in. A ranked shortlist out. Every score comes with a breakdown, so students can see why an opportunity fits.</p></div><div class="hero-stat"><div class="muted">Top match</div><b>${top ? top.score : 0}%</b><div class="muted">${esc(top?.opportunity?.title || "Loading recommendations")}</div></div></section><section class="stats"><div class="stat"><div class="stat-icon">T</div><div><div class="stat-label">Strong matches</div><div class="stat-value">${strong}</div><div class="muted">score ≥ 70</div></div></div><div class="stat"><div class="stat-icon">G</div><div><div class="stat-label">Average fit</div><div class="stat-value">${avg}%</div><div class="muted">across active listings</div></div></div><div class="stat"><div class="stat-icon">B</div><div><div class="stat-label">Opportunities</div><div class="stat-value">${state.matches.length}</div><div class="muted">ranked for you</div></div></div></section><div class="grid"><section class="card">${profilePanel(s)}</section><section class="card"><div class="header"><div><div class="kicker">Recommendation dashboard</div><h2>Best-fit opportunities</h2></div><span class="pill">${state.matches.length} ranked</span></div><div class="match-list">${state.matches.map(matchCard).join("")}</div></section></div></main>${state.msg ? `<div class="toast">✓ ${esc(state.msg)}</div>` : ""}`;
}
function profilePanel(s) {
  return `<div class="header"><div><div class="kicker">Your profile</div><h2>Match inputs</h2></div><button class="btn secondary" id="newProfile">＋ New profile</button></div><label class="field">Active student<select id="studentSelect">${state.students.map((x) => `<option value="${x.id}" ${x.id === s.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label><label class="field">Name<input id="name" value="${esc(s.name)}"></label><label class="field">Headline<input id="headline" value="${esc(s.headline)}"></label><label class="field">Skills<input id="skills" value="${esc(s.skills.join(", "))}"></label><label class="field">Interests<input id="interests" value="${esc(s.interests.join(", "))}"></label><div class="two"><label class="field">Experience (months)<input id="experienceMonths" type="number" min="0" value="${s.experienceMonths}"></label><label class="field">Preferred mode<select id="preferredMode"><option>Flexible</option><option ${s.preferredMode === "Remote" ? "selected" : ""}>Remote</option><option ${s.preferredMode === "Hybrid" ? "selected" : ""}>Hybrid</option><option ${s.preferredMode === "On-site" ? "selected" : ""}>On-site</option></select></label></div><label class="field">Bio<textarea id="bio" rows="3">${esc(s.bio)}</textarea></label><button class="btn primary full" id="saveProfile">↻ Recalculate matches</button><div class="note"><div><b>How the score works</b>50% exact skills · 15% related skills · 15% interests · 10% experience · 5% mode · 5% text similarity</div></div>`;
}
function matchCard(m) {
  const o = m.opportunity,
    cls = m.score >= 80 ? "great" : m.score >= 65 ? "good" : "fair";
  return `<article class="match"><div class="match-main" data-open="${o.id}"><div class="logo">${esc(o.company[0])}</div><div><div class="role"><h3>${esc(o.title)}</h3><span class="score ${cls}">${m.score}% match</span></div><div class="sub">${esc(o.company)} · ${esc(o.location)} · ${esc(o.mode)}</div><div class="chips">${o.skills
    .slice(0, 4)
    .map((x) => `<span>${esc(fmt(x))}</span>`)
    .join(
      "",
    )}</div></div><div>⌄</div></div>${state.open === o.id ? `<div class="detail"><div class="reasons">${m.reasons.map((r) => `<span class="reason">✓ ${esc(r)}</span>`).join("")}</div><div class="break">${br("Exact skills", m.components.exactSkill, "50%")}${br("Related skills", m.components.relatedSkill, "15%")}${br("Interests", m.components.interest, "15%")}${br("Experience", m.components.experience, "10%")}${br("Work mode", m.components.workMode, "5%")}${br("Text similarity", m.components.textSimilarity, "5%")}</div><div class="detail-foot"><span class="small">${esc(o.stipend)}</span><button class="btn secondary">View opportunity →</button></div></div>` : ""}</article>`;
}
function br(label, v, w) {
  return `<div class="br"><div class="small">${label}</div><div class="bar"><i style="width:${v}%"></i></div><strong>${v}%</strong></div>`;
}
function fmt(x) {
  return x.replace(/(^|[.\- ])\w/g, (c) => c.toUpperCase());
}
function orgView() {
  return `${header()}<main class="page"><section class="hero"><div><div class="eyebrow"><span class="dot"></span> Recruiter workspace</div><h1>Post requirements. Let <span>better matches</span> rise.</h1><p class="lead">Organizations define the skills they need. SkillBridge turns those requirements into structured opportunities students can be matched against.</p></div><div class="hero-stat"><div class="muted">Live listings</div><b>${state.opportunities.length}</b><div class="muted">visible to students</div></div></section><div class="grid"><section class="card"><div class="header"><div><div class="kicker">Create opportunity</div><h2>Internship requirements</h2></div><span class="pill">Organization</span></div><form id="orgForm"><div class="two"><label class="field">Company<input required name="company"></label><label class="field">Role title<input required name="title"></label></div><label class="field">Description<textarea required rows="5" name="description"></textarea></label><label class="field">Required skills<input name="skills" placeholder="react, sql, python"></label><label class="field">Relevant interests<input name="interests" placeholder="ai, product, analytics"></label><div class="three"><label class="field">Min experience<input type="number" min="0" value="0" name="minExperienceMonths"></label><label class="field">Mode<select name="mode"><option>Flexible</option><option>Remote</option><option selected>Hybrid</option><option>On-site</option></select></label><label class="field">Stipend<input name="stipend" value="₹15,000 / month"></label></div><label class="field">Location<input name="location" value="Bengaluru"></label><button class="btn primary" type="submit">＋ Publish internship</button></form></section><section class="card"><div class="header"><div><div class="kicker">Published</div><h2>Opportunity pool</h2></div></div><div class="posted-list">${state.opportunities
    .map(
      (o) =>
        `<div class="posted"><div class="logo">${esc(o.company[0])}</div><div><h3>${esc(o.title)}</h3><div class="sub">${esc(o.company)} · ${esc(o.location)}</div><div class="chips">${o.skills
          .slice(0, 4)
          .map((x) => `<span>${esc(fmt(x))}</span>`)
          .join("")}</div></div><span class="pill">${esc(o.mode)}</span></div>`,
    )
    .join("")}</div></section></div></main>`;
}
function render() {
  app.innerHTML = `<div class="app">${state.mode === "student" ? studentView() : orgView()}</div>`;
  bind();
}
function bind() {
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = async () => {
        state.mode = b.dataset.mode;
        render();
      }),
  );
  const ss = document.getElementById("studentSelect");
  if (ss)
    ss.onchange = async () => {
      state.student = state.students.find((x) => x.id === Number(ss.value));
      await reloadMatches();
      render();
    };
  const save = document.getElementById("saveProfile");
  if (save)
    save.onclick = async () => {
      const d = {
        name: val("name"),
        headline: val("headline"),
        skills: tags(val("skills")),
        interests: tags(val("interests")),
        experienceMonths: Number(val("experienceMonths")),
        preferredMode: val("preferredMode"),
        bio: val("bio"),
      };
      state.student = await api("/api/students/" + state.student.id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(d),
      });
      await reloadMatches();
      state.students = await api("/api/students");
      state.msg = "Profile updated — recommendations recalculated.";
      render();
      setTimeout(() => {
        state.msg = "";
        render();
      }, 2400);
    };
  const np = document.getElementById("newProfile");
  if (np) np.onclick = () => modal();
  document.querySelectorAll("[data-open]").forEach(
    (x) =>
      (x.onclick = () => {
        state.open =
          state.open === Number(x.dataset.open) ? null : Number(x.dataset.open);
        render();
      }),
  );
  const form = document.getElementById("orgForm");
  if (form)
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      await api("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: f.get("company"),
          title: f.get("title"),
          description: f.get("description"),
          skills: tags(f.get("skills")),
          interests: tags(f.get("interests")),
          minExperienceMonths: Number(f.get("minExperienceMonths")),
          mode: f.get("mode"),
          location: f.get("location"),
          stipend: f.get("stipend"),
        }),
      });
      await load();
      state.mode = "org";
      render();
    };
}
const val = (id) => document.getElementById(id).value;
function modal() {
  const wrap = document.createElement("div");
  wrap.className = "modal-wrap";
  wrap.innerHTML = `<div class="card modal"><div class="header"><div><div class="kicker">New profile</div><h2>Build a student profile</h2></div><button class="btn secondary close">✕</button></div><form id="newForm"><label class="field">Name<input required name="name"></label><label class="field">Headline<input name="headline"></label><label class="field">Skills<input name="skills" placeholder="javascript, react, sql"></label><label class="field">Interests<input name="interests" placeholder="ai, startups, design"></label><div class="two"><label class="field">Experience (months)<input type="number" min="0" value="0" name="experienceMonths"></label><label class="field">Preferred mode<select name="preferredMode"><option>Flexible</option><option>Remote</option><option>Hybrid</option><option>On-site</option></select></label></div><label class="field">Bio<textarea rows="3" name="bio"></textarea></label><div class="actions"><button type="button" class="btn secondary close2">Cancel</button><button class="btn primary">Create profile</button></div></form></div>`;
  document.body.appendChild(wrap);
  wrap.querySelector(".close").onclick = () => wrap.remove();
  wrap.querySelector(".close2").onclick = () => wrap.remove();
  wrap.querySelector("#newForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    state.student = await api("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.get("name"),
        headline: f.get("headline"),
        skills: tags(f.get("skills")),
        interests: tags(f.get("interests")),
        experienceMonths: Number(f.get("experienceMonths")),
        preferredMode: f.get("preferredMode"),
        bio: f.get("bio"),
      }),
    });
    await load();
    wrap.remove();
  };
}
load();
