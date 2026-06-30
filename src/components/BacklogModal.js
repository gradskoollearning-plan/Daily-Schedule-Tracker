import { SCHEDULE, TYPE_CFG } from '../lib/schedule';

export default function BacklogModal({ backlogs, onClear, onDismiss }) {
  if (!backlogs || backlogs.length === 0) return null;

  return (
    <div className="modal-overlay" style={{ zIndex:300 }}>
      <div className="modal fade-in" style={{ maxWidth:520 }}>
        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.alertIcon}>⚠️</span>
            <div>
              <h3 style={s.title}>You have pending backlogs</h3>
              <p style={s.sub}>{backlogs.length} {backlogs.length === 1 ? 'session' : 'sessions'} marked as incomplete</p>
            </div>
          </div>
        </div>

        {/* Backlog list */}
        <div style={s.list}>
          {backlogs.map(b => {
            const entry = SCHEDULE.find(d => d.date === b.date);
            if (!entry) return null;
            const cfg = TYPE_CFG[entry.type];
            return (
              <div key={b.date} style={s.item}>
                <div style={s.itemLeft}>
                  <span className="badge" style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.border}` }}>
                    {cfg.label}
                  </span>
                  <div>
                    <p style={s.itemTopic}>{entry.topic}</p>
                    <p style={s.itemDate}>{new Date(b.date + 'T00:00:00').toLocaleDateString('en-IN',
                      { weekday:'short', day:'numeric', month:'short' })}</p>
                  </div>
                </div>
                <button className="btn btn-success btn-sm" onClick={() => onClear(b.date)}>
                  Mark Done
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={s.footer}>
          <p style={s.footerNote}>Complete these before moving ahead for best results.</p>
          <button className="btn btn-ghost" onClick={onDismiss}>
            Remind me later
          </button>
        </div>
      </div>
    </div>
  );
}

const s = {
  header: { padding:'24px 24px 16px', display:'flex', alignItems:'flex-start',
    justifyContent:'space-between', borderBottom:'1px solid #e2e8f0' },
  headerLeft: { display:'flex', alignItems:'center', gap:14 },
  alertIcon: { fontSize:32, flexShrink:0 },
  title: { fontSize:17, fontWeight:800, color:'#0f172a', marginBottom:2 },
  sub: { fontSize:13, color:'#64748b' },
  list: { padding:'16px 24px', display:'flex', flexDirection:'column',
    gap:10, overflowY:'auto', maxHeight:320 },
  item: { display:'flex', alignItems:'center', justifyContent:'space-between',
    gap:12, padding:'12px 14px', background:'#fff8f1',
    border:'1px solid #fed7aa', borderRadius:10 },
  itemLeft: { display:'flex', alignItems:'center', gap:12, minWidth:0 },
  itemTopic: { fontSize:13, fontWeight:600, color:'#0f172a',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:260 },
  itemDate: { fontSize:11, color:'#94a3b8', marginTop:2 },
  footer: { padding:'14px 24px 20px', borderTop:'1px solid #e2e8f0',
    display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 },
  footerNote: { fontSize:12, color:'#94a3b8', flex:1 },
};
