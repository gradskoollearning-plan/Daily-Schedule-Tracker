import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const SECTIONS = [
  { key:'VARC',    color:'#ff5e5f', bg:'#fff1f1', border:'#ffc9c9' },
  { key:'DILR',    color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe' },
  { key:'QA',      color:'#0369a1', bg:'#f0f9ff', border:'#bae6fd' },
  { key:'General', color:'#64748b', bg:'#f8fafc', border:'#e2e8f0' },
];
const secCfg = k => SECTIONS.find(s=>s.key===k) || SECTIONS[3];

const today = () => new Date().toISOString().split('T')[0];

export default function Mistakes({ goTo }) {
  const { user } = useAuth();
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filterSec, setFilterSec] = useState('all');
  const [filterStatus, setFilterStatus] = useState('open'); // open | resolved | all
  const [toast, setToast]       = useState('');

  function showToast(m){ setToast(m); setTimeout(()=>setToast(''),2200); }

  const load = useCallback(async ()=>{
    if(!user) return;
    const { data: ml } = await supabase.from('mistake_log').select('*').eq('user_id',user.id).order('date',{ascending:false});
    setRows(ml||[]);
    setLoading(false);
  },[user]);

  useEffect(()=>{ load(); },[load]);

  function goNew(section){
    localStorage.removeItem('gs_edit_mistake');
    localStorage.removeItem('gs_pending_mistake');
    if(section) localStorage.setItem('gs_new_mistake_section', section);
    else localStorage.removeItem('gs_new_mistake_section');
    goTo('log-mistake');
  }

  function goEdit(r){
    localStorage.setItem('gs_edit_mistake', JSON.stringify(r));
    goTo('log-mistake');
  }

  async function toggleResolved(r){
    await supabase.from('mistake_log').update({resolved:!r.resolved}).eq('id',r.id);
    load(); showToast(!r.resolved?'✓ Marked resolved':'↺ Reopened');
  }

  async function del(id){
    await supabase.from('mistake_log').delete().eq('id',id);
    load(); showToast('Deleted');
  }

  function daysOpen(dateStr){
    return Math.floor((new Date(today()) - new Date(dateStr)) / (1000*60*60*24));
  }
  const staleOpen = rows.filter(r=>!r.resolved && daysOpen(r.date)>=7)
    .sort((a,b)=>daysOpen(b.date)-daysOpen(a.date));

  let filtered = filterSec==='all' ? rows : rows.filter(r=>r.section===filterSec);
  if(filterStatus==='open')     filtered = filtered.filter(r=>!r.resolved);
  if(filterStatus==='resolved') filtered = filtered.filter(r=>r.resolved);

  const counts = SECTIONS.reduce((acc,sec)=>{
    acc[sec.key] = rows.filter(r=>r.section===sec.key && !r.resolved).length;
    return acc;
  },{});

  function topType(section){
    const items = rows.filter(r=>r.section===section && r.mistake_type && !r.resolved);
    if(!items.length) return null;
    const tally = {};
    items.forEach(r=>{ tally[r.mistake_type]=(tally[r.mistake_type]||0)+1; });
    return Object.entries(tally).sort((a,b)=>b[1]-a[1])[0][0];
  }

  if(loading) return <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>;

  return (
    <div style={s.page} className="fade-in">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={s.title}>🧩 Mistake Log</h1>
          <p style={s.sub}>Track exactly where and why you're losing marks, section by section</p>
        </div>
        <button className="btn btn-primary" onClick={()=>goNew()}>+ Log Mistake</button>
      </div>

      {/* Revision nudge: mistakes open 7+ days without a fix */}
      {staleOpen.length>0 && (
        <div style={{padding:'12px 16px',background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:10}}>
          <p style={{fontSize:13,fontWeight:700,color:'#9f1239',marginBottom:8}}>
            ⏰ {staleOpen.length} mistake{staleOpen.length>1?'s':''} still open after a week — worth revising before it becomes a habit
          </p>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {staleOpen.slice(0,6).map(r=>(
              <button key={r.id} onClick={()=>goEdit(r)}
                style={{padding:'4px 12px',background:'#fff',border:'1px solid #fecdd3',borderRadius:99,fontSize:12,fontWeight:600,color:'#9f1239',cursor:'pointer',fontFamily:'inherit'}}>
                {r.section}{r.topic?` · ${r.topic}`:''} ({daysOpen(r.date)}d)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Per-section summary cards — counts are OPEN (unresolved) mistakes */}
      <div className="grid-4" style={{gap:10}}>
        {SECTIONS.map(sec=>(
          <div key={sec.key} className="metric card-sm" style={{border:`1px solid ${sec.border}`,cursor:'pointer'}}
            onClick={()=>goNew(sec.key)}>
            <p className="metric-label" style={{color:sec.color}}>{sec.key}</p>
            <p style={{fontSize:20,fontWeight:800,color:sec.color,fontFamily:'monospace'}}>{counts[sec.key]}</p>
            <p style={{fontSize:11,color:'#94a3b8',marginTop:2}}>
              {topType(sec.key) ? `Most common: ${topType(sec.key)}` : '+ tap to log'}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
        <div className="tabs" style={{alignSelf:'flex-start'}}>
          {['all',...SECTIONS.map(s=>s.key)].map(f=>(
            <button key={f} className={`tab-btn ${filterSec===f?'active':''}`} onClick={()=>setFilterSec(f)}>
              {f==='all'?'All Sections':f}
            </button>
          ))}
        </div>
        <div className="tabs" style={{alignSelf:'flex-start'}}>
          {[['open','Open'],['resolved','Resolved'],['all','All']].map(([k,l])=>(
            <button key={k} className={`tab-btn ${filterStatus===k?'active':''}`} onClick={()=>setFilterStatus(k)}>{l}</button>
          ))}
        </div>
      </div>

      {filtered.length===0 ? (
        <div className="empty-state">
          <span className="es-icon">🧩</span>
          <h3>{filterStatus==='resolved'?'Nothing resolved yet':'No mistakes logged yet'}</h3>
          <p>Log one after every quiz, sectional, or mock — patterns show up fast</p>
        </div>
      ) : (
        <div style={{overflowX:'auto'}}>
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 1px 4px rgba(15,23,42,0.05)'}}>
            <table className="tbl">
              <thead>
                <tr>{['Status','Days','Date','Section','Topic','Test','Type','Notes',''].map(h=><th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {filtered.map(r=>{
                  const c = secCfg(r.section);
                  const age = daysOpen(r.date);
                  return (
                    <tr key={r.id} style={r.resolved?{opacity:0.55}:undefined}>
                      <td>
                        <button onClick={()=>toggleResolved(r)}
                          title={r.resolved?'Mark as still recurring':'Mark resolved'}
                          style={{
                            padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,cursor:'pointer',
                            fontFamily:'inherit',border:`1px solid ${r.resolved?'#a7f3d0':'#fecdd3'}`,
                            background:r.resolved?'#ecfdf5':'#fff1f2',color:r.resolved?'#059669':'#e11d48',
                          }}>
                          {r.resolved?'✓ Resolved':'● Open'}
                        </button>
                      </td>
                      <td style={{fontSize:11,fontWeight:700,color:!r.resolved&&age>=7?'#e11d48':'#94a3b8'}}>
                        {r.resolved?'—':`${age}d`}
                      </td>
                      <td style={{fontFamily:'monospace',fontSize:11,color:'#94a3b8'}}>{r.date}</td>
                      <td><span className="badge" style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{r.section}</span></td>
                      <td style={{fontWeight:600,color:'#0f172a'}}>{r.topic||'—'}</td>
                      <td style={{color:'#64748b',maxWidth:130,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.test_name||'—'}</td>
                      <td><span className="badge" style={{background:'#fff7ed',color:'#c2410c',border:'1px solid #fed7aa'}}>{r.mistake_type||'—'}</span></td>
                      <td style={{color:'#64748b',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description||'—'}</td>
                      <td>
                        <div style={{display:'flex',gap:5}}>
                          <button className="btn btn-ghost btn-sm" onClick={()=>goEdit(r)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={()=>del(r.id)}>Del</button>
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