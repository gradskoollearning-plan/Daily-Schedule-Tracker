import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProgress } from '../hooks/useProgress';
import { TYPE_CFG } from '../lib/schedule';

export default function Scores({ goTo }) {
  const { scores, reload } = useProgress();
  const [tab, setTab]       = useState('all');
  const [toast, setToast]   = useState('');
  const [justSaved, setJustSaved] = useState(null); // { id, test_name } — offers a mistake-log shortcut

  function showToast(m){ setToast(m); setTimeout(()=>setToast(''),2200); }

  // Pick up the "score was just saved" handoff left by LogScore.js.
  useEffect(()=>{
    const raw = localStorage.getItem('gs_just_saved_score');
    if(!raw) return;
    localStorage.removeItem('gs_just_saved_score');
    try{
      setJustSaved(JSON.parse(raw));
      reload();
      showToast('✅ Score saved!');
    }catch{ /* ignore malformed payload */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  function openNew() {
    localStorage.removeItem('gs_edit_score');
    goTo('log-score');
  }

  function editScore(sc) {
    localStorage.setItem('gs_edit_score', JSON.stringify(sc));
    goTo('log-score');
  }

  function goLogMistake() {
    if(!justSaved) return;
    localStorage.setItem('gs_pending_mistake', JSON.stringify({
      test_score_id: justSaved.id, test_name: justSaved.test_name,
    }));
    setJustSaved(null);
    goTo('log-mistake');
  }

  async function del(id) {
    await supabase.from('test_scores').delete().eq('id',id);
    reload(); showToast('Deleted');
  }

  const filtered = tab==='all' ? [...scores].reverse() : [...scores].reverse().filter(s=>s.test_type===tab);

  const mocks = scores.filter(s=>s.test_type==='mock');
  const avgPct = mocks.length ? Math.round(mocks.reduce((a,s)=>a+(s.percentile||0),0)/mocks.length) : 0;
  const bestPct = mocks.length ? Math.max(...mocks.map(s=>s.percentile||0)) : 0;

  return (
    <div style={s.page} className="fade-in">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={s.title}>📊 Test Scores</h1>
          <p style={s.sub}>Log and track all your test results — scheduled or extra practice</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          + Log Score
        </button>
      </div>

      {justSaved && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap',
          padding:'12px 16px',background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:10}}>
          <p style={{fontSize:13,color:'#9a3412'}}>
            📝 Anything go wrong in <strong>{justSaved.test_name}</strong>? Log it while it's fresh.
          </p>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-amber btn-sm" onClick={goLogMistake}>🧩 Log a Mistake</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setJustSaved(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {mocks.length>0&&(
        <div className="grid-4" style={{gap:10}}>
          {[
            {label:'Mocks Done',   val:mocks.length,    color:'#ff5e5f'},
            {label:'Avg %ile',     val:`${avgPct}%ile`, color:'#059669'},
            {label:'Best %ile',    val:`${bestPct}%ile`,color:'#7c3aed'},
            {label:'Tests Total',  val:scores.length,   color:'#0284c7'},
          ].map(c=>(
            <div key={c.label} className="metric">
              <p className="metric-label">{c.label}</p>
              <p className="metric-value" style={{color:c.color,fontSize:22}}>{c.val}</p>
            </div>
          ))}
        </div>
      )}

      <div className="tabs" style={{alignSelf:'flex-start'}}>
        {['all','mock','sectional','area_test','quiz','marathon'].map(t=>(
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='all'?'All Tests':TYPE_CFG[t].label}
          </button>
        ))}
      </div>

      {filtered.length===0 ? (
        <div className="empty-state">
          <span className="es-icon">📊</span>
          <h3>No scores yet</h3>
          <p>Click "Log Score" to add your first test result</p>
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(15,23,42,0.05)'}}>
            <table className="tbl">
              <thead>
                <tr>
                  {['Date','Test','Type','VARC','DILR','QA','Total','%ile','Accuracy','Rank',''].map(h=>(
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(sc=>{
                  const c=TYPE_CFG[sc.test_type]||{};
                  return (
                    <tr key={sc.id}>
                      <td style={{fontFamily:'monospace',fontSize:11,color:'#94a3b8'}}>{sc.date}</td>
                      <td style={{fontWeight:600,color:'#0f172a',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sc.test_name}</td>
                      <td><span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{c.label}</span></td>
                      <td style={{fontFamily:'monospace',fontSize:13}}>{sc.varc_score??'—'}</td>
                      <td style={{fontFamily:'monospace',fontSize:13}}>{sc.dilr_score??'—'}</td>
                      <td style={{fontFamily:'monospace',fontSize:13}}>{sc.qa_score??'—'}</td>
                      <td style={{fontFamily:'monospace',fontWeight:700,color:'#ff5e5f',fontSize:13}}>{sc.total_score??'—'}</td>
                      <td style={{color:'#059669',fontWeight:600}}>{sc.percentile!=null?`${sc.percentile}%ile`:'—'}</td>
                      <td style={{color:'#d97706',fontWeight:600}}>{sc.overall_accuracy!=null?`${sc.overall_accuracy}%`:'—'}</td>
                      <td style={{color:'#94a3b8'}}>{sc.rank??'—'}</td>
                      <td>
                        <div style={{display:'flex',gap:5}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>editScore(sc)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>del(sc.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {toast&&<div className="toast success">{toast}</div>}
    </div>
  );
}

const s={
  page:{padding:'24px 28px',maxWidth:1200,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
};