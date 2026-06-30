import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

const today = () => new Date().toISOString().split('T')[0];

export default function MyPlanner() {
  const { user } = useAuth();
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle]     = useState('');
  const [date, setDate]       = useState('');
  const [adding, setAdding]   = useState(false);
  const [tab, setTab]         = useState('today'); // today | upcoming | someday | all
  const [toast, setToast]     = useState('');

  function showToast(m){ setToast(m); setTimeout(()=>setToast(''),2000); }

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('student_tasks').select('*')
      .eq('user_id', user.id).order('date', { ascending: true, nullsFirst: false });
    setTasks(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function addTask() {
    if (!title.trim()) return;
    setAdding(true);
    const payload = { user_id: user.id, title: title.trim(), date: date || null, done: false };
    const { data, error } = await supabase.from('student_tasks').insert(payload).select().single();
    if (!error && data) setTasks(t => [...t, data]);
    setTitle(''); setDate(''); setAdding(false);
    showToast('✅ Added');
  }

  async function toggleDone(t) {
    const newVal = !t.done;
    setTasks(ts => ts.map(x => x.id===t.id ? {...x, done:newVal} : x));
    await supabase.from('student_tasks').update({ done: newVal, updated_at: new Date().toISOString() }).eq('id', t.id);
  }

  async function removeTask(id) {
    setTasks(ts => ts.filter(x => x.id !== id));
    await supabase.from('student_tasks').delete().eq('id', id);
  }

  if (loading) return <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>;

  const t0 = today();
  const todayTasks    = tasks.filter(t => t.date === t0);
  const upcomingTasks = tasks.filter(t => t.date && t.date > t0);
  const somedayTasks  = tasks.filter(t => !t.date);
  const list = tab==='today' ? todayTasks : tab==='upcoming' ? upcomingTasks : tab==='someday' ? somedayTasks : tasks;

  const TABS = [
    ['today',`Today (${todayTasks.length})`],
    ['upcoming',`Upcoming (${upcomingTasks.length})`],
    ['someday',`Someday (${somedayTasks.length})`],
    ['all',`All (${tasks.length})`],
  ];

  return (
    <div style={s.page} className="fade-in">
      <div>
        <h1 style={s.title}>🗒️ My Planner</h1>
        <p style={s.sub}>Your personal to-dos & custom schedule — only you can see this</p>
      </div>

      {/* Add task */}
      <div className="card" style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'flex-end'}}>
        <div style={{flex:1,minWidth:200}}>
          <label className="label">Task</label>
          <input className="input" placeholder="e.g. Revise Geometry formulas"
            value={title} onChange={e=>setTitle(e.target.value)}
            onKeyDown={e=>e.key==='Enter' && addTask()} />
        </div>
        <div style={{width:170}}>
          <label className="label">Date (optional)</label>
          <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={addTask} disabled={adding || !title.trim()}>
          {adding ? '…' : '+ Add'}
        </button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{alignSelf:'flex-start'}}>
        {TABS.map(([id,label]) => (
          <button key={id} className={`tab-btn ${tab===id?'active':''}`} onClick={()=>setTab(id)}>{label}</button>
        ))}
      </div>

      {/* List */}
      {list.length === 0 ? (
        <div className="empty-state">
          <span className="es-icon">🗒️</span>
          <h3>Nothing here yet</h3>
          <p>Add a task above to get started</p>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {list.map(t => (
            <div key={t.id} className={`todo-item ${t.done?'done':''}`}>
              <button className={`todo-check ${t.done?'checked':''}`} onClick={()=>toggleDone(t)}>
                {t.done ? '✓' : ''}
              </button>
              <span className="todo-title">{t.title}</span>
              {t.date && <span className="todo-date">{t.date}</span>}
              <button className="btn btn-ghost btn-sm" onClick={()=>removeTask(t.id)}>Del</button>
            </div>
          ))}
        </div>
      )}

      {toast && <div className="toast success">{toast}</div>}
    </div>
  );
}

const s = {
  page:{padding:'24px 28px',maxWidth:760,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
};
