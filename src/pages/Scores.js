import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProgress } from '../hooks/useProgress';
import { SCHEDULE, TYPE_CFG } from '../lib/schedule';

const EMPTY = {
  date:'',test_name:'',test_type:'mock',
  varc_score:'',varc_attempts:'',varc_accuracy:'',
  dilr_score:'',dilr_attempts:'',dilr_accuracy:'',
  qa_score:'',qa_attempts:'',qa_accuracy:'',
  total_score:'',percentile:'',overall_accuracy:'',rank:'',notes:'',
};

const num = v => (v===''||v==null) ? null : Number(v);

export default function Scores() {
  const { user }  = useAuth();
  const { scores, reload } = useProgress();
  const [form, setForm]     = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab]       = useState('all');
  const [toast, setToast]   = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  function showToast(m){ setToast(m); setTimeout(()=>setToast(''),2200); }

  function handleDateChange(d) {
    set('date',d);
    const e=SCHEDULE.find(s=>s.date===d);
    if(e){ set('test_name',e.topic); set('test_type',e.type); }
  }

  async function save() {
    if(!form.date||!form.test_name) return;
    setSaving(true);
    const payload = {
      user_id:user.id, date:form.date, test_name:form.test_name, test_type:form.test_type,
      varc_score:num(form.varc_score), varc_attempts:num(form.varc_attempts), varc_accuracy:num(form.varc_accuracy),
      dilr_score:num(form.dilr_score), dilr_attempts:num(form.dilr_attempts), dilr_accuracy:num(form.dilr_accuracy),
      qa_score:num(form.qa_score),     qa_attempts:num(form.qa_attempts),     qa_accuracy:num(form.qa_accuracy),
      total_score:num(form.total_score), percentile:num(form.percentile),
      overall_accuracy:num(form.overall_accuracy), rank:num(form.rank), notes:form.notes||null,
    };
    if(editId) await supabase.from('test_scores').update(payload).eq('id',editId);
    else await supabase.from('test_scores').upsert(payload,{onConflict:'user_id,date,test_name'});
    setSaving(false); setShowForm(false); setEditId(null); setForm(EMPTY);
    reload(); showToast('✅ Score saved!');
  }

  function editScore(sc) {
    setForm({
      date:sc.date, test_name:sc.test_name, test_type:sc.test_type,
      varc_score:sc.varc_score??'', varc_attempts:sc.varc_attempts??'', varc_accuracy:sc.varc_accuracy??'',
      dilr_score:sc.dilr_score??'', dilr_attempts:sc.dilr_attempts??'', dilr_accuracy:sc.dilr_accuracy??'',
      qa_score:sc.qa_score??'',     qa_attempts:sc.qa_attempts??'',     qa_accuracy:sc.qa_accuracy??'',
      total_score:sc.total_score??'', percentile:sc.percentile??'',
      overall_accuracy:sc.overall_accuracy??'', rank:sc.rank??'', notes:sc.notes??'',
    });
    setEditId(sc.id); setShowForm(true);
  }

  async function del(id) {
    await supabase.from('test_scores').delete().eq('id',id);
    reload(); showToast('Deleted');
  }

  const hasSections = ['mock','sectional'].includes(form.test_type);
  const filtered = tab==='all' ? [...scores].reverse() : [...scores].reverse().filter(s=>s.test_type===tab);

  // Summary stats
  const mocks = scores.filter(s=>s.test_type==='mock');
  const avgPct = mocks.length ? Math.round(mocks.reduce((a,s)=>a+(s.percentile||0),0)/mocks.length) : 0;
  const bestPct = mocks.length ? Math.max(...mocks.map(s=>s.percentile||0)) : 0;

  return (
    <div style={s.page} className="fade-in">
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
        <div>
          <h1 style={s.title}>📊 Test Scores</h1>
          <p style={s.sub}>Log and track all your test results</p>
        </div>
        <button className="btn btn-primary" onClick={()=>{setShowForm(true);setEditId(null);setForm(EMPTY);}}>
          + Log Score
        </button>
      </div>

      {/* Quick stats */}
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

      {/* Filter tabs */}
      <div className="tabs" style={{alignSelf:'flex-start'}}>
        {['all','mock','sectional','area_test'].map(t=>(
          <button key={t} className={`tab-btn ${tab===t?'active':''}`} onClick={()=>setTab(t)}>
            {t==='all'?'All Tests':TYPE_CFG[t].label}
          </button>
        ))}
      </div>

      {/* Table */}
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

      {/* Score Form Modal */}
      {showForm&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal" style={{maxWidth:600}}>
            <div className="modal-head">
              <h3>{editId?'Edit Score':'Log New Score'}</h3>
              <button className="close-btn" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Date + Type */}
              <div className="grid-2">
                <div>
                  <label className="label">Date</label>
                  <select className="input" value={form.date} onChange={e=>handleDateChange(e.target.value)}>
                    <option value="">Select date…</option>
                    {SCHEDULE.map(d=>(
                      <option key={d.date} value={d.date}>{d.date} — {d.topic}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Test Type</label>
                  <select className="input" value={form.test_type} onChange={e=>set('test_type',e.target.value)}>
                    <option value="mock">Mock Test</option>
                    <option value="sectional">Sectional</option>
                    <option value="area_test">Area Test</option>
                    <option value="marathon">Marathon</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Test Name</label>
                <input className="input" value={form.test_name} onChange={e=>set('test_name',e.target.value)}
                  placeholder="e.g. iCAT 25, Algebra Area Test 4"/>
              </div>

              {/* Section scores — only for mock/sectional */}
              {hasSections&&(
                <>
                  <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:6,borderBottom:'1px solid #f1f5f9'}}>
                    Section-wise Scores
                  </div>
                  {[['varc','VARC'],['dilr','DILR'],['qa','QA']].map(([k,l])=>(
                    <div key={k} style={{padding:'12px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #f1f5f9'}}>
                      <p style={{fontSize:12,fontWeight:700,color:'#ff5e5f',marginBottom:10}}>{l}</p>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                        {[['score','Score'],['attempts','Attempts'],['accuracy','Accuracy %']].map(([f,lb])=>(
                          <div key={f}>
                            <label className="label">{lb}</label>
                            <input className="input" type="number" value={form[`${k}_${f}`]}
                              onChange={e=>set(`${k}_${f}`,e.target.value)} placeholder="0"/>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Overall */}
              <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:6,borderBottom:'1px solid #f1f5f9'}}>
                Overall Result
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
                {[['total_score','Total Score'],['percentile','Percentile'],['overall_accuracy','Accuracy %'],['rank','Rank']].map(([k,l])=>(
                  <div key={k}>
                    <label className="label">{l}</label>
                    <input className="input" type="number" value={form[k]} onChange={e=>set(k,e.target.value)} placeholder="—"/>
                  </div>
                ))}
              </div>

              <div>
                <label className="label">Notes / Takeaways</label>
                <textarea className="input" value={form.notes} onChange={e=>set('notes',e.target.value)}
                  placeholder="What went well? What to improve?" style={{minHeight:72}}/>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}
                disabled={saving||!form.date||!form.test_name}>
                {saving?'…':editId?'Update Score':'Save Score'}
              </button>
            </div>
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
