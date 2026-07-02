import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProgress } from '../hooks/useProgress';
import { SCHEDULE, TYPE_CFG, EXAM_DATE } from '../lib/schedule';

export default function Dashboard({ setActive }) {
  const { user, profile, refreshProfile } = useAuth();
  const { progress, scores, loading, backlogs, elapsed, daysCompleted,
          avgPercentile, streak, weakSection, upsertProgress } = useProgress();
  const [showAllBacklogs, setShowAllBacklogs] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetVal, setTargetVal] = useState('');
  const [toast, setToast] = useState('');
  const today = new Date().toISOString().split('T')[0];
  function showToast(m) { setToast(m); setTimeout(()=>setToast(''),2500); }

  async function saveTarget() {
    const val = Number(targetVal);
    if(!val || val<=0 || val>100) { setEditingTarget(false); return; }
    await supabase.from('profiles').update({ target_percentile: val }).eq('id', user.id);
    await refreshProfile();
    setEditingTarget(false);
    showToast('🎯 Target updated');
  }

  const daysToExam = Math.ceil((new Date(EXAM_DATE) - new Date(today)) / (1000*60*60*24));

  async function clearBacklog(date) {
    await upsertProgress(date, { task_done:true, backlog_cleared:true });
    showToast('Marked done!');
  }

  if (loading) return <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>;

  const todayEntry = SCHEDULE.find(d=>d.date===today);
  const todayProg  = progress[today]||{};
  const todayCfg   = todayEntry ? TYPE_CFG[todayEntry.type] : null;
  const studyHrs   = (Object.values(progress).reduce((a,p)=>a+(p.study_seconds||0),0)/3600).toFixed(1);
  const compRate   = elapsed ? Math.round((daysCompleted/elapsed)*100) : 0;
  const upcoming   = SCHEDULE.filter(d=>d.date>today).slice(0,4);
  const recentScores = [...scores].reverse().slice(0,5);

  return (
    <div style={s.page} className="fade-in">
      {/* Greeting */}
      <div style={s.greet}>
        <div>
          <h1 style={s.title}>Good {greet()}, {(profile?.name||'').split(' ')[0]||'there'} 👋</h1>
          <p style={s.sub}>{new Date().toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
          {daysToExam>0 && (
            <div style={s.examBadge}>🗓️ {daysToExam} days to CAT</div>
          )}
          {streak>0 && <div style={s.streakBadge}>🔥 {streak}-day streak</div>}
          {editingTarget ? (
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <input className="input" type="number" autoFocus value={targetVal}
                onChange={e=>setTargetVal(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&saveTarget()}
                style={{width:70,padding:'6px 8px',fontSize:13}} placeholder="99"/>
              <button className="btn btn-primary btn-sm" onClick={saveTarget}>Save</button>
            </div>
          ) : (
            <button style={s.targetBadge}
              onClick={()=>{setTargetVal(profile?.target_percentile??'99');setEditingTarget(true);}}>
              🎯 Target: {profile?.target_percentile??'—'}%ile
            </button>
          )}
        </div>
      </div>

      {/* Backlog banner */}
      {backlogs.length>0 && (
        <div className="backlog-banner">
          <p>⚠️ <strong>{backlogs.length} backlog{backlogs.length>1?'s':''} pending</strong> — complete these to stay on track.</p>
          <button className="btn btn-amber btn-sm" onClick={()=>setShowAllBacklogs(b=>!b)}>
            {showAllBacklogs?'Hide':'View all'}
          </button>
        </div>
      )}
      {showAllBacklogs && (
        <div style={s.backlogList} className="slide-down">
          {backlogs.map(b=>{
            const e=SCHEDULE.find(d=>d.date===b.date); if(!e) return null;
            const c=TYPE_CFG[e.type];
            return (
              <div key={b.date} style={s.backlogItem}>
                <span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{c.label}</span>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:13,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{e.topic}</p>
                  <p style={{fontSize:11,color:'#94a3b8'}}>{e.date}</p>
                </div>
                <button className="btn btn-success btn-sm" onClick={()=>clearBacklog(b.date)}>Mark Done</button>
              </div>
            );
          })}
        </div>
      )}

      {/* TODAY */}
      <div style={s.zone}><p style={s.zlabel}>TODAY</p>
        {todayEntry?(
          <div style={{...s.todayCard,borderLeftColor:todayCfg?.color}}>
            <div>
              <span className="badge" style={{background:todayCfg?.bg,color:todayCfg?.color,border:`1px solid ${todayCfg?.border}`,marginBottom:8,display:'inline-flex'}}>{todayCfg?.label}</span>
              <h2 style={s.todayTopic}>{todayEntry.topic}</h2>
            </div>
            {todayProg.task_done
              ? <div style={s.donePill}>✓ Completed</div>
              : <button className="btn btn-primary" onClick={()=>setActive('planner')}>Open Planner →</button>
            }
          </div>
        ):<div className="card"><p style={{color:'#64748b'}}>🎉 Schedule complete!</p></div>}
      </div>

      {/* STATS */}
      <div style={s.zone}><p style={s.zlabel}>STATS</p>
        <div className="grid-4">
          {[
            {icon:'✅',label:'Days Done',   val:daysCompleted, of:elapsed,  color:'#ff5e5f'},
            {icon:'📈',label:'Avg %ile',    val:`${avgPercentile}%ile`,      color:'#059669',
             sub: profile?.target_percentile ? `Target: ${profile.target_percentile}%ile (${avgPercentile>=profile.target_percentile?'✓ met':`${(profile.target_percentile-avgPercentile).toFixed(0)} to go`})` : null},
            {icon:'⏱️',label:'Study Hours', val:`${studyHrs}h`,              color:'#0284c7'},
            {icon:'⚠️',label:'Backlogs',    val:backlogs.length,             color:'#e11d48'},
          ].map(c=>(
            <div key={c.label} className="metric">
              <p className="metric-label">{c.icon} {c.label}</p>
              <p className="metric-value" style={{color:c.color}}>{c.val}</p>
              {c.sub && <p className="metric-sub">{c.sub}</p>}
              {c.of!=null&&(<>
                <div className="progress-track" style={{marginTop:6}}>
                  <div className="progress-fill" style={{width:`${Math.round((c.val/c.of)*100)}%`,background:c.color}}/>
                </div>
                <p className="metric-sub">{c.val} of {c.of}</p>
              </>)}
            </div>
          ))}
        </div>
      </div>

      {/* Weak section */}
      {weakSection&&(
        <div style={s.weakAlert}>
          <span style={{fontSize:20}}>🎯</span>
          <div style={{flex:1}}>
            <p style={{fontWeight:700,fontSize:13,color:'#92400e'}}>Weak Area: <strong>{weakSection}</strong></p>
            <p style={{fontSize:12,color:'#b45309',marginTop:2}}>Lowest avg across mocks — focus more here.</p>
          </div>
          <button className="btn btn-amber btn-sm" onClick={()=>setActive('analytics')}>View →</button>
        </div>
      )}

      {/* TARGET banner */}
      <div style={s.zone}><p style={s.zlabel}>PROGRESS & UPCOMING</p>
        <div className="grid-2">
          <div className="card">
            <div className="sec-head">
              <p className="sec-title">Completion Heatmap</p>
              <span style={{fontSize:12,color:'#ff5e5f',fontWeight:700}}>{compRate}%</span>
            </div>
            <div style={s.heatmap}>
              {SCHEDULE.map(d=>{
                const done=progress[d.date]?.task_done;
                const isFut=d.date>today; const isT=d.date===today;
                return <div key={d.date} title={d.topic}
                  style={{...s.hc,
                    background:isFut?'#f1f5f9':done?'#ff5e5f':isT?'#ffc9c9':'#fecaca',
                    border:isT?'2px solid #ff5e5f':'1px solid transparent'
                  }}/>;
              })}
            </div>
            <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
              {[['#ff5e5f','Done'],['#fecaca','Missed'],['#ffc9c9','Today'],['#f1f5f9','Upcoming']].map(([c,l])=>(
                <span key={l} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#94a3b8'}}>
                  <span style={{width:9,height:9,borderRadius:2,background:c,display:'inline-block'}}/>{l}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="sec-head">
              <p className="sec-title">Coming Up</p>
              <button className="btn btn-ghost btn-sm" onClick={()=>setActive('planner')}>Full →</button>
            </div>
            {upcoming.map(d=>{
              const c=TYPE_CFG[d.type];
              return (
                <div key={d.date} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'1px solid #f8fafc'}}>
                  <span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`,flexShrink:0}}>{d.day}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <p style={{fontSize:13,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.topic}</p>
                    <p style={{fontSize:11,color:'#94a3b8'}}>{d.date}</p>
                  </div>
                  <span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`,flexShrink:0,fontSize:10}}>{c.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent scores */}
      {recentScores.length>0&&(
        <div style={s.zone}><p style={s.zlabel}>RECENT SCORES</p>
          <div className="card" style={{padding:0,overflow:'hidden'}}>
            <table className="tbl">
              <thead><tr>{['Test','Type','Score','%ile','Accuracy'].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {recentScores.map(sc=>{
                  const c=TYPE_CFG[sc.test_type]||{};
                  return (
                    <tr key={sc.id}>
                      <td style={{fontWeight:600,color:'#0f172a'}}>{sc.test_name}</td>
                      <td><span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{c.label}</span></td>
                      <td style={{fontFamily:'monospace',fontWeight:700,color:'#ff5e5f'}}>{sc.total_score??'—'}</td>
                      <td style={{color:'#059669',fontWeight:600}}>{sc.percentile!=null?`${sc.percentile}%ile`:'—'}</td>
                      <td style={{color:'#d97706',fontWeight:600}}>{sc.overall_accuracy!=null?`${sc.overall_accuracy}%`:'—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{padding:'10px 16px',borderTop:'1px solid #f1f5f9'}}>
              <button className="btn btn-ghost btn-sm" onClick={()=>setActive('scores')}>View all →</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className="toast success">{toast}</div>}
    </div>
  );
}

function greet(){const h=new Date().getHours();return h<12?'morning':h<17?'afternoon':'evening';}

const s={
  page:{padding:'24px 28px',maxWidth:1060,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  greet:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
  streakBadge:{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:99,fontSize:13,fontWeight:700,color:'#92400e'},
  examBadge:{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#fff1f1',border:'1px solid #ffc9c9',borderRadius:99,fontSize:13,fontWeight:700,color:'#ff5e5f'},
  targetBadge:{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:99,fontSize:13,fontWeight:700,color:'#059669',cursor:'pointer',fontFamily:'inherit'},
  backlogList:{display:'flex',flexDirection:'column',gap:8},
  backlogItem:{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#fff',border:'1px solid #fed7aa',borderRadius:10},
  zone:{display:'flex',flexDirection:'column',gap:10},
  zlabel:{fontSize:10,fontWeight:800,color:'#94a3b8',letterSpacing:'0.1em'},
  todayCard:{background:'#fff',border:'1px solid #e2e8f0',borderLeft:'4px solid',borderRadius:12,padding:'18px 22px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:14,boxShadow:'0 2px 8px rgba(79,70,229,0.06)'},
  todayTopic:{fontSize:19,fontWeight:800,color:'#0f172a'},
  donePill:{display:'inline-flex',alignItems:'center',gap:6,padding:'7px 14px',background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:99,color:'#065f46',fontWeight:700,fontSize:13},
  weakAlert:{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10,flexWrap:'wrap'},
  heatmap:{display:'flex',flexWrap:'wrap',gap:4,margin:'4px 0 10px'},
  hc:{width:15,height:15,borderRadius:3,cursor:'default'},
};
