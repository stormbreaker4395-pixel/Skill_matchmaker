const app = document.getElementById('app');
const USER = localStorage.getItem('skillbridge_user') || 'demo-student';
let role = localStorage.getItem('skillbridge_role') || 'student';
let page = 'dashboard';

const state = {
  profile: null,
  jobs: [],
  matches: [],
  applications: [],
  follows: [],
  feed: null,
  pulse: null,
  career: null,
  market: null,
  selected: null,
  filters: { q: '', mode: '', skill: '' }
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, function (c) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
  });
}

function listPills(items) {
  return (items || []).map(function (item) {
    return '<span class="pill">' + esc(item) + '</span>';
  }).join('');
}

function money(value) {
  return esc(value || 'Not specified');
}

async function api(url, options) {
  const opts = options || {};
  const headers = new Headers(opts.headers || {});
  headers.set('X-Local-User', USER);
  headers.set('X-Local-Role', role);
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  const response = await fetch(url, Object.assign({}, opts, { headers: headers }));
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(data.error || ('Request failed (' + response.status + ')'));
  return data;
}

function card(title, body) {
  return '<section class="card"><div class="card-head"><h3>' + title + '</h3></div>' + body + '</section>';
}

function hero(title, subtitle) {
  return '<div class="hero"><span class="eyebrow">AI-POWERED CAREER PLATFORM</span><h1>' + title + '</h1><p>' + subtitle + '</p></div>';
}

function stat(label, value, note) {
  return '<div class="stat"><span>' + label + '</span><b>' + esc(value) + '</b><small>' + (note || '') + '</small></div>';
}

function navItems() {
  if (role === 'student') {
    return [
      ['dashboard', 'Dashboard'],
      ['discover', 'Discover Jobs'],
      ['following', 'Following'],
      ['applications', 'Applications'],
      ['pulse', 'SkillPulse'],
      ['career', 'Career Path'],
      ['interview', 'Interview Prep']
    ];
  }
  return [
    ['dashboard', 'Overview'],
    ['talent', 'Talent Market'],
    ['post', 'Post Opportunity'],
    ['intel', 'Market Intel']
  ];
}

function shell(content) {
  const links = navItems().map(function (item) {
    return '<button class="nav-btn ' + (page === item[0] ? 'active' : '') + '" data-page="' + item[0] + '">' + item[1] + '</button>';
  }).join('');

  app.innerHTML =
    '<div class="app-shell">' +
      '<header class="topbar">' +
        '<div class="brand">' +
          '<div class="brand-mark">S</div>' +
          '<div><b>SkillBridge</b><small>Student Skill Matcher</small></div>' +
        '</div>' +
        '<nav>' + links + '</nav>' +
        '<div class="top-actions"><span class="role-badge">' + esc(role) + '</span><button id="switch" class="ghost">Switch role</button></div>' +
      '</header>' +
      '<main>' + content + '</main>' +
      '<footer>SkillBridge • local development mode</footer>' +
    '</div>';

  document.querySelectorAll('[data-page]').forEach(function (button) {
    button.onclick = function () {
      page = button.dataset.page;
      state.selected = null;
      render();
    };
  });

  const switchButton = document.getElementById('switch');
  if (switchButton) {
    switchButton.onclick = function () {
      role = role === 'student' ? 'organization' : 'student';
      localStorage.setItem('skillbridge_role', role);
      page = 'dashboard';
      state.selected = null;
      render();
    };
  }
}

async function loadStudent() {
  const students = await api('/api/students');
  state.profile = students[0] || null;
  if (!state.profile) throw new Error('No student profile found.');

  const results = await Promise.all([
    api('/api/opportunities'),
    api('/api/applications'),
    api('/api/follows'),
    api('/api/matches/' + state.profile.id)
  ]);
  state.jobs = results[0] || [];
  state.applications = results[1] || [];
  state.follows = results[2] || [];
  state.matches = results[3] && results[3].matches ? results[3].matches : [];
}

async function loadOrg() {
  const results = await Promise.all([api('/api/opportunities'), api('/api/market')]);
  state.jobs = results[0] || [];
  state.market = results[1] || null;
}

function jobCard(job) {
  const followed = state.follows.some(function (item) { return item.company === job.company; });
  const application = state.applications.find(function (item) { return item.opportunityId === job.id; });

  let action = '<button class="primary apply" data-id="' + job.id + '">Apply</button>';
  if (application) action = '<span class="pill">' + esc(application.status) + '</span>';

  return '<article class="job-card">' +
    '<div class="job-top"><span class="company">' + esc(job.company) + '</span>' +
    '<button class="icon-btn follow" data-company="' + esc(job.company) + '">' + (followed ? '★' : '☆') + '</button></div>' +
    '<h3>' + esc(job.title) + '</h3>' +
    '<p>' + esc(job.description) + '</p>' +
    '<div>' + listPills(job.skills) + '</div>' +
    '<div class="job-meta"><span>' + esc(job.location) + '</span><span>' + esc(job.mode) + '</span><span>' + money(job.stipend) + '</span></div>' +
    '<div class="row"><button class="secondary details" data-id="' + job.id + '">Details</button>' + action + '</div>' +
  '</article>';
}

function matchCard(match) {
  const job = match.opportunity;
  if (!job) return '';
  const reasons = (match.personalizedReasons || match.reasons || []).slice(0, 2).map(esc).join(' • ');
  return '<div class="match"><div><b>' + esc(job.company) + '</b><h4>' + esc(job.title) + '</h4>' +
    '<small>' + esc(job.mode) + ' • ' + esc(job.location) + '</small><div>' + listPills(job.skills) + '</div>' +
    '<small>' + reasons + '</small></div><div class="score">' + Math.round(match.score || 0) + '<small>% fit</small></div></div>';
}

async function dashboard() {
  const recommendations = await api('/api/recommendations');
  const profile = state.profile;
  return hero('Build your next move, ' + esc(profile.name || 'student') + '.', 'Your recommendations learn from your skills, applications and followed companies.') +
    '<div class="stats">' +
      stat('Profile skills', (profile.skills || []).length) +
      stat('Recommendations', (recommendations.matches || []).length) +
      stat('Applications', state.applications.length) +
      stat('Following', state.follows.length) +
    '</div>' +
    '<div class="grid-2">' +
      card('Personalized recommendations', (recommendations.matches || []).slice(0, 5).map(matchCard).join('') || '<div class="empty">No recommendations yet.</div>') +
      card('AI Profile Builder', '<p>Describe yourself naturally and let SkillBridge extract useful profile signals.</p><textarea id="profile-text" placeholder="I am a second-year CSE student who knows Python, React and SQL and want frontend or AI internships."></textarea><button id="analyze" class="primary">Analyze</button><div id="ai-out"></div>') +
    '</div>';
}

function discover() {
  const jobs = state.jobs.filter(function (job) {
    const query = (state.filters.q || '').toLowerCase();
    const haystack = [job.company, job.title, job.description].concat(job.skills || []).join(' ').toLowerCase();
    const matchesQuery = !query || haystack.includes(query);
    const matchesMode = !state.filters.mode || job.mode === state.filters.mode;
    const matchesSkill = !state.filters.skill || (job.skills || []).some(function (skill) { return skill.toLowerCase() === state.filters.skill; });
    return matchesQuery && matchesMode && matchesSkill;
  });

  return hero('Discover opportunities', 'Search roles, follow companies and get explainable recommendations.') +
    '<section class="card"><div class="filters">' +
      '<input id="q" value="' + esc(state.filters.q) + '" placeholder="Search role, company or skill">' +
      '<select id="mode"><option value="">Any mode</option><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="On-site">On-site</option><option value="Flexible">Flexible</option></select>' +
      '<input id="skill" value="' + esc(state.filters.skill) + '" placeholder="Skill">' +
      '<button id="search" class="primary">Search</button>' +
    '</div></section>' +
    '<div class="job-grid">' + (jobs.map(jobCard).join('') || '<div class="empty">No matching opportunities.</div>') + '</div>';
}

async function following() {
  state.feed = await api('/api/feed');
  const companies = state.feed.following || [];
  const items = state.feed.items || [];
  const feedHtml = items.map(function (company) {
    const roles = (company.roles || []).map(function (job) {
      return '<div class="signal"><div><b>' + esc(job.title) + '</b><span>' + esc(job.location) + ' • ' + esc(job.mode) + ' • ' + money(job.stipend) + '</span></div><button class="secondary details" data-id="' + job.id + '">Open</button></div>';
    }).join('');
    return '<article class="feed-item"><b>' + esc(company.company) + '</b><p>' + esc(company.summary) + '</p>' + roles + '</article>';
  }).join('');

  return hero('Following', 'Company updates and opportunities from the organisations you follow.') +
    card('Your companies', companies.length ? companies.map(function (name) { return '<span class="pill">★ ' + esc(name) + '</span>'; }).join('') : '<div class="empty">Follow a company from Discover Jobs.</div>') +
    card('Company feed', feedHtml || '<div class="empty">Nothing in your feed yet.</div>');
}

function applications() {
  const stages = ['Saved', 'Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected', 'Withdrawn'];
  return hero('Application Tracker', 'Keep every opportunity moving with notes and status updates.') +
    '<div class="app-board">' + stages.map(function (stage) {
      const rows = state.applications.filter(function (item) { return item.status === stage; }).map(function (item) {
        return '<article class="app-item"><b>' + esc(item.title) + '</b><span>' + esc(item.company) + '</span><small>' + esc(item.note || 'No note') + '</small><div class="row"><button class="secondary app-open" data-id="' + item.opportunityId + '">Open</button></div></article>';
      }).join('');
      return '<section class="app-column"><div class="column-head"><b>' + stage + '</b><span>' + state.applications.filter(function (item) { return item.status === stage; }).length + '</span></div>' + (rows || '<div class="empty">Empty</div>') + '</section>';
    }).join('') + '</div>';
}

async function pulse() {
  state.pulse = await api('/api/ai/skillpulse');
  const p = state.pulse;
  return hero('SkillPulse', 'Understand your relative skill profile and market signals.') +
    '<div class="stats">' + stat('Similar students', p.similarStudents || 0) + stat('Differentiators', (p.differentiators || []).length) + stat('Suggested skills', (p.suggestedSkills || []).length) + stat('Market signals', (p.commonSkills || []).length) + '</div>' +
    '<div class="grid-2">' +
      card('Common skills', (p.commonSkills || []).map(function (item) { return '<div class="signal"><b>' + esc(item.skill) + '</b><span>' + esc(item.rarity) + '% rarity</span></div>'; }).join('') || '<div class="empty">No data.</div>') +
      card('Suggested next skills', (p.suggestedSkills || []).map(function (item) { return '<div class="signal"><b>' + esc(item.skill) + '</b><span>' + esc(item.demand) + '% demand • ' + esc(item.rarity) + '% rarity</span></div>'; }).join('') || '<div class="empty">No suggestions.</div>') +
    '</div>';
}

async function career() {
  state.career = await api('/api/ai/career?role=software%20engineer');
  const current = listPills(state.career.currentSkills);
  const missing = listPills(state.career.missingSkills);
  return hero('Career Path', 'Translate your current profile into a practical roadmap.') + card('Software Engineer',
    '<div class="roadmap"><div><b>1</b><span>Current</span><p>' + current + '</p></div><div><b>2</b><span>Missing</span><p>' + missing + '</p></div><div><b>3</b><span>Evidence</span><p>Build projects that demonstrate the missing skills.</p></div></div>');
}

async function interview() {
  const job = state.jobs[0];
  if (!job) return hero('Interview Prep', 'No jobs available yet.');
  const data = await api('/api/ai/interview/' + job.id);
  const questions = (data.questions || []).map(function (question) {
    return '<div class="question"><b>' + esc(question.id) + '.</b><span>' + esc(question.question) + '</span></div>';
  }).join('');
  return hero('Prepare for ' + esc(job.title), 'Questions are generated from the role requirements and your profile.') + card('Practice', questions || '<div class="empty">No questions generated.</div>');
}

function talent() {
  const skills = state.market && state.market.skills ? state.market.skills.slice(0, 15) : [];
  const total = state.market ? state.market.students || 1 : 1;
  return hero('Talent Market', 'Aggregate-only student skill and role supply.') + card('Skill distribution', skills.map(function (item) {
    const width = Math.max(5, Math.min(100, (item.students / total) * 100));
    return '<div class="bar-row"><b>' + esc(item.skill) + '</b><div class="bar"><i style="width:' + width + '%"></i></div><span>' + esc(item.students) + ' students</span></div>';
  }).join('') || '<div class="empty">No market data.</div>');
}

function post() {
  return hero('Post an opportunity', 'Describe the role and let the local AI parser structure it.') +
    card('New opportunity', '<div class="form-grid">' +
      '<input id="company" placeholder="Company">' +
      '<input id="title" placeholder="Role title">' +
      '<input id="location" placeholder="Location">' +
      '<input id="industry" placeholder="Industry">' +
      '<select id="pmode"><option>Remote</option><option>Hybrid</option><option>On-site</option><option>Flexible</option></select>' +
      '<input id="stipend" placeholder="Stipend">' +
      '<input id="years" placeholder="Target years: 2,3">' +
      '<textarea id="desc" class="span-2" placeholder="Responsibilities, skills, experience..."></textarea>' +
    '</div><button id="create" class="primary">Publish</button><div id="post-out"></div>');
}

function intel() {
  return hero('Market Intelligence', 'See the current visible role landscape.') +
    '<div class="intel-grid">' +
      stat('Students', state.market ? state.market.students : 0) +
      stat('Opportunities', state.market ? state.market.opportunities : 0) +
      stat('Tracked skills', state.market && state.market.skills ? state.market.skills.length : 0) +
    '</div>' +
    card('Open roles', state.jobs.map(function (job) {
      return '<div class="intel"><div><b>' + esc(job.company) + '</b><span>' + esc(job.title) + '</span></div><strong>' + money(job.stipend) + '</strong></div>';
    }).join('') || '<div class="empty">No visible roles.</div>');
}

function details() {
  const job = state.selected;
  if (!job) return discover();
  const match = state.matches.find(function (item) { return item.opportunity && item.opportunity.id === job.id; });
  const application = state.applications.find(function (item) { return item.opportunityId === job.id; });
  let right = '<button class="primary apply" data-id="' + job.id + '">Apply now</button>';
  if (application) {
    right = '<div class="application-detail"><select id="status">' +
      ['Saved', 'Applied', 'Shortlisted', 'Interview', 'Offer', 'Rejected', 'Withdrawn'].map(function (status) {
        return '<option value="' + status + '" ' + (application.status === status ? 'selected' : '') + '>' + status + '</option>';
      }).join('') +
      '</select><textarea id="note">' + esc(application.note || '') + '</textarea><button id="save-app" class="primary" data-id="' + application.id + '">Save</button></div>';
  }

  return hero(esc(job.title), esc(job.company) + ' • ' + esc(job.location) + ' • ' + esc(job.mode)) +
    '<div class="grid-2">' +
      card('Opportunity', '<p>' + esc(job.description) + '</p><div>' + listPills(job.skills) + '</div><p>' + money(job.stipend) + '</p>') +
      card('Your fit', match ? '<div class="big-fit">' + Math.round(match.score || 0) + '%</div><p>' + esc((match.reasons || []).join(' • ')) + '</p>' : '<p>No match score available.</p>') +
      card(application ? 'Application' : 'Apply', right) +
    '</div>';
}

async function render() {
  try {
    if (role === 'student') await loadStudent();
    else await loadOrg();

    let content;
    if (state.selected) content = details();
    else if (page === 'dashboard') content = role === 'student' ? await dashboard() : hero('Talent, without the noise', (state.market ? state.market.students : 0) + ' students • ' + state.jobs.length + ' visible opportunities');
    else if (page === 'discover') content = discover();
    else if (page === 'following') content = await following();
    else if (page === 'applications') content = applications();
    else if (page === 'pulse') content = await pulse();
    else if (page === 'career') content = await career();
    else if (page === 'interview') content = await interview();
    else if (page === 'talent') content = talent();
    else if (page === 'post') content = post();
    else content = intel();

    shell(content);
    bind();
  } catch (error) {
    shell('<div class="error"><b>SkillBridge could not load this view.</b><p>' + esc(error.message) + '</p><button id="retry" class="primary">Retry</button></div>');
    const retry = document.getElementById('retry');
    if (retry) retry.onclick = render;
  }
}

function bind() {
  const search = document.getElementById('search');
  if (search) search.onclick = function () {
    state.filters.q = document.getElementById('q').value.trim();
    state.filters.mode = document.getElementById('mode').value;
    state.filters.skill = document.getElementById('skill').value.trim().toLowerCase();
    render();
  };

  document.querySelectorAll('.details, .app-open').forEach(function (button) {
    button.onclick = function () {
      state.selected = state.jobs.find(function (job) { return job.id === Number(button.dataset.id); }) || null;
      render();
    };
  });

  document.querySelectorAll('.apply').forEach(function (button) {
    button.onclick = async function () {
      await api('/api/applications', { method: 'POST', body: JSON.stringify({ opportunityId: Number(button.dataset.id) }) });
      render();
    };
  });

  document.querySelectorAll('.follow').forEach(function (button) {
    button.onclick = async function () {
      await api('/api/follows', { method: 'POST', body: JSON.stringify({ company: button.dataset.company }) });
      state.feed = null;
      render();
    };
  });

  const analyze = document.getElementById('analyze');
  if (analyze) analyze.onclick = async function () {
    const text = document.getElementById('profile-text').value.trim();
    if (!text) return;
    const result = await api('/api/ai/profile', { method: 'POST', body: JSON.stringify({ text: text }) });
    document.getElementById('ai-out').innerHTML = card('Extracted profile', '<p>' + listPills(result.skills) + '</p><p>' + listPills(result.interests) + '</p><small>' + esc(result.headline || '') + '</small>');
  };

  const saveApp = document.getElementById('save-app');
  if (saveApp) saveApp.onclick = async function () {
    await api('/api/applications/' + encodeURIComponent(saveApp.dataset.id), {
      method: 'PUT',
      body: JSON.stringify({
        status: document.getElementById('status').value,
        note: document.getElementById('note').value
      })
    });
    render();
  };

  const create = document.getElementById('create');
  if (create) create.onclick = async function () {
    const years = (document.getElementById('years').value.match(/\d+/g) || []).map(Number);
    const body = {
      company: document.getElementById('company').value.trim(),
      title: document.getElementById('title').value.trim(),
      location: document.getElementById('location').value.trim(),
      industry: document.getElementById('industry').value.trim(),
      mode: document.getElementById('pmode').value,
      stipend: document.getElementById('stipend').value.trim(),
      targetYears: years,
      description: document.getElementById('desc').value.trim()
    };
    const result = await api('/api/opportunities', { method: 'POST', body: JSON.stringify(body) });
    document.getElementById('post-out').innerHTML = '<div class="ai-result">Published ' + esc(result.title) + ' with ' + esc(result.skills ? result.skills.length : 0) + ' extracted skills.</div>';
    await loadOrg();
  };
}

render();
