const STORAGE_KEY = 'experiences_os_v3_entries';
const LEGACY_KEY = 'experiences_os_v2_entries';
const THEME_KEY = 'experiences_os_theme';

const domains = {
  relationships: { label:'Relationships', signal:'Connection', icon:'◌', color:'#12a667', prompts:['Family time','Friendship','Community event','Meaningful conversation','Shared activity'] },
  growth: { label:'Growth', signal:'Expansion', icon:'↗', color:'#7c3aed', prompts:['New place','New activity','Culture / ideas','Learning moment','Travel / exploration'] },
  contribution: { label:'Contribution', signal:'Helping', icon:'✚', color:'#f97316', prompts:['Helped someone','Mentored','Supported family','Volunteer work','Gave someone a ride'] },
  achievement: { label:'Achievement', signal:'Progress', icon:'✓', color:'#0284c7', prompts:['Finished a project','Deployed a tool','Completed task','Sent outreach','Meaningful progress'] }
};

const legacyMap = {
  community:'relationships',
  social:'relationships',
  service:'contribution',
  culture:'growth',
  exploration:'growth',
  achievement:'achievement'
};

let entries = loadEntries();
let activeDate = todayKey();

function migrateEntry(e){
  const originalDomains = Array.isArray(e.domains) ? e.domains : [e.domain].filter(Boolean);
  const mapped = [...new Set(originalDomains.map(d => domains[d] ? d : (legacyMap[d] || 'growth')).filter(Boolean))];
  const nextDomains = mapped.length ? mapped : ['growth'];
  return { ...e, domain: nextDomains[0], domains: nextDomains, migratedFrom: originalDomains.some((d,i)=>d!==nextDomains[i]) ? originalDomains : e.migratedFrom };
}
function migrateEntries(raw){ return raw.map(migrateEntry); }

function todayKey(d=new Date()){
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function parseKey(key){ return new Date(`${key}T12:00:00`); }
function shiftDate(key, delta){ const d=parseKey(key); d.setDate(d.getDate()+delta); return todayKey(d); }
function timeText(iso){ return new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', hour12:false}); }
function dateLabel(key){
  if(key === todayKey()) return 'Today';
  const d=parseKey(key);
  return d.toLocaleDateString([], {weekday:'short', month:'short', day:'numeric'});
}
function fullDateLabel(key){ return parseKey(key).toLocaleDateString([], {weekday:'short', month:'short', day:'numeric', year:'numeric'}); }
function greetingText(){
  const hour = new Date().getHours();
  if(hour < 12) return 'Good morning, Rob.';
  if(hour < 17) return 'Good afternoon, Rob.';
  return 'Good evening, Rob.';
}
function loadEntries(){
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    if(current.length) return migrateEntries(current);
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY)) || [];
    if(legacy.length){
      const migrated = migrateEntries(legacy);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return [];
  } catch { return []; }
}
function persist(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); }
function getEntries(domain, key=activeDate){ return entries.filter(e => e.date === key && (!domain || e.domains?.includes(domain) || e.domain === domain)); }
function escapeHtml(str=''){ return String(str).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function setText(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }

function init(){
  const savedTheme = localStorage.getItem(THEME_KEY);
  if(savedTheme === 'dark') document.documentElement.classList.add('dark');

  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
  document.querySelectorAll('.quick-form').forEach(form => form.addEventListener('submit', handleSubmit));
  document.getElementById('themeBtn')?.addEventListener('click', toggleTheme);

  document.querySelectorAll('.date-pill').forEach(pill=>{
    const [prev,next] = pill.querySelectorAll('button');
    prev?.addEventListener('click',()=>changeDate(-1));
    next?.addEventListener('click',()=>changeDate(1));
  });

  document.querySelectorAll('.type-option').forEach(btn=>{
    btn.addEventListener('click',()=>toggleCaptureType(btn.dataset.type));
  });

  document.getElementById('exportBtn')?.addEventListener('click', exportData);
  document.getElementById('importFile')?.addEventListener('change', importData);
  document.getElementById('clearBtn')?.addEventListener('click', clearAll);
  renderChips(); render();
}

function switchView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===id));
  window.scrollTo({top:0, behavior:'smooth'});
}
function changeDate(delta){ activeDate = shiftDate(activeDate, delta); render(); }

function selectedCaptureTypes(){
  return [...document.querySelectorAll('.type-option.active')].map(btn=>btn.dataset.type);
}
function toggleCaptureType(type){
  const btn=document.querySelector(`.type-option[data-type="${type}"]`);
  btn?.classList.toggle('active');
  if(selectedCaptureTypes().length === 0) btn?.classList.add('active');
}

function handleSubmit(e){
  e.preventDefault();
  const form=e.currentTarget;
  const textarea=form.querySelector('textarea');
  const text=textarea?.value.trim();
  if(!text) { textarea.focus(); return; }

  let selectedDomains = [];
  if(form.dataset.domain === 'capture'){
    selectedDomains = selectedCaptureTypes();
  } else {
    selectedDomains = [form.dataset.domain];
  }

  entries.unshift({ 
    id: uid(), 
    domain: selectedDomains[0], 
    domains: selectedDomains,
    text, 
    meta:{}, 
    date: activeDate, 
    createdAt: new Date().toISOString() 
  });
  persist();
  form.reset();
  render();
}
function uid(){ return (crypto && crypto.randomUUID) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`; }

function getDomainScore(domain, key=activeDate){
  const n=getEntries(domain, key).length;
  return Math.min(100, n*25);
}

function render(){ renderDates(); renderDashboard(); renderDomainEntries(); renderMetrics(); }
function renderDates(){
  setText('todayDate', fullDateLabel(activeDate));
  document.querySelectorAll('.date-pill span').forEach(s=>s.textContent=dateLabel(activeDate));
}
function renderMetrics(){
  Object.keys(domains).forEach(domain=>{
    const count=getEntries(domain).length;
    setText(`${domain}Metric`, `${count} entr${count===1?'y':'ies'}`);
    setText(`${domain}Sub`, count ? `${count} captured today` : 'Not logged');
    setText(`${domain}Score`, getDomainScore(domain));
  });
}
function hexToSoft(hex){
  const map={'#12a667':'#dcfce7','#7c3aed':'#ede9fe','#f97316':'#ffedd5','#0284c7':'#e0f2fe'};
  return map[hex] || '#f3f7fc';
}
function renderDashboard(){
  setText('greeting', greetingText());
  const cardWrap=document.getElementById('domainCards');
  if(cardWrap) cardWrap.innerHTML=Object.keys(domains).map(key=>{
    const d=domains[key]; const count=getEntries(key).length; const score=getDomainScore(key);
    const meta=count ? `${count} entr${count===1?'y':'ies'} · ${dateLabel(activeDate)}` : 'Not logged';
    return `<article class="summary-row" onclick="switchView('${key}')"><div class="summary-icon" style="background:${hexToSoft(d.color)};color:${d.color}">${d.icon}</div><div><div class="summary-title">${d.label}</div><div class="summary-meta">${meta}</div></div><div class="summary-score">${score}<div class="small muted">/100</div></div><div class="chev">›</div></article>`;
  }).join('');
  const dayEntries=getEntries(); 
  setText('entryCount', `${dayEntries.length} ${dayEntries.length===1?'entry':'entries'}`);
  const list=document.getElementById('todayEntries');
  if(list){ list.classList.toggle('empty', !dayEntries.length); list.innerHTML=dayEntries.length ? dayEntries.map(entryHtml).join('') : 'No experiences yet.'; }
  renderWeekBars();
}
function renderWeekBars(){
  const wrap=document.getElementById('weekBars'); if(!wrap) return;
  const now=parseKey(activeDate); const days=[];
  for(let i=6;i>=0;i--){ 
    const d=new Date(now); d.setDate(now.getDate()-i); const key=todayKey(d); 
    const completed=Object.keys(domains).filter(domain=>entries.some(e=>e.date===key && (e.domains?.includes(domain) || e.domain===domain))).length; 
    days.push({key,completed}); 
  }
  wrap.innerHTML=days.map(day=>`<div class="bar-wrap"><div class="bar" style="height:${Math.max(6, day.completed/4*78)}px"></div><span>${dateLabel(day.key).split(' ')[0]}</span></div>`).join('');
  setText('trendLabel', days.at(-1).completed>=3?'Rich day':'Building signal');
}
function renderDomainEntries(){
  document.querySelectorAll('.domain-view').forEach(view=>{
    const domain=view.dataset.domain; const target=view.querySelector('.domain-entries'); if(!target) return;
    const items=getEntries(domain).slice(0,50);
    target.innerHTML=items.length ? items.map(entryHtml).join('') : `<div class="empty-card muted">No ${domains[domain].label.toLowerCase()} entries for ${dateLabel(activeDate).toLowerCase()}.</div>`;
  });
}
function entryHtml(e){
  const primary=e.domain;
  const title=(e.domains||[primary]).map(d=>domains[d]?.label).filter(Boolean).join(' · ');
  const migrated = Array.isArray(e.migratedFrom) ? `<span class="tag">from ${e.migratedFrom.map(escapeHtml).join(' / ')}</span>` : '';
  return `<article class="entry"><div class="entry-top"><span>${title}</span><span>${e.date===todayKey()?timeText(e.createdAt):dateLabel(e.date)}</span></div><div class="entry-main">${escapeHtml(e.text)}</div>${migrated ? `<div class="tag-row">${migrated}</div>` : ''}<div class="entry-actions"><button class="delete" type="button" onclick="deleteEntry('${e.id}')">Delete</button></div></article>`;
}
function deleteEntry(id){ entries=entries.filter(e=>e.id!==id); persist(); render(); }

function renderChips(){
  document.querySelectorAll('.chips').forEach(chipWrap=>{
    const domain=chipWrap.dataset.target;
    chipWrap.innerHTML=domains[domain].prompts.map(p=>`<button type="button">${p}</button>`).join('');
    chipWrap.querySelectorAll('button').forEach(btn=>btn.addEventListener('click',()=>fillPrompt(domain,btn.textContent)));
  });
}
function fillPrompt(domain,text){
  const view=document.querySelector(`.domain-view[data-domain="${domain}"]`) || document.getElementById('capture');
  const ta=view?.querySelector('textarea'); if(!ta) return;
  ta.value = ta.value ? `${ta.value}\n${text}` : text; 
  if(view.id === 'capture'){
    document.querySelectorAll('.type-option').forEach(btn=>btn.classList.remove('active'));
    document.querySelector(`.type-option[data-type="${domain}"]`)?.classList.add('active');
  }
  ta.focus();
}
function toggleTheme(){ document.documentElement.classList.toggle('dark'); localStorage.setItem(THEME_KEY, document.documentElement.classList.contains('dark')?'dark':'light'); }
function exportData(){ const blob=new Blob([JSON.stringify({app:'Experience OS',version:'3.0',exportedAt:new Date().toISOString(),entries}, null, 2)], {type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`experience-os-v3-export-${todayKey()}.json`; a.click(); URL.revokeObjectURL(a.href); }
function importData(ev){
  const file=ev.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(Array.isArray(data.entries)){
        entries=[...migrateEntries(data.entries), ...entries];
        persist(); render(); alert('Import complete.');
      } else alert('Import file did not contain entries.');
    }catch{ alert('Could not import JSON.'); }
  };
  reader.readAsText(file); ev.target.value='';
}
function clearAll(){ if(confirm('Clear all Experience OS entries on this device?')){ entries=[]; persist(); render(); } }

window.deleteEntry=deleteEntry; window.switchView=switchView; init();
