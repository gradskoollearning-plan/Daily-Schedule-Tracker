import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProgress } from '../hooks/useProgress';
import { SCHEDULE } from '../lib/schedule';

const SECTIONS = [
  { key:'varc', label:'VARC' },
  { key:'dilr', label:'DILR' },
  { key:'qa',   label:'QA'   },
];

// Sensible default sections per test type. Mocks always cover all
// three; sectionals/area tests are usually a single section, so we
// leave those unchecked and let the student pick.
const DEFAULT_SECTIONS = {
  mock:      ['varc','dilr','qa'],
  sectional: [],
  area_test: [],
  marathon:  [],
  quiz:      [],
};

const EMPTY = {
  date:'', test_name:'', test_type:'mock', isCustom:false,
  sections: DEFAULT_SECTIONS.mock,
  varc_score:'',varc_attempts:'',varc_accuracy:'',
  dilr_score:'',dilr_attempts:'',dilr_accuracy:'',
  qa_score:'',qa_attempts:'',qa_accuracy:'',
  total_score:'',percentile:'',overall_accuracy:'',rank:'',notes:'',
};

const num = v => (v===''||v==null) ? null : Number(v);

export default function LogScore({ goTo }) {
  const { user } = useAuth();
  const { reload } = useProgress();
  const [form, setForm]     = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  // Pick up an "edit this score" handoff left by Scores.js, if any.
  useEffect(()=>{
    const raw = localStorage.getItem('gs_edit_score');
    if(!raw) return;
    localStorage.removeItem('gs_edit_score');
    try{
      const sc = JSON.parse(raw);
      const onSchedule = SCHEDULE.some(d=>d.date===sc.date && d.topic===sc.test_name);
      const sections = SECTIONS.filter(({key})=>
        sc[`${key}_score`]!=null || sc[`${key}_attempts`]!=null || sc[`${key}_accuracy`]!=null
      ).map(sec=>sec.key);
      setForm({
        date:sc.date, test_name:sc.test_name, test_type:sc.test_type, isCustom:!onSchedule,
        sections: sections.length ? sections : (DEFAULT_SECTIONS[sc.test_type]||[]),
        varc_score:sc.varc_score??'', varc_attempts:sc.varc_attempts??'', varc_accuracy:sc.varc_accuracy??'',
        dilr_score:sc.dilr_score??'', dilr_attempts:sc.dilr_attempts??'', dilr_accuracy:sc.dilr_accuracy??'',
        qa_score:sc.qa_score??'',     qa_attempts:sc.qa_attempts??'',     qa_accuracy:sc.qa_accuracy??'',
        total_score:sc.total_score??'', percentile:sc.percentile??'',
        overall_accuracy:sc.overall_accuracy??'', rank:sc.rank??'', notes:sc.notes??'',
      });
      setEditId(sc.id);
    }catch{ /* ignore malformed payload */ }
  },[]);

  function handleScheduleDateChange(d) {
    set('date',d);
    const e=SCHEDULE.find(s=>s.date===d);
    if(e){
      set('test_name',e.topic);
      set('test_type',e.type);
      set('sections', DEFAULT_SECTIONS[e.type] || []);
    }
  }

  function handleTypeChange(t) {
    set('test_type',t);
    set('sections', DEFAULT_SECTIONS[t] || []);
  }

  function toggleSection(key) {
    setForm(f=>{
      const has = f.sections.includes(key);
      return { ...f, sections: has ? f.sections.filter(k=>k!==key) : [...f.sections, key] };
    });
  }

  function cancel(){
    goTo('scores');
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
    let savedRow = null;
    if(editId) {
      await supabase.from('test_scores').update(payload).eq('id',editId);
    } else {
      const { data } = await supabase.from('test_scores').upsert(payload,{onConflict:'user_id,date,test_name'}).select().single();
      savedRow = data;
    }
    setSaving(false);
    reload();
    // Leave a note for Scores.js to show the "log a mistake?" nudge on a fresh save.
    if(savedRow) {
      localStorage.setItem('gs_just_saved_score', JSON.stringify({ id: savedRow.id, test_name: savedRow.test_name }));
    }
    goTo('scores');
  }

  return (
    <div style={s.page} className="fade-in">
      <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}} onClick={cancel}>← Back to Scores</button>

      <div>
        <h1 style={s.title}>{editId?'✏️ Edit Score':'📊 Log New Score'}</h1>
        <p style={s.sub}>{editId?'Update this test result':'Log and track all your test results — scheduled or extra practice'}</p>
      </div>

      <div className="card" style={{display:'flex',flexDirection:'column',gap:16,maxWidth:680}}>
        {!editId && (
          <div className="tabs" style={{alignSelf:'flex-start'}}>
            <button className={`tab-btn ${!form.isCustom?'active':''}`}
              onClick={()=>setForm(f=>({...f,isCustom:false,date:'',test_name:''}))}>
              📅 From Schedule
            </button>
            <button className={`tab-btn ${form.isCustom?'active':''}`}
              onClick={()=>setForm(f=>({...f,isCustom:true,date:'',test_name:''}))}>
              ➕ Extra / Custom Test
            </button>
          </div>
        )}

        <div className="grid-2">
          <div>
            <label className="label">Date</label>
            {form.isCustom ? (
              <input className="input" type="date" value={form.date}
                onChange={e=>set('date',e.target.value)}/>
            ) : (
              <select className="input" value={form.date} onChange={e=>handleScheduleDateChange(e.target.value)}>
                <option value="">Select date…</option>
                {SCHEDULE.map(d=>(
                  <option key={d.date} value={d.date}>{d.date} — {d.topic}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">Test Type</label>
            <select className="input" value={form.test_type} onChange={e=>handleTypeChange(e.target.value)}>
              <option value="mock">Mock Test</option>
              <option value="sectional">Sectional</option>
              <option value="area_test">Area Test</option>
              <option value="quiz">Quiz</option>
              <option value="marathon">Marathon</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Test Name</label>
          <input className="input" value={form.test_name} onChange={e=>set('test_name',e.target.value)}
            disabled={!form.isCustom && !editId}
            placeholder="e.g. iCAT 25, Algebra Area Test 4, extra VARC sectional from Insiders"/>
          {!form.isCustom && !editId && (
            <p style={{fontSize:11,color:'#94a3b8',marginTop:4}}>Auto-filled from schedule. Switch to "Extra / Custom Test" to type your own.</p>
          )}
        </div>

        <div>
          <div style={{fontSize:11,fontWeight:800,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:6,borderBottom:'1px solid #f1f5f9',marginBottom:10}}>
            Which sections does this test cover?
          </div>
          <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
            {SECTIONS.map(sec=>{
              const checked = form.sections.includes(sec.key);
              return (
                <button key={sec.key} type="button" onClick={()=>toggleSection(sec.key)}
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
          {form.sections.length===0 && (
            <p style={{fontSize:11,color:'#d97706',marginTop:6}}>
              Tip: for a sectional, tap just the one section it tested — no need to fill all three.
            </p>
          )}
        </div>

        {form.sections.length>0 && (
          <>
            {SECTIONS.filter(sec=>form.sections.includes(sec.key)).map(({key:k,label:l})=>(
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

        <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:10,marginTop:4,borderTop:'1px solid #f1f5f9'}}>
          <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" onClick={save}
            disabled={saving||!form.date||!form.test_name}>
            {saving?'…':editId?'Update Score':'Save Score'}
          </button>
        </div>
      </div>
    </div>
  );
}

const s={
  page:{padding:'24px 28px',maxWidth:1200,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
};