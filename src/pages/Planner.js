import { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useProgress } from '../hooks/useProgress';
import { SCHEDULE, STEPS, TYPE_CFG, groupByMonth } from '../lib/schedule';
import StudyTimer from '../components/StudyTimer';

const today = new Date().toISOString().split('T')[0];

export default function Planner() {
  const { user } = useAuth();
  const { progress, loading, upsertProgress } = useProgress();
  const [selDate, setSelDate] = useState(()=>SCHEDULE.find(d=>d.date>=today)?.date||SCHEDULE[0].date);
  const [notes, setNotes]     = useState('');
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState('');
  const [filter, setFilter]   = useState('all');
  const [search, setSearch]   = useState('');
  const [collapsed, setCollapsed] = useState({});

  const entry = SCHEDULE.find(d=>d.date===selDate);
  const prog  = progress[selDate]||{};
  const cfg   = entry ? TYPE_CFG[entry.type] : null;

  useEffect(()=>{ setNotes(progress[selDate]?.notes||''); },[selDate,progress]);

  function showToast(m){ setToast(m); setTimeout(()=>setToast(''),2200); }

  function scrollToToday() {
    setSelDate(today);
    document.getElementById('today-item')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function toggleStep(n) {
    const cur = prog[`step${n}`]||false;
    await upsertProgress(selDate,{[`step${n}`]:!cur});
  }

  async function toggleDone(val) {
    await upsertProgress(selDate,{task_done:val,is_backlog:!val,backlog_cleared:false});
    showToast(val?'✅ Marked done!':'Marked as pending');
  }

  async function markBacklog() {
    await upsertProgress(selDate,{is_backlog:true,task_done:false});
    showToast('📌 Added to backlog');
  }

  async function saveNotes() {
    setSaving(true);
    await upsertProgress(selDate,{notes});
    setSaving(false); showToast('Notes saved');
  }

  const stepsDone = entry?.type==='class' ? STEPS.filter(s=>prog[`step${s.num}`]).length : 0;

  const filtered = SCHEDULE.filter(d=>{
    if(filter!=='all'&&d.type!==filter) return false;
    if(search){ const q=search.toLowerCase(); return d.topic.toLowerCase().includes(q)||d.date.includes(q); }
    return true;
  });

  const groups = groupByMonth(filtered);

  return (
    <div style={s.layout}>
      {/* LIST PANEL */}
      <div style={s.listWrap}>
        <div style={s.listTop}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontSize:14,fontWeight:700,color:'#0f172a'}}>Schedule</p>
            <button className="btn btn-ghost btn-sm" onClick={scrollToToday}>Today ↓</button>
          </div>
          <input className="input" placeholder="Search…" value={search}
            onChange={e=>setSearch(e.target.value)} style={{fontSize:12,padding:'6px 10px'}}/>
          <div style={{display:'flex',flexWrap:'wrap',gap:3}}>
            {['all','class','mock','sectional','area_test','marathon'].map(f=>(
              <button key={f} onClick={()=>setFilter(f)} style={{
                padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:600,
                border:`1px solid ${filter===f?(TYPE_CFG[f]?.border||'#ffc9c9'):'#e2e8f0'}`,
                background:filter===f?(TYPE_CFG[f]?.bg||'#fff1f1'):'transparent',
                color:filter===f?(TYPE_CFG[f]?.color||'#ff5e5f'):'#94a3b8',
                cursor:'pointer',fontFamily:'inherit',
              }}>{f==='all'?'All':TYPE_CFG[f].label}</button>
            ))}
          </div>
        </div>

        <div style={s.list}>
          {Object.entries(groups).map(([month, days])=>(
            <div key={month}>
              <button onClick={()=>setCollapsed(c=>({...c,[month]:!c[month]}))}
                style={s.monthHeader}>
                <span>{month}</span>
                <span style={{fontSize:10,color:'#94a3b8'}}>{collapsed[month]?'▸':'▾'} {days.length} days</span>
              </button>
              {!collapsed[month] && days.map(d=>{
                const p   = progress[d.date]||{};
                const c   = TYPE_CFG[d.type];
                const isT = d.date===today;
                const isSel= d.date===selDate;
                const steps= d.type==='class' ? STEPS.filter(st=>p[`step${st.num}`]).length : null;
                return (
                  <button key={d.date} id={isT?'today-item':undefined}
                    onClick={()=>setSelDate(d.date)}
                    style={{...s.listItem,
                      ...(isSel?{background:'#fff1f1',borderColor:'#ffc9c9'}:{}),
                      borderLeft:`3px solid ${isT?c.color:'transparent'}`,
                    }}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:2}}>
                        <span style={{fontSize:10,fontWeight:700,color:c.color}}>{d.day}</span>
                        <span style={{fontSize:9,color:'#94a3b8',fontFamily:'monospace'}}>{d.date.slice(5)}</span>
                        {isT&&<span style={{fontSize:9,fontWeight:800,color:c.color,background:c.bg,padding:'0 4px',borderRadius:3}}>TODAY</span>}
                      </div>
                      <p style={{fontSize:12,fontWeight:600,color:isSel?'#ff5e5f':'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.topic}</p>
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
                      {steps!==null&&<span style={{fontSize:10,color:steps===5?'#059669':'#94a3b8',fontWeight:600}}>{steps}/5</span>}
                      <span style={{fontSize:14,color:p.task_done?'#059669':d.date<today?'#fca5a5':'#e2e8f0'}}>{p.task_done?'✓':'○'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* DETAIL PANEL */}
      {entry && (
        <div style={s.detail} className="fade-in" key={selDate}>
          {/* Header */}
          <div style={s.dHead}>
            <div>
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8,flexWrap:'wrap'}}>
                <span style={{fontSize:11,color:'#94a3b8',fontFamily:'monospace'}}>{entry.date} · {entry.day}</span>
                <span className="badge" style={{background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`}}>{cfg.label}</span>
                {prog.is_backlog&&!prog.task_done&&(
                  <span className="badge" style={{background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa'}}>📌 Backlog</span>
                )}
              </div>
              <h2 style={{fontSize:20,fontWeight:800,color:'#0f172a'}}>{entry.topic}</h2>
            </div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
              <button onClick={()=>toggleDone(!prog.task_done)} style={{
                padding:'9px 18px',borderRadius:8,border:'2px solid',
                fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.15s',
                background:prog.task_done?'#ecfdf5':'#f8fafc',
                borderColor:prog.task_done?'#059669':'#e2e8f0',
                color:prog.task_done?'#065f46':'#64748b',
              }}>{prog.task_done?'✓ Done':'○ Mark Done'}</button>
              {!prog.task_done&&entry.date<today&&(
                <button className="btn btn-ghost btn-sm" style={{color:'#c2410c',borderColor:'#fed7aa'}}
                  onClick={markBacklog}>📌 Backlog</button>
              )}
            </div>
          </div>

          {/* CLASS: 5 steps */}
          {entry.type==='class'&&(
            <div className="card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
                <p style={{fontSize:14,fontWeight:700}}>5-Step Completion</p>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <span style={{fontSize:13,fontWeight:700,color:stepsDone===5?'#059669':'#ff5e5f'}}>{stepsDone}/5</span>
                  <div className="progress-track" style={{width:80}}>
                    <div className="progress-fill" style={{width:`${(stepsDone/5)*100}%`,background:stepsDone===5?'#059669':'#ff5e5f'}}/>
                  </div>
                </div>
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {STEPS.map(step=>{
                  const done=prog[`step${step.num}`]||false;
                  const isQuiz = step.num===5;
                  return (
                    <div key={step.num}>
                      <button onClick={()=>toggleStep(step.num)}
                        className={`step-pill ${done?'done':''}`}>
                        <span style={{width:22,height:22,borderRadius:6,flexShrink:0,
                          background:done?'#059669':'#f1f5f9',color:done?'#fff':'#94a3b8',
                          display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700}}>
                          {done?'✓':step.num}
                        </span>
                        <span style={{fontSize:14}}>{step.icon}</span>
                        <span>{step.label}</span>
                        {done&&<span style={{marginLeft:'auto',fontSize:11,color:'#059669',fontWeight:600}}>Done ✓</span>}
                      </button>

                      {/* Quiz marks — max marks vary per quiz, so capture both */}
                      {isQuiz && done && (
                        <div style={{display:'flex',gap:10,alignItems:'flex-end',
                          padding:'10px 12px',marginTop:4,marginLeft:30,
                          background:'#f8fafc',border:'1px solid #f1f5f9',borderRadius:8}}>
                          <div>
                            <label className="label">Marks Scored</label>
                            <input className="input" type="number" style={{width:100}}
                              value={prog.quiz_marks_scored??''}
                              onChange={e=>upsertProgress(selDate,{quiz_marks_scored:e.target.value===''?null:Number(e.target.value)})}
                              placeholder="e.g. 7"/>
                          </div>
                          <span style={{paddingBottom:8,color:'#94a3b8',fontWeight:700}}>/</span>
                          <div>
                            <label className="label">Max Marks</label>
                            <input className="input" type="number" style={{width:100}}
                              value={prog.quiz_marks_max??''}
                              onChange={e=>upsertProgress(selDate,{quiz_marks_max:e.target.value===''?null:Number(e.target.value)})}
                              placeholder="e.g. 10"/>
                          </div>
                          {prog.quiz_marks_scored!=null && prog.quiz_marks_max>0 && (
                            <span style={{paddingBottom:8,fontSize:12,fontWeight:700,color:'#ff5e5f'}}>
                              {Math.round((prog.quiz_marks_scored/prog.quiz_marks_max)*100)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {stepsDone===5&&<div style={{marginTop:12,padding:'10px 14px',background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:8,color:'#065f46',fontWeight:600,fontSize:13}} className="pop-in">🎉 All 5 steps complete! Great work.</div>}
            </div>
          )}

          {/* MARATHON */}
          {entry.type==='marathon'&&(
            <div className="card">
              <p style={{fontSize:14,fontWeight:700,marginBottom:4}}>Marathon Attendance</p>
              <p style={{fontSize:13,color:'#64748b',marginBottom:16}}>Did you attend <strong>{entry.topic}</strong>?</p>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                <button className={`attend-btn ${prog.task_done?'yes':''}`}
                  onClick={()=>upsertProgress(selDate,{task_done:true,is_backlog:false}).then(()=>showToast('✅ Attended!'))}>
                  <span className="ab-icon">✅</span>
                  <span className="ab-label">Yes, Attended</span>
                  {prog.task_done&&<span className="ab-sub">Selected</span>}
                </button>
                <button className={`attend-btn ${!prog.task_done&&prog.is_backlog?'no':''}`}
                  onClick={()=>upsertProgress(selDate,{task_done:false,is_backlog:true}).then(()=>showToast('📌 Not attended'))}>
                  <span className="ab-icon">❌</span>
                  <span className="ab-label">Did Not Attend</span>
                  {!prog.task_done&&prog.is_backlog&&<span className="ab-sub">In Backlog</span>}
                </button>
              </div>
            </div>
          )}

          {/* MOCK / SECTIONAL / AREA_TEST */}
          {['mock','sectional','area_test'].includes(entry.type)&&(
            <div className="card">
              <p style={{fontSize:14,fontWeight:700,marginBottom:4}}>{cfg.label} Completion</p>
              <p style={{fontSize:13,color:'#64748b',marginBottom:16}}>Have you completed <strong>{entry.topic}</strong>?</p>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                <button className={`attend-btn ${prog.task_done?'yes':''}`}
                  onClick={()=>upsertProgress(selDate,{task_done:true,is_backlog:false}).then(()=>showToast('✅ Done!'))}>
                  <span className="ab-icon">✅</span><span className="ab-label">Done</span>
                  {prog.task_done&&<span className="ab-sub">Selected</span>}
                </button>
                <button className={`attend-btn ${!prog.task_done&&prog.is_backlog?'no':''}`}
                  onClick={()=>upsertProgress(selDate,{task_done:false,is_backlog:true}).then(()=>showToast('📌 Backlog'))}>
                  <span className="ab-icon">📌</span><span className="ab-label">Not Done</span>
                  {!prog.task_done&&prog.is_backlog&&<span className="ab-sub">In Backlog</span>}
                </button>
              </div>
            </div>
          )}

          {/* Study Timer */}
          <div className="card">
            <p style={{fontSize:14,fontWeight:700,marginBottom:12}}>⏱️ Study Timer</p>
            <StudyTimer date={selDate} existingSeconds={prog.study_seconds||0}
              onUpdate={secs=>upsertProgress(selDate,{study_seconds:secs})}/>
          </div>

          {/* Notes */}
          <div className="card">
            <p style={{fontSize:14,fontWeight:700,marginBottom:10}}>📝 Notes</p>
            <textarea className="input" value={notes} onChange={e=>setNotes(e.target.value)}
              placeholder="Doubts, takeaways, observations…" style={{minHeight:90}}/>
            <button className="btn btn-ghost btn-sm" onClick={saveNotes}
              disabled={saving} style={{marginTop:8}}>
              {saving?'…':'💾 Save Notes'}
            </button>
          </div>
        </div>
      )}

      {toast&&<div className="toast success">{toast}</div>}
    </div>
  );
}

const s={
  layout:{display:'flex',height:'100vh',overflow:'hidden'},
  listWrap:{width:272,flexShrink:0,borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',background:'#fff'},
  listTop:{padding:'14px 12px 10px',borderBottom:'1px solid #f1f5f9',display:'flex',flexDirection:'column',gap:8},
  list:{flex:1,overflowY:'auto',padding:'4px 6px'},
  monthHeader:{width:'100%',display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 8px 4px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:800,color:'#94a3b8',letterSpacing:'0.08em',textTransform:'uppercase'},
  listItem:{width:'100%',display:'flex',alignItems:'center',padding:'8px 9px',borderRadius:7,background:'none',border:'1px solid transparent',cursor:'pointer',textAlign:'left',fontFamily:'inherit',marginBottom:1,transition:'all 0.1s',borderLeft:'3px solid transparent'},
  detail:{flex:1,overflowY:'auto',padding:'24px 28px',display:'flex',flexDirection:'column',gap:14},
  dHead:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12},
};
