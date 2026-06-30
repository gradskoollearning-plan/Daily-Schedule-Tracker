import { LINKS } from '../lib/links';

export default function Links() {
  return (
    <div style={s.page} className="fade-in">
      <div>
        <h1 style={s.title}>🔗 Links</h1>
        <p style={s.sub}>Every platform you need, in one place</p>
      </div>

      {LINKS.length === 0 ? (
        <div className="empty-state">
          <span className="es-icon">🔗</span>
          <h3>No links added yet</h3>
          <p>Check back soon</p>
        </div>
      ) : (
        <div style={s.grid}>
          {LINKS.map(l => (
            <a key={l.title} href={l.url} target="_blank" rel="noreferrer" className="link-card">
              <span className="lc-icon" style={{background:'#fff1f1'}}>{l.icon}</span>
              <div className="lc-body">
                <p className="lc-title">{l.title}</p>
                <p className="lc-sub">{l.desc}</p>
              </div>
              <span className="lc-arrow">↗</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page:{padding:'24px 28px',maxWidth:900,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
  grid:{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:12},
};
