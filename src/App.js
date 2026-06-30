import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { useProgress } from './hooks/useProgress';
import AuthPage    from './pages/AuthPage';
import ResetPassword from './pages/ResetPassword';
import Dashboard   from './pages/Dashboard';
import Planner     from './pages/Planner';
import MyPlanner   from './pages/MyPlanner';
import Links       from './pages/Links';
import Scores      from './pages/Scores';
import Analytics   from './pages/Analytics';
import Leaderboard from './pages/Leaderboard';
import Admin       from './pages/Admin';
import Sidebar     from './components/Sidebar';
import BacklogModal from './components/BacklogModal';
import './index.css';

export default function App() {
  return <AuthProvider><Inner /></AuthProvider>;
}

function Inner() {
  const { user, loading, recoveryMode, clearRecoveryMode } = useAuth();
  const [active, setActive] = useState('dashboard');
  const { backlogs, loading: progLoading, upsertProgress } = useProgress();
  const [dismissed, setDismissed] = useState(false);

  if (recoveryMode) {
    return <ResetPassword onDone={clearRecoveryMode} />;
  }

  if (loading) return (
    <div style={{height:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'#f5f7fa'}}>
      <div style={{width:34,height:34,border:'3px solid #e2e8f0',borderTopColor:'#ff5e5f',borderRadius:'50%',animation:'spin 0.75s linear infinite'}}/>
      <p style={{color:'#94a3b8',fontSize:14}}>Loading…</p>
    </div>
  );

  if (!user) return <AuthPage />;

  async function clearBacklog(date) {
    await upsertProgress(date, { task_done:true, backlog_cleared:true });
  }

  const NAV = [
    {id:'dashboard', icon:'⚡', label:'Dashboard'},
    {id:'planner',   icon:'📅', label:'Planner'},
    {id:'my-planner',icon:'🗒️', label:'My Planner'},
    {id:'links',     icon:'🔗', label:'Links'},
    {id:'scores',    icon:'📊', label:'Scores'},
    {id:'analytics', icon:'📈', label:'Analytics'},
    {id:'leaderboard',icon:'🏆',label:'Leaderboard'},
  ];

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'#f5f7fa'}}>
      <Sidebar active={active} setActive={setActive} />
      <main className="main-content" style={{flex:1,overflowY:'auto',background:'#f5f7fa'}}>
        {active==='dashboard'   && <Dashboard   setActive={setActive} />}
        {active==='planner'     && <Planner />}
        {active==='my-planner'  && <MyPlanner />}
        {active==='links'       && <Links />}
        {active==='scores'      && <Scores />}
        {active==='analytics'   && <Analytics />}
        {active==='leaderboard' && <Leaderboard />}
        {active==='admin'       && <Admin />}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-nav">
        <div className="mobile-nav-inner">
          {NAV.map(n=>(
            <button key={n.id} className={`mobile-nav-btn ${active===n.id?'active':''}`}
              onClick={()=>setActive(n.id)}>
              <span className="mnb-icon">{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Backlog popup — shown once per login session */}
      {!progLoading && !dismissed && backlogs.length > 0 && (
        <BacklogModal
          backlogs={backlogs}
          onClear={clearBacklog}
          onDismiss={() => setDismissed(true)}
        />
      )}
    </div>
  );
}
