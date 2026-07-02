import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const today = () => new Date().toISOString().split('T')[0];

const SECTIONS = [
  { key:'VARC',    color:'#ff5e5f', bg:'#fff1f1', border:'#ffc9c9' },
  { key:'DILR',    color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  { key:'QA',      color:'#0369a1', bg:'#f0f9ff', border:'#bae6fd' },
  { key:'General', color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
];
const secCfg = k => SECTIONS.find(s=>s.key===k) || SECTIONS[3];

// A task can be a plain to-do, or one of these test types — the latter
// get a full score-logging form (writes into test_scores, same table
// the Scores tab reads from) instead of a simple questions/hours log.
const TASK_TYPES = [
  { key:'todo',      label:'To-Do',      icon:'✅', color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
  { key:'mock',      label:'Mock Test',  icon:'📊', color:'#b45309', bg:'#fffbeb', border:'#fcd34d' },
  { key:'sectional', label:'Sectional',  icon:'📐', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  { key:'area_test', label:'Area Test',  icon:'🧪', color:'#0369a1', bg:'#f0f9ff', border:'#bae6fd' },
  { key:'quiz',      label:'Quiz',       icon:'✏️', color:'#059669', bg:'#ecfdf5', border:'#a7f3d0' },
];
const typeCfg = k => TASK_TYPES.find(t=>t.key===k) || TASK_TYPES[0];
const isTestType = t => t && t!=='todo';

// Score-section keys used in test_scores columns (varc_score, dilr_score, qa_score)
const SCORE_SECTIONS = [
  { key:'varc', label:'VARC' },
  { key:'dilr', label:'DILR' },
  { key:'qa',   label:'QA'   },
];
const DEFAULT_SCORE_SECTIONS = {
  mock:      ['varc','dilr','qa'],
  sectional: [],
  area_test: [],
  quiz:      [],
};
// Map the task's General/VARC/DILR/QA tag down to a score-section key, if any
const sectionToScoreKey = sec => ({VARC:'varc',DILR:'dilr',QA:'qa'}[sec] || null);

const EMPTY_SCORE_FORM = {
  sections: [],
  varc_score:'',varc_attempts:'',varc_accuracy:'',
  dilr_score:'',dilr_attempts:'',dilr_accuracy:'',
  qa_score:'',qa_attempts:'',qa_accuracy:'',
  total_score:'',percentile:'',overall_accuracy:'',rank:'',notes:'',
};
const num = v => (v===''||v==null) ? null : Number(v);

export default function MyPlanner() {
  const { user } = useAuth();
  const [tasks, setTasks]       = useState([]);
  const [subtasks, setSubtasks] = useState([]);
  const [myScores, setMyScores] = useState([]); // test_scores rows, for showing linked results
  const [loading, setLoading]   = useState(true);
  const [title, setTitle]       = useState('');
  const [date, setDate]         = useState('');
  const [section, setSection]   = useState('General');
  const [taskType, setTaskType] = useState('todo');
  const [adding, setAdding]     = useState(false);
  const [tab, setTab]           = useState('today');
  const [secFilter, setSecFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [notesDraft, setNotesDraft] = useState({});
  const [subDraft, setSubDraft] = useState({});
  const [toast, setToast]       = useState('');

  // Simple questions/hours log — for plain to-dos
  const [logTask, setLogTask] = useState(null);
  const [logQ, setLogQ]       = useState('');
  const [logH, setLogH]       = useState('');

  // Full score log — for mock/sectional/area_test/quiz tasks
  const [scoreLogTask, setScoreLogTask] = useState(null);
  const [scoreForm, setScoreForm] = useState(EMPTY_SCORE_FORM);
  const setSF = (k,v) => setScoreForm(f=>({...f,[k]:v}));

  function showToast(m){ setToast(m); setTimeout(()=>setToast(''),2000); }

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: t }, { data: st }, { data: sc }] = await Promise.all([
      supabase.from('student_tasks').select('*').eq('user_id', user.id).order('date', { ascending: true, nullsFirst: false }),
      supabase.from('student_subtasks').select('*').eq('user_id', user.id).order('created_at'),
      supabase.from('test_scores').select('*').eq('user_id', user.id),
    ]);
    setTasks(t || []);
    setSubtasks(st || []);
    setMyScores(sc || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function addTask() {
    if (!title.trim()) return;
    setAdding(true);
    const payload = { user_id: user.id, title: title.trim(), date: date || null, section, task_type: taskType, done: false };
    const { data, error } = await supabase.from('student_tasks').insert(payload).select().single();
    if (!error && data) setTasks(t => [...t, data]);
    setTitle(''); setDate(''); setAdding(false);
    showToast('✅ Added');
  }

  async function markUndone(t) {
    setTasks(ts => ts.map(x => x.id===t.id ? {...x, done:false} : x));
    await supabase.from('student_tasks').update({ done:false, updated_at: new Date().toISOString() }).eq('id', t.id);
  }

  async function removeTask(id) {
    setTasks(ts => ts.filter(x => x.id !== id));
    setSubtasks(ss => ss.filter(x => x.task_id !== id));
    await supabase.from('student_tasks').delete().eq('id', id);
  }

  function toggleExpand(t) {
    setExpanded(e => ({...e, [t.id]: !e[t.id]}));
    if (notesDraft[t.id]===undefined) setNotesDraft(d => ({...d, [t.id]: t.notes||''}));
  }

  async function saveNotes(t) {
    const val = notesDraft[t.id] ?? '';
    setTasks(ts => ts.map(x => x.id===t.id ? {...x, notes:val} : x));
    await supabase.from('student_tasks').update({ notes: val||null, updated_at: new Date().toISOString() }).eq('id', t.id);
    showToast('📝 Notes saved');
  }

  async function addSubtask(t) {
    const text = (subDraft[t.id]||'').trim();
    if (!text) return;
    const { data, error } = await supabase.from('student_subtasks')
      .insert({ task_id:t.id, user_id:user.id, title:text, done:false }).select().single();
    if (!error && data) setSubtasks(s => [...s, data]);
    setSubDraft(d => ({...d, [t.id]:''}));
  }

  async function toggleSubtask(st) {
    setSubtasks(ss => ss.map(x => x.id===st.id ? {...x, done:!x.done} : x));
    await supabase.from('student_subtasks').update({ done: !st.done }).eq('id', st.id);
  }

  async function delSubtask(id) {
    setSubtasks(ss => ss.filter(x => x.id !== id));
    await supabase.from('student_subtasks').delete().eq('id', id);
  }

  // ── Simple log (to-do) ──────────────────────────────────────
  function openLog(t) {
    setLogTask(t);
    setLogQ(t.questions_done ?? '');
    setLogH(t.study_hours ?? '');
  }
  async function saveLog() {
    const patch = {
      done: true,
      questions_done: logQ===''?null:Number(logQ),
      study_hours: logH===''?null:Number(logH),
      updated_at: new Date().toISOString(),
    };
    setTasks(ts => ts.map(x => x.id===logTask.id ? {...x, ...patch} : x));
    await supabase.from('student_tasks').update(patch).eq('id', logTask.id);
    setLogTask(null); showToast('✅ Logged');
  }

  // ── Full score log (mock/sectional/area_test/quiz) ─────────
  function openScoreLog(t) {
    const existing = t.test_score_id ? myScores.find(s=>s.id===t.test_score_id) : null;
    if (existing) {
      const sections = SCORE_SECTIONS.filter(({key})=>
        existing[`${key}_score`]!=null || existing[`${key}_attempts`]!=null || existing[`${key}_accuracy`]!=null
      ).map(s=>s.key);
      setScoreForm({
        sections: sections.length ? sections : (DEFAULT_SCORE_SECTIONS[t.task_type]||[]),
        varc_score:existing.varc_score??'', varc_attempts:existing.varc_attempts??'', varc_accuracy:existing.varc_accuracy??'',
        dilr_score:existing.dilr_score??'', dilr_attempts:existing.dilr_attempts??'', dilr_accuracy:existing.dilr_accuracy??'',
        qa_score:existing.qa_score??'',     qa_attempts:existing.qa_attempts??'',     qa_accuracy:existing.qa_accuracy??'',
        total_score:existing.total_score??'', percentile:existing.percentile??'',
        overall_accuracy:existing.overall_accuracy??'', rank:existing.rank??'', notes:existing.notes??'',
      });
    } else {
      const hint = sectionToScoreKey(t.section);
      const defaults = DEFAULT_SCORE_SECTIONS[t.task_type] || [];
      setScoreForm({ ...EMPTY_SCORE_FORM, sections: defaults.length ? defaults : (hint ? [hint] : []) });
    }
    setScoreLogTask(t);
  }

  function toggleScoreSection(key) {
    setScoreForm(f=>{
      const has = f.sections.includes(key);
      return { ...f, sections: has ? f.sections.filter(k=>k!==key) : [...f.sections, key] };
    });
  }

  async function saveScoreLog() {
    const t = scoreLogTask;
    const payload = {
      user_id:user.id, date:t.date||today(), test_name:t.title, test_type:t.task_type,
      varc_score:num(scoreForm.varc_score), varc_attempts:num(scoreForm.varc_attempts), varc_accuracy:num(scoreForm.varc_accuracy),
      dilr_score:num(scoreForm.dilr_score), dilr_attempts:num(scoreForm.dilr_attempts), dilr_accuracy:num(scoreForm.dilr_accuracy),
      qa_score:num(scoreForm.qa_score),     qa_attempts:num(scoreForm.qa_attempts),     qa_accuracy:num(scoreForm.qa_accuracy),
      total_score:num(scoreForm.total_score), percentile:num(scoreForm.percentile),
      overall_accuracy:num(scoreForm.overall_accuracy), rank:num(scoreForm.rank), notes:scoreForm.notes||null,
    };

    let scoreId = t.test_score_id;
    if (scoreId) {
      await supabase.from('test_scores').update(payload).eq('id', scoreId);
    } else {
      const { data } = await supabase.from('test_scores')
        .upsert(payload, { onConflict:'user_id,date,test_name' }).select().single();
      scoreId = data?.id;
    }

    const patch = { done:true, test_score_id: scoreId, updated_at: new Date().toISOString() };
    setTasks(ts => ts.map(x => x.id===t.id ? {...x, ...patch} : x));
    await supabase.from('student_tasks').update(patch).eq('id', t.id);

    setScoreLogTask(null);
    load(); // refresh myScores so the linked stat pill shows immediately
    showToast('✅ Score saved — it\'ll show in Scores too');
  }

  if (loading) return <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>;

  const t0 = today();
  const todayTasks    = tasks.filter(t => t.date === t0);
  const upcomingTasks = tasks.filter(t => t.date && t.date > t0);
  const somedayTasks  = tasks.filter(t => !t.date);
  let list = tab==='today' ? todayTasks : tab==='upcoming' ? upcomingTasks : tab==='someday' ? somedayTasks : tasks;
  if (secFilter!=='all') list = list.filter(t => (t.section||'General')===secFilter);

  const TABS = [
    ['today',`Today (${todayTasks.length})`],
    ['upcoming',`Upcoming (${upcomingTasks.length})`],
    ['someday',`Someday (${somedayTasks.length})`],
    ['all',`All (${tasks.length})`],
  ];

  const sectionTotals = SECTIONS.reduce((acc,sec)=>{
    const done = tasks.filter(t=>(t.section||'General')===sec.key && t.done);
    acc[sec.key] = {
      count: done.length,
      questions: done.reduce((a,t)=>a+(t.questions_done||0),0),
      hours: done.reduce((a,t)=>a+(t.study_hours||0),0),
    };
    return acc;
  },{});

  return (
    <div style={s.page} className="fade-in">
      <div>
        <h1 style={s.title}>🗒️ My Planner</h1>
        <p style={s.sub}>Your personal to-dos & custom schedule — only you can see this</p>
      </div>

      <div className="grid-4" style={{gap:10}}>
        {SECTIONS.map(sec=>{
          const t = sectionTotals[sec.key];
          return (
            <div key={sec.key} className="metric card-sm" style={{border:`1px solid ${sec.border}`}}>
              <p className="metric-label" style={{color:sec.color}}>{sec.key}</p>
              <p style={{fontSize:18,fontWeight:800,color:sec.color,fontFamily:'monospace'}}>{t.questions} Qs</p>
              <p style={{fontSize:11,color:'#94a3b8',marginTop:2}}>{t.hours.toFixed(1)}h · {t.count} tasks</p>
            </div>
          );
        })}
      </div>

      {/* Add task */}
      <div className="card" style={{display:'flex',flexDirection:'column',gap:10}}>
        <div>
          <label className="label">Task</label>
          <input className="input" placeholder="e.g. Revise Geometry formulas, or 'iQuant Sectional 12'"
            value={title} onChange={e=>setTitle(e.target.value)}
            onKeyDown={e=>e.key==='Enter' && addTask()} />
        </div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
          <div style={{flex:1,minWidth:150}}>
            <label className="label">Type</label>
            <select className="input" value={taskType} onChange={e=>setTaskType(e.target.value)}>
              {TASK_TYPES.map(tt=><option key={tt.key} value={tt.key}>{tt.icon} {tt.label}</option>)}
            </select>
          </div>
          <div style={{width:130}}>
            <label className="label">Section</label>
            <select className="input" value={section} onChange={e=>setSection(e.target.value)}>
              {SECTIONS.map(sec=><option key={sec.key} value={sec.key}>{sec.key}</option>)}
            </select>
          </div>
          <div style={{width:170}}>
            <label className="label">Date (optional)</label>
            <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={addTask} disabled={adding || !title.trim()}>
            {adding ? '…' : '+ Add'}
          </button>
        </div>
        {isTestType(taskType) && (
          <p style={{fontSize:11,color:'#94a3b8'}}>
            Marking a {typeCfg(taskType).label.toLowerCase()} done will ask for scores — they'll show up in your Scores tab automatically.
          </p>
        )}
      </div>

      <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div className="tabs" style={{alignSelf:'flex-start'}}>
          {TABS.map(([id,label]) => (
            <button key={id} className={`tab-btn ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="tabs" style={{alignSelf:'flex-start'}}>
          {['all',...SECTIONS.map(s=>s.key)].map(f=>(
            <button key={f} className={`tab-btn ${secFilter===f?'active':''}`} onClick={()=>setSecFilter(f)}>
              {f==='all'?'All Sections':f}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty-state">
          <span className="es-icon">🗒️</span>
          <h3>Nothing here yet</h3>
          <p>Add a task above to get started</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {list.map(t => {
            const c = secCfg(t.section||'General');
            const tc = typeCfg(t.task_type||'todo');
            const testType = isTestType(t.task_type);
            const hasLog = !testType && (t.questions_done!=null || t.study_hours!=null);
            const linkedScore = t.test_score_id ? myScores.find(sc=>sc.id===t.test_score_id) : null;
            const mySubs = subtasks.filter(x=>x.task_id===t.id);
            const subDone = mySubs.filter(x=>x.done).length;
            const isOpen = !!expanded[t.id];
            return (
              <div key={t.id} style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,overflow:'hidden'}}>
                <div className={`todo-item ${t.done?'done':''}`} style={{border:'none',borderRadius:0}}>
                  <button className={`todo-check ${t.done?'checked':''}`}
                    onClick={()=> t.done ? markUndone(t) : (testType ? openScoreLog(t) : openLog(t))}>
                    {t.done ? '✓' : ''}
                  </button>
                  {testType && (
                    <span className="badge" style={{background:tc.bg,color:tc.color,border:`1px solid ${tc.border}`,marginRight:6}}>{tc.icon} {tc.label}</span>
                  )}
                  <span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`,marginRight:8}}>{t.section||'General'}</span>
                  <span className="todo-title">{t.title}</span>
                  {hasLog && (
                    <button onClick={()=>openLog(t)}
                      style={{fontSize:11,fontWeight:700,color:'#ff5e5f',background:'#fff1f1',border:'1px solid #ffc9c9',borderRadius:99,padding:'2px 9px',cursor:'pointer',fontFamily:'inherit',marginRight:8}}>
                      🧮 {t.questions_done??0} Qs · ⏱ {t.study_hours??0}h
                    </button>
                  )}
                  {linkedScore && (
                    <button onClick={()=>openScoreLog(t)}
                      style={{fontSize:11,fontWeight:700,color:tc.color,background:tc.bg,border:`1px solid ${tc.border}`,borderRadius:99,padding:'2px 9px',cursor:'pointer',fontFamily:'inherit',marginRight:8}}>
                      {linkedScore.total_score!=null?`${linkedScore.total_score} pts`:''}
                      {linkedScore.percentile!=null?` · ${linkedScore.percentile}%ile`:''}
                      {linkedScore.total_score==null&&linkedScore.percentile==null?'View score':''}
                    </button>
                  )}
                  {t.date && <span className="todo-date">{t.date}</span>}
                  <button className="btn btn-ghost btn-sm" onClick={()=>toggleExpand(t)}>
                    {isOpen?'▲':'▼'} {mySubs.length>0?`${subDone}/${mySubs.length}`:''}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>removeTask(t.id)}>Del</button>
                </div>

                {isOpen && (
                  <div style={{padding:'12px 16px 16px 46px',borderTop:'1px solid #f1f5f9',background:'#f8fafc',display:'flex',flexDirection:'column',gap:12}}>
                    <div>
                      <p style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Subtasks</p>
                      <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:8}}>
                        {mySubs.map(st=>(
                          <div key={st.id} style={{display:'flex',alignItems:'center',gap:8}}>
                            <button className={`todo-check ${st.done?'checked':''}`} style={{width:18,height:18}}
                              onClick={()=>toggleSubtask(st)}>{st.done?'✓':''}</button>
                            <span style={{fontSize:13,flex:1,color:st.done?'#94a3b8':'#0f172a',textDecoration:st.done?'line-through':'none'}}>{st.title}</span>
                            <button className="btn btn-ghost btn-sm" onClick={()=>delSubtask(st.id)}>✕</button>
                          </div>
                        ))}
                        {mySubs.length===0 && <p style={{fontSize:12,color:'#94a3b8'}}>No subtasks yet — break this down below.</p>}
                      </div>
                      <div style={{display:'flex',gap:8}}>
                        <input className="input" style={{fontSize:12,padding:'6px 10px'}} placeholder="Add a subtask…"
                          value={subDraft[t.id]||''} onChange={e=>setSubDraft(d=>({...d,[t.id]:e.target.value}))}
                          onKeyDown={e=>e.key==='Enter' && addSubtask(t)} />
                        <button className="btn btn-ghost btn-sm" onClick={()=>addSubtask(t)}>+ Add</button>
                      </div>
                    </div>

                    <div>
                      <p style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>Notes</p>
                      <textarea className="input" style={{minHeight:64,fontSize:13}}
                        value={notesDraft[t.id]??t.notes??''}
                        onChange={e=>setNotesDraft(d=>({...d,[t.id]:e.target.value}))}
                        placeholder="Doubts, reference links, what to revise next…"/>
                      <button className="btn btn-ghost btn-sm" style={{marginTop:6}} onClick={()=>saveNotes(t)}>💾 Save Notes</button>
                    </div>

                    {testType && (
                      <button className="btn btn-ghost btn-sm" onClick={()=>openScoreLog(t)}>
                        {linkedScore ? '✏️ Edit Score' : '📊 Log Score'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Simple log modal — to-dos */}
      {logTask && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setLogTask(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-head">
              <h3>Log Progress</h3>
              <button className="close-btn" onClick={()=>setLogTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:13,color:'#64748b',marginTop:-6}}>{logTask.title}</p>
              <div className="grid-2">
                <div>
                  <label className="label">Questions Done</label>
                  <input className="input" type="number" value={logQ} onChange={e=>setLogQ(e.target.value)} placeholder="e.g. 20"/>
                </div>
                <div>
                  <label className="label">Hours Studied</label>
                  <input className="input" type="number" step="0.25" value={logH} onChange={e=>setLogH(e.target.value)} placeholder="e.g. 1.5"/>
                </div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={()=>setLogTask(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLog}>✓ Mark Done & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Full score log modal — mock/sectional/area_test/quiz */}
      {scoreLogTask && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setScoreLogTask(null)}>
          <div className="modal" style={{maxWidth:600}}>
            <div className="modal-head">
              <h3>{typeCfg(scoreLogTask.task_type).icon} Log {typeCfg(scoreLogTask.task_type).label} Score</h3>
              <button className="close-btn" onClick={()=>setScoreLogTask(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:13,color:'#64748b',marginTop:-6}}>{scoreLogTask.title}</p>

              <div>
                <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:6,borderBottom:'1px solid #f1f5f9',marginBottom:10}}>
                  Which sections does this cover?
                </div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {SCORE_SECTIONS.map(sec=>{
                    const checked = scoreForm.sections.includes(sec.key);
                    return (
                      <button key={sec.key} type="button" onClick={()=>toggleScoreSection(sec.key)}
                        style={{
                          padding:'6px 14px',borderRadius:99,fontSize:12,fontWeight:700,cursor:'pointer',
                          fontFamily:'inherit',border:`1.5px solid ${checked?'#ff5e5f':'#e2e8f0'}`,
                          background:checked?'#fff1f1':'#fff',color:checked?'#ff5e5f':'#94a3b8',
                        }}>
                        {checked?'✓ ':''}{sec.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {SCORE_SECTIONS.filter(sec=>scoreForm.sections.includes(sec.key)).map(({key:k,label:l})=>(
                <div key={k} style={{padding:'12px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #f1f5f9'}}>
                  <p style={{fontSize:12,fontWeight:700,color:'#ff5e5f',marginBottom:10}}>{l}</p>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                    {[['score','Score'],['attempts','Attempts'],['accuracy','Accuracy %']].map(([f,lb])=>(
                      <div key={f}>
                        <label className="label">{lb}</label>
                        <input className="input" type="number" value={scoreForm[`${k}_${f}`]}
                          onChange={e=>setSF(`${k}_${f}`,e.target.value)} placeholder="0"/>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:6,borderBottom:'1px solid #f1f5f9'}}>
                Overall Result
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {[['total_score','Total Score'],['percentile','Percentile'],['overall_accuracy','Accuracy %'],['rank','Rank']].map(([k,l])=>(
                  <div key={k}>
                    <label className="label">{l}</label>
                    <input className="input" type="number" value={scoreForm[k]} onChange={e=>setSF(k,e.target.value)} placeholder="—"/>
                  </div>
                ))}
              </div>

              <div>
                <label className="label">Notes / Takeaways</label>
                <textarea className="input" value={scoreForm.notes} onChange={e=>setSF('notes',e.target.value)}
                  placeholder="What went well? What to improve?" style={{minHeight:72}}/>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={()=>setScoreLogTask(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveScoreLog}>✓ Mark Done & Save Score</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast success">{toast}</div>}
    </div>
  );
}

const s = {
  page:{padding:'24px 28px',maxWidth:900,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
};
