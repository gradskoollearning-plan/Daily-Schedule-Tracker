import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useProgress } from '../hooks/useProgress';

function fmt(secs) {
  const h = Math.floor((secs||0)/3600);
  const m = Math.floor(((secs||0)%3600)/60);
  return h>0 ? `${h}h ${m}m` : `${m}m`;
}

export default function Leaderboard() {
  const { profile } = useAuth();
  const { daysCompleted, avgPercentile, bestPercentile, mocks, progress, loading: progLoading } = useProgress();
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    supabase.rpc('get_leaderboard')
      .then(({data})=>{ setRows(data||[]); setLoading(false); });
  },[]);

  const myRank = rows.find(r=>r.is_me)?.rank;
  const studyHrs = (Object.values(progress).reduce((a,p)=>a+(p.study_seconds||0),0)/3600);

  return (
    <div style={s.page} className="fade-in">
      <div>
        <h1 style={s.title}>🏆 Leaderboard</h1>
        <p style={s.sub}>Batch rankings — stay consistent, stay ahead</p>
      </div>

      {/* My rank card — the only place actual numbers ever appear */}
      {!progLoading && (
        <div style={s.myCard}>
          <div style={s.myLeft}>
            <div style={s.myAvatar}>{(profile?.name||'S')[0].toUpperCase()}</div>
            <div>
              <p style={{fontSize:14,fontWeight:800,color:'#0f172a'}}>You — {profile?.name}</p>
              <p style={{fontSize:12,color:'#64748b',marginTop:2}}>{myRank?`Rank #${myRank} of ${rows.length}`:'Calculating rank…'}</p>
            </div>
          </div>
          <div style={s.myStats}>
            {[
              ['Days Done',    daysCompleted],
              ['Avg %ile',    `${avgPercentile}%ile`],
              ['Best %ile',   `${bestPercentile}%ile`],
              ['Study Time',  fmt(studyHrs*3600)],
              ['Mocks',       mocks.length],
            ].map(([l,v])=>(
              <div key={l} style={{textAlign:'center'}}>
                <p style={{fontSize:18,fontWeight:800,color:'#ff5e5f',fontFamily:'monospace'}}>{v}</p>
                <p style={{fontSize:11,color:'#94a3b8',fontWeight:600}}>{l}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{padding:'10px 14px',background:'#f0f9ff',border:'1px solid #bae6fd',borderRadius:10,display:'flex',alignItems:'center',gap:8}}>
        <span style={{fontSize:15}}>🔒</span>
        <p style={{fontSize:12,color:'#0369a1'}}>For privacy, you can only see your own scores and study time. The board below shows rank by name only.</p>
      </div>

      {loading ? (
        <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>
      ) : (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{width:48}}>#</th>
                <th>Student</th>
                <th>Days Done</th>
                <th>Avg %ile</th>
                <th>Study Time</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r=>{
                const isMe = r.is_me;
                const i = r.rank - 1;
                const mc = i===0?'#F5A623': i===1?'#94a3b8': i===2?'#cd7c3e': 'transparent';
                return (
                  <tr key={r.id} style={{background:isMe?'#fff1f1':''}}>
                    <td>
                      <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                        background:mc!=='transparent'?mc:'#f1f5f9',
                        color:mc!=='transparent'?'#fff':'#94a3b8',fontSize:12,fontWeight:800}}>
                        {i<3?['🥇','🥈','🥉'][i]:r.rank}
                      </div>
                    </td>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:9}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#ff5e5f,#ff8a65)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>
                          {(r.name||'?')[0].toUpperCase()}
                        </div>
                        <span style={{fontWeight:isMe?700:600,color:isMe?'#ff5e5f':'#0f172a'}}>
                          {r.name}{isMe?' (You)':''}
                        </span>
                      </div>
                    </td>
                    <td className={isMe?'':'masked'} style={{fontFamily:'monospace',fontWeight:isMe?700:400,color:isMe?'#ff5e5f':undefined}}>
                      {isMe ? r.days_completed : '••'}
                    </td>
                    <td className={isMe?'':'masked'} style={{fontWeight:isMe?700:400,color:isMe?'#ff5e5f':undefined}}>
                      {isMe ? `${r.avg_percentile}%ile` : '••'}
                    </td>
                    <td className={isMe?'':'masked'} style={{fontWeight:isMe?700:400,color:isMe?'#ff5e5f':undefined}}>
                      {isMe ? fmt(r.total_study_seconds) : '••'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p style={{fontSize:12,color:'#94a3b8',textAlign:'center'}}>Ranked by average percentile, then days completed. Updates as students log progress.</p>
    </div>
  );
}

const s={
  page:{padding:'24px 28px',maxWidth:960,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
  myCard:{background:'linear-gradient(135deg,#fff1f1,#fff8f1)',border:'1px solid #ffc9c9',borderRadius:12,padding:'18px 22px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:16},
  myLeft:{display:'flex',alignItems:'center',gap:12},
  myAvatar:{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#ff5e5f,#ff8a65)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,flexShrink:0},
  myStats:{display:'flex',gap:24,flexWrap:'wrap'},
};
