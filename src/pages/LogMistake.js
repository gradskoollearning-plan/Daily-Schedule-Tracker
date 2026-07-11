import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const SECTIONS = [
  { key:'VARC' }, { key:'DILR' }, { key:'QA' }, { key:'General' },
];

const MISTAKE_TYPES = [
  'Silly Mistake','Conceptual Gap','Time Management',
  'Careless Reading','Calculation Error','Wrong Approach','Other',
];

const today = () => new Date().toISOString().split('T')[0];

const EMPTY = {
  date:today(), section:'VARC', topic:'', mistake_type:'Silly Mistake', description:'',
  test_score_id:'', test_name_custom:'', resolved:false,
};

export default function LogMistake({ goTo }) {
  const { user } = useAuth();
  const [form, setForm]         = useState(EMPTY);
  const [editId, setEditId]     = useState(null);
  const [myScores, setMyScores] = useState([]);
  const [saving, setSaving]     = useState(false);
  const set = (k,v)=>setForm(f=>({...f,[k]:v}));

  useEffect(()=>{
    async function init(){
      if(!user) return;
      const { data: sc } = await supabase.from('test_scores')
        .select('id,date,test_name,test_type').eq('user_id',user.id).order('date',{ascending:false});
      setMyScores(sc||[]);

      // Priority: an explicit "edit this mistake" handoff, then a
      // "pending mistake for a just-saved test" handoff, then a
      // "pre-pick this section" handoff from the summary cards.
      const editRaw    = localStorage.getItem('gs_edit_mistake');
      const pendingRaw = localStorage.getItem('gs_pending_mistake');
      const sectionRaw = localStorage.getItem('gs_new_mistake_section');

      if(editRaw){
        localStorage.removeItem('gs_edit_mistake');
        try{
          const r = JSON.parse(editRaw);
          setForm({
            date:r.date, section:r.section, topic:r.topic||'',
            mistake_type:r.mistake_type||'Silly Mistake', description:r.description||'',
            test_score_id: r.test_score_id || '',
            test_name_custom: r.test_score_id ? '' : (r.test_name||''),
            resolved: r.resolved||false,
          });
          setEditId(r.id);
        }catch{ /* ignore malformed payload */ }
      } else if(pendingRaw){
        localStorage.removeItem('gs_pending_mistake');
        try{
          const pending = JSON.parse(pendingRaw);
          setForm({...EMPTY, test_score_id: pending.test_score_id||'', test_name_custom: pending.test_name||''});
        }catch{ /* ignore malformed payload */ }
      } else if(sectionRaw){
        localStorage.removeItem('gs_new_mistake_section');
        setForm({...EMPTY, section: sectionRaw});
      }
    }
    init();
  },[user]);

  function cancel(){ goTo('mistakes'); }

  async function save(){
    if(!form.date||!form.section) return;
    setSaving(true);
    const linkedScore = myScores.find(s=>s.id===form.test_score_id);
    const payload = {
      user_id:user.id, date:form.date, section:form.section, topic:form.topic||null,
      mistake_type:form.mistake_type, description:form.description||null,
      resolved: form.resolved,
      test_score_id: form.test_score_id || null,
      test_name: linkedScore ? linkedScore.test_name : (form.test_name_custom || null),
    };
    if(editId) await supabase.from('mistake_log').update(payload).eq('id',editId);
    else await supabase.from('mistake_log').insert(payload);
    setSaving(false);
    goTo('mistakes');
  }

  return (
    <div style={s.page} className="fade-in">
      <button className="btn btn-ghost btn-sm" style={{alignSelf:'flex-start'}} onClick={cancel}>← Back to Mistakes</button>

      <div>
        <h1 style={s.title}>{editId?'✏️ Edit Mistake':'🧩 Log a Mistake'}</h1>
        <p style={s.sub}>Track exactly where and why you're losing marks</p>
      </div>

      <div className="card" style={{display:'flex',flexDirection:'column',gap:16,maxWidth:560}}>
        <div className="grid-2">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={form.date} onChange={e=>set('date',e.target.value)}/>
          </div>
          <div>
            <label className="label">Section</label>
            <select className="input" value={form.section} onChange={e=>set('section',e.target.value)}>
              {SECTIONS.map(sec=><option key={sec.key} value={sec.key}>{sec.key}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Topic (optional)</label>
          <input className="input" value={form.topic} onChange={e=>set('topic',e.target.value)}
            placeholder="e.g. Parajumbles, TSD, Puzzles"/>
        </div>

        <div>
          <label className="label">Link to a logged test (optional)</label>
          <select className="input" value={form.test_score_id} onChange={e=>set('test_score_id',e.target.value)}>
            <option value="">— Not linked to a specific test —</option>
            {myScores.map(sc=>(
              <option key={sc.id} value={sc.id}>{sc.date} — {sc.test_name}</option>
            ))}
          </select>
          {!form.test_score_id && (
            <input className="input" style={{marginTop:8}} value={form.test_name_custom}
              onChange={e=>set('test_name_custom',e.target.value)}
              placeholder="Or just type a test name (if not logged yet)"/>
          )}
        </div>

        <div>
          <label className="label">Mistake Type</label>
          <select className="input" value={form.mistake_type} onChange={e=>set('mistake_type',e.target.value)}>
            {MISTAKE_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">What happened?</label>
          <textarea className="input" value={form.description} onChange={e=>set('description',e.target.value)}
            placeholder="e.g. Misread the question, assumed wrong sign in inequality…" style={{minHeight:80}}/>
        </div>

        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,color:'#0f172a'}}>
          <input type="checkbox" checked={form.resolved} onChange={e=>set('resolved',e.target.checked)}
            style={{width:16,height:16}}/>
          Already fixed this — mark as resolved
        </label>

        <div style={{display:'flex',justifyContent:'flex-end',gap:8,paddingTop:10,marginTop:4,borderTop:'1px solid #f1f5f9'}}>
          <button className="btn btn-ghost" onClick={cancel}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving||!form.date||!form.section}>
            {saving?'…':editId?'Update':'Save'}
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