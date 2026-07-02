import { useAuth } from '../lib/AuthContext';

const NAV_GROUPS = [
  { label: 'Overview', items: [
    { id:'dashboard', icon:'⚡', label:'Dashboard' },
  ]},
  { label: 'Study', items: [
    { id:'planner',   icon:'📅', label:'Planner' },
    { id:'my-planner',icon:'🗒️', label:'My Planner' },
    { id:'links',     icon:'🔗', label:'Links' },
  ]},
  { label: 'Performance', items: [
    { id:'scores',    icon:'📊', label:'Scores' },
    { id:'mistakes',  icon:'🧩', label:'Mistakes' },
    { id:'analytics', icon:'📈', label:'Analytics' },
    { id:'leaderboard',icon:'🏆',label:'Leaderboard' },
  ]},
  { label: 'Admin', items: [
    { id:'admin',     icon:'🛡️', label:'Admin', adminOnly: true },
  ]},
];

export default function Sidebar({ active, setActive }) {
  const { profile, signOut } = useAuth();
  const initial = (profile?.name||'S')[0].toUpperCase();

  return (
    <aside className="sidebar" style={s.sidebar}>
      <div style={s.logoWrap}>
        <div style={s.logo}>
          <span style={s.ltxt}>GRADSKOOL</span>
          <span style={s.ldot}>.</span>
        </div>
        <p style={s.lsub}>CAT 2026 Tracker</p>
      </div>

      <div className="divider" style={{margin:'0 0 4px'}} />

      <nav style={s.nav}>
        {NAV_GROUPS.map(group => {
          const items = group.items.filter(n => !n.adminOnly || profile?.is_admin);
          if (items.length === 0) return null;
          return (
            <div key={group.label}>
              <p className="nav-section-label">{group.label}</p>
              {items.map(item => (
                <button key={item.id} onClick={() => setActive(item.id)}
                  style={{...s.btn, ...(active===item.id ? s.btnActive : {})}}>
                  <span style={s.ic}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      <div style={s.bottom}>
        <div className="divider" style={{marginBottom:14}} />
        <div style={s.user}>
          <div style={s.avatar}>{initial}</div>
          <div style={s.uinfo}>
            <p style={s.uname}>{profile?.name||'Student'}</p>
            <p style={s.uemail}>{profile?.email||''}</p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={signOut} style={{width:'100%',marginTop:8,justifyContent:'center'}}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

const s = {
  sidebar:{width:220,flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',padding:'18px 10px',height:'100vh',position:'sticky',top:0,overflowY:'auto'},
  logoWrap:{padding:'4px 6px 12px'},
  logo:{display:'flex',alignItems:'baseline',gap:1},
  ltxt:{fontSize:17,fontWeight:900,letterSpacing:'-0.5px',color:'#1e1b4b'},
  ldot:{fontSize:17,fontWeight:900,color:'#F5A623'},
  lsub:{fontSize:10,color:'#94a3b8',marginTop:2,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase'},
  nav:{flex:1,display:'flex',flexDirection:'column',gap:1},
  btn:{display:'flex',alignItems:'center',gap:9,width:'100%',padding:'8px 9px',borderRadius:8,border:'none',background:'transparent',color:'#64748b',fontSize:13,fontWeight:500,cursor:'pointer',textAlign:'left',fontFamily:'inherit',transition:'all 0.1s'},
  btnActive:{background:'#fff1f1',color:'#ff5e5f',fontWeight:700},
  ic:{fontSize:15,width:20,textAlign:'center',flexShrink:0},
  bottom:{},
  user:{display:'flex',alignItems:'center',gap:9,padding:'2px 4px'},
  avatar:{width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#ff5e5f,#ff8a65)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,flexShrink:0},
  uinfo:{minWidth:0},
  uname:{fontSize:13,fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
  uemail:{fontSize:10,color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},
};
