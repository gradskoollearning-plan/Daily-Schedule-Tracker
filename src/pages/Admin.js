import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { SCHEDULE, TYPE_CFG } from '../lib/schedule';

export default function Admin() {
  const { profile } = useAuth();
  const [students, setStudents]   = useState([]);
  const [allProg, setAllProg]     = useState([]);
  const [allScores, setAllScores] = useState([]);
  const [allMistakes, setAllMistakes] = useState([]);
  const [selected, setSelected]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('overview');
  const today = new Date().toISOString().split('T')[0];

  useEffect(()=>{
    if(!profile?.is_admin) return;
    Promise.all([
      supabase.from('profiles').select('*').eq('is_admin',false),
      supabase.from('daily_progress').select('*'),
      supabase.from('test_scores').select('*').order('date',{ascending:false}),
      supabase.from('mistake_log').select('*').order('date',{ascending:false}),
    ]).then(([{data:st},{data:pr},{data:sc},{data:ml}])=>{
      setStudents(st||[]);
      setAllProg(pr||[]);
      setAllScores(sc||[]);
      setAllMistakes(ml||[]);
      setLoading(false);
    });
  },[profile]);

  if(!profile?.is_admin) return (
    <div style={{padding:64,textAlign:'center'}}>
      <p style={{fontSize:36,marginBottom:12}}>🛡️</p>
      <h2 style={{fontWeight:800,marginBottom:8}}>Admin only</h2>
      <p style={{color:'#64748b'}}>You need admin access to view this page.</p>
    </div>
  );
  if(loading) return <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>;

  // Per-student stats
  function getStats(uid) {
    const prog   = allProg.filter(p=>p.user_id===uid);
    const scores = allScores.filter(s=>s.user_id===uid);
    const mocks  = scores.filter(s=>s.test_type==='mock');
    const doneCount = prog.filter(p=>p.task_done).length;
    const elapsed   = SCHEDULE.filter(d=>d.date<=today).length;
    const backlogs  = SCHEDULE.filter(d=>{
      if(d.date>=today) return false;
      const p=prog.find(x=>x.date===d.date);
      return !p?.task_done&&!p?.backlog_cleared;
    }).length;
    const avgPct = mocks.length ? Math.round(mocks.reduce((a,s)=>a+(s.percentile||0),0)/mocks.length) : 0;
    const studyHrs = (prog.reduce((a,p)=>a+(p.study_seconds||0),0)/3600).toFixed(1);
    const lastActive = prog.sort((a,b)=>b.updated_at?.localeCompare(a.updated_at))[0]?.date||'—';
    return { doneCount, elapsed, backlogs, avgPct, studyHrs, mocks: mocks.length, lastActive };
  }

  // Accuracy risk: percentile trending down across recent mocks, or a pile-up
  // of unresolved mistakes (same errors recurring without being fixed).
  function getAccuracyRisk(uid) {
    const mocks = allScores
      .filter(s=>s.user_id===uid && s.test_type==='mock')
      .sort((a,b)=>a.date.localeCompare(b.date));
    const unresolvedMistakes = allMistakes.filter(m=>m.user_id===uid && !m.resolved).length;

    let trendDown = false, dropAmount = 0;
    if(mocks.length>=3){
      const last = mocks[mocks.length-1].percentile||0;
      const priorSlice = mocks.slice(-4,-1);
      const prevAvg = priorSlice.reduce((a,sc)=>a+(sc.percentile||0),0)/priorSlice.length;
      if(last < prevAvg-5){ trendDown=true; dropAmount = Math.round(prevAvg-last); }
    }
    const highMistakes = unresolvedMistakes>=5;
    return { flagged: trendDown||highMistakes, trendDown, dropAmount, unresolvedMistakes, highMistakes };
  }

  const selStudent  = students.find(s=>s.id===selected);
  const selStats    = selected ? getStats(selected) : null;
  const selProg     = selected ? allProg.filter(p=>p.user_id===selected) : [];
  const selScores   = selected ? allScores.filter(s=>s.user_id===selected) : [];
  const selMistakes = selected ? allMistakes.filter(m=>m.user_id===selected) : [];

  // Risk students (backlogs >= 3)
  const atRisk = students.filter(s=>getStats(s.id).backlogs>=3);
  // Risk students on accuracy (declining percentile or recurring unresolved mistakes)
  const atRiskAccuracy = students.filter(s=>getAccuracyRisk(s.id).flagged);

  return (
    <div style={s.page} className="fade-in">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={s.title}>🛡️ Admin Dashboard</h1>
          <p style={s.sub}>{students.length} students enrolled</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={s.sumCard}><span style={{fontSize:20}}>👥</span><div><p style={{fontSize:18,fontWeight:800}}>{students.length}</p><p style={{fontSize:11,color:'#94a3b8'}}>Students</p></div></div>
          <div style={s.sumCard}><span style={{fontSize:20}}>⚠️</span><div><p style={{fontSize:18,fontWeight:800,color:'#e11d48'}}>{atRisk.length}</p><p style={{fontSize:11,color:'#94a3b8'}}>Backlog Risk</p></div></div>
          <div style={s.sumCard}><span style={{fontSize:20}}>📉</span><div><p style={{fontSize:18,fontWeight:800,color:'#c2410c'}}>{atRiskAccuracy.length}</p><p style={{fontSize:11,color:'#94a3b8'}}>Accuracy Risk</p></div></div>
        </div>
      </div>

      {/* At-risk banner: backlogs */}
      {atRisk.length>0&&(
        <div style={{padding:'12px 16px',background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:10}}>
          <p style={{fontSize:13,fontWeight:700,color:'#9f1239',marginBottom:8}}>⚠️ Students with 3+ backlogs</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {atRisk.map(s=>(
              <button key={s.id} onClick={()=>setSelected(s.id)}
                style={{padding:'4px 12px',background:'#fff',border:'1px solid #fecdd3',borderRadius:99,fontSize:12,fontWeight:600,color:'#9f1239',cursor:'pointer',fontFamily:'inherit'}}>
                {s.name} ({getStats(s.id).backlogs} backlogs)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* At-risk banner: accuracy */}
      {atRiskAccuracy.length>0&&(
        <div style={{padding:'12px 16px',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10}}>
          <p style={{fontSize:13,fontWeight:700,color:'#9a3412',marginBottom:8}}>📉 Students at risk on accuracy</p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {atRiskAccuracy.map(st=>{
              const r = getAccuracyRisk(st.id);
              const reasons = [
                r.trendDown && `%ile dropped ~${r.dropAmount} pts`,
                r.highMistakes && `${r.unresolvedMistakes} unresolved mistakes`,
              ].filter(Boolean).join(' · ');
              return (
                <button key={st.id} onClick={()=>{setSelected(st.id);setTab('mistakes');}}
                  style={{padding:'4px 12px',background:'#fff',border:'1px solid #fed7aa',borderRadius:99,fontSize:12,fontWeight:600,color:'#9a3412',cursor:'pointer',fontFamily:'inherit'}}>
                  {st.name} ({reasons})
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{display:'flex',gap:16}}>
        {/* Student list */}
        <div style={s.studentList}>
          <p style={{fontSize:12,fontWeight:700,color:'#94a3b8',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8,padding:'0 4px'}}>All Students</p>
          {students.map(st=>{
            const st2=getStats(st.id);
            const compRate=st2.elapsed?Math.round((st2.doneCount/st2.elapsed)*100):0;
            return (
              <button key={st.id} onClick={()=>setSelected(st.id)}
                style={{...s.stuBtn,...(selected===st.id?{background:'#fff1f1',borderColor:'#ffc9c9'}:{})}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#ff5e5f,#ff8a65)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>
                  {(st.name||'?')[0].toUpperCase()}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontSize:12,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{st.name}</p>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginTop:2}}>
                    <div style={{flex:1,height:3,background:'#f1f5f9',borderRadius:99,overflow:'hidden'}}>
                      <div style={{width:`${compRate}%`,height:'100%',background:'#ff5e5f',borderRadius:99}}/>
                    </div>
                    <span style={{fontSize:10,color:'#94a3b8',flexShrink:0}}>{compRate}%</span>
                  </div>
                </div>
                {st2.backlogs>=3&&<span style={{fontSize:14}} title={`${st2.backlogs} backlogs`}>⚠️</span>}
                {getAccuracyRisk(st.id).flagged&&<span style={{fontSize:14}} title="Accuracy risk">📉</span>}
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <div style={{flex:1,minWidth:0}}>
          {!selected ? (
            <div className="empty-state">
              <span className="es-icon">👈</span>
              <h3>Select a student</h3>
              <p>Click any student to view their detailed progress</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Student header */}
              <div style={s.stuHead}>
                <div style={{display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#ff5e5f,#ff8a65)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700}}>
                    {(selStudent?.name||'?')[0].toUpperCase()}
                  </div>
                  <div>
                    <p style={{fontSize:16,fontWeight:800,color:'#0f172a'}}>{selStudent?.name}</p>
                    <p style={{fontSize:12,color:'#94a3b8'}}>{selStudent?.email}</p>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={()=>setSelected(null)}>✕ Close</button>
              </div>

              {/* Stats grid */}
              <div className="grid-4" style={{gap:10}}>
                {[
                  {label:'Days Done',   val:`${selStats.doneCount}/${selStats.elapsed}`, color:'#ff5e5f'},
                  {label:'Backlogs',    val:selStats.backlogs,      color:selStats.backlogs>2?'#e11d48':'#059669'},
                  {label:'Avg %ile',    val:`${selStats.avgPct}%ile`,color:'#059669'},
                  {label:'Study Hrs',   val:`${selStats.studyHrs}h`,color:'#0284c7'},
                ].map(c=>(
                  <div key={c.label} className="metric card-sm">
                    <p className="metric-label">{c.label}</p>
                    <p style={{fontSize:20,fontWeight:800,color:c.color,fontFamily:'monospace'}}>{c.val}</p>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="tabs" style={{alignSelf:'flex-start'}}>
                {['overview','progress','scores','mistakes'].map(t=>(
                  <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
                    {t.charAt(0).toUpperCase()+t.slice(1)}
                  </button>
                ))}
              </div>

              {/* Overview: mini heatmap */}
              {tab==='overview'&&(
                <div className="card">
                  <p style={{fontSize:13,fontWeight:700,marginBottom:12}}>Completion Heatmap</p>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {SCHEDULE.map(d=>{
                      const p=selProg.find(x=>x.date===d.date);
                      const isFut=d.date>today;
                      return <div key={d.date} title={`${d.date}: ${d.topic}`}
                        style={{width:14,height:14,borderRadius:3,background:isFut?'#f1f5f9':p?.task_done?'#ff5e5f':'#fecaca'}}/>;
                    })}
                  </div>
                </div>
              )}

              {/* Progress list */}
              {tab==='progress'&&(
                <div className="card" style={{padding:0,overflow:'hidden'}}>
                  <table className="tbl">
                    <thead><tr><th>Date</th><th>Topic</th><th>Type</th><th>Steps</th><th>Quiz</th><th>Done</th><th>Backlog</th></tr></thead>
                    <tbody>
                      {SCHEDULE.filter(d=>d.date<=today).slice(-20).reverse().map(d=>{
                        const p=selProg.find(x=>x.date===d.date)||{};
                        const c=TYPE_CFG[d.type];
                        const steps=d.type==='class'?[1,2,3,4,5].filter(n=>p[`step${n}`]).length:'-';
                        const hasQuiz = d.type==='class' && p.quiz_marks_max>0;
                        return (
                          <tr key={d.date}>
                            <td style={{fontFamily:'monospace',fontSize:12}}>{d.date}</td>
                            <td style={{fontWeight:600,color:'#0f172a',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.topic}</td>
                            <td><span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{c.label}</span></td>
                            <td>{steps==='-'?'—':`${steps}/5`}</td>
                            <td style={{fontFamily:'monospace',fontWeight:600,color:hasQuiz?'#ff5e5f':'#94a3b8'}}>
                              {hasQuiz?`${p.quiz_marks_scored??0}/${p.quiz_marks_max}`:'—'}
                            </td>
                            <td style={{color:p.task_done?'#059669':'#e11d48',fontWeight:700}}>{p.task_done?'✓':'✗'}</td>
                            <td style={{color:p.is_backlog&&!p.task_done?'#d97706':'#94a3b8'}}>{p.is_backlog&&!p.task_done?'📌':'—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Scores */}
              {tab==='scores'&&(
                selScores.length===0
                  ? <div className="empty-state"><span className="es-icon">📊</span><h3>No scores yet</h3></div>
                  : <div className="card" style={{padding:0,overflow:'hidden'}}>
                      <table className="tbl">
                        <thead><tr><th>Date</th><th>Test</th><th>Type</th><th>Score</th><th>%ile</th><th>Accuracy</th></tr></thead>
                        <tbody>
                          {selScores.slice(0,15).map(sc=>{
                            const c=TYPE_CFG[sc.test_type]||{};
                            return (
                              <tr key={sc.id}>
                                <td style={{fontFamily:'monospace',fontSize:12}}>{sc.date}</td>
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
                    </div>
              )}

              {/* Mistakes */}
              {tab==='mistakes'&&(
                selMistakes.length===0
                  ? <div className="empty-state"><span className="es-icon">🧩</span><h3>No mistakes logged</h3></div>
                  : <div className="card" style={{padding:0,overflow:'hidden'}}>
                      <table className="tbl">
                        <thead><tr><th>Status</th><th>Date</th><th>Section</th><th>Topic</th><th>Test</th><th>Type</th><th>Notes</th></tr></thead>
                        <tbody>
                          {selMistakes.slice(0,25).map(m=>(
                            <tr key={m.id} style={m.resolved?{opacity:0.55}:undefined}>
                              <td>
                                <span className="badge" style={m.resolved
                                  ?{background:'#ecfdf5',color:'#059669',border:'1px solid #a7f3d0'}
                                  :{background:'#fff1f2',color:'#e11d48',border:'1px solid #fecdd3'}}>
                                  {m.resolved?'✓ Resolved':'● Open'}
                                </span>
                              </td>
                              <td style={{fontFamily:'monospace',fontSize:12}}>{m.date}</td>
                              <td><span className="badge" style={{background:'#f8fafc',color:'#0f172a',border:'1px solid #e2e8f0'}}>{m.section}</span></td>
                              <td style={{fontWeight:600,color:'#0f172a'}}>{m.topic||'—'}</td>
                              <td style={{color:'#64748b'}}>{m.test_name||'—'}</td>
                              <td><span className="badge" style={{background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa'}}>{m.mistake_type||'—'}</span></td>
                              <td style={{color:'#64748b',maxWidth:220,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.description||'—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const s={
  page:{padding:'24px 28px',maxWidth:1200,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
  sumCard:{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:10,boxShadow:'0 1px 3px rgba(0,0,0,0.06)'},
  studentList:{width:220,flexShrink:0,display:'flex',flexDirection:'column',gap:2},
  stuBtn:{width:'100%',display:'flex',alignItems:'center',gap:9,padding:'8px 10px',borderRadius:8,background:'none',border:'1px solid transparent',cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.1s'},
  stuHead:{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',background:'#fff',border:'1px solid #e2e8f0',borderRadius:10},
};
