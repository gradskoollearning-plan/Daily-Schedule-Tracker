import { useProgress } from '../hooks/useProgress';
import { SCHEDULE } from '../lib/schedule';
import { LineChart,Line,XAxis,YAxis,Tooltip,ResponsiveContainer,CartesianGrid,Legend,BarChart,Bar } from 'recharts';

const TIP = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 14px',fontSize:12,boxShadow:'0 4px 12px rgba(0,0,0,0.08)'}}>
    <p style={{color:'#94a3b8',marginBottom:6,fontWeight:600}}>{label}</p>
    {payload.map(p=><p key={p.name} style={{color:p.color,fontWeight:600}}>{p.name}: <span style={{color:'#0f172a'}}>{p.value}</span></p>)}
  </div>;
};

export default function Analytics() {
  const { scores, progress, loading, mocks, avgPercentile, bestPercentile, streak, weakSection, daysCompleted, elapsed, backlogs } = useProgress();
  const today = new Date().toISOString().split('T')[0];

  if(loading) return <div style={{padding:48,textAlign:'center',color:'#94a3b8'}}>Loading…</div>;

  const trendData = mocks.map(s=>({
    name: s.test_name.replace('Mock- ','#').replace('Mock-','#'),
    Total:s.total_score, Percentile:s.percentile, Accuracy:s.overall_accuracy,
    VARC:s.varc_score, DILR:s.dilr_score, QA:s.qa_score,
  }));

  const weekData = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-6+i);
    const date=d.toISOString().split('T')[0];
    const p=progress[date]||{};
    return {
      name:d.toLocaleDateString('en',{weekday:'short'}),
      Steps:[1,2,3,4,5].filter(n=>p[`step${n}`]).length,
    };
  });

  const avgAcc = mocks.length ? Math.round(mocks.reduce((a,s)=>a+(s.overall_accuracy||0),0)/mocks.length) : 0;
  const compRate = elapsed ? Math.round((daysCompleted/elapsed)*100) : 0;
  const studyHrs = (Object.values(progress).reduce((a,p)=>a+(p.study_seconds||0),0)/3600).toFixed(1);

  return (
    <div style={s.page} className="fade-in">
      <div><h1 style={s.title}>📈 Analytics</h1><p style={s.sub}>Your performance trends and prep insights</p></div>

      {/* KPI row */}
      <div className="grid-4">
        {[
          {icon:'📈',label:'Avg Percentile',  val:`${avgPercentile}%ile`, color:'#ff5e5f'},
          {icon:'🏆',label:'Best Percentile', val:`${bestPercentile}%ile`,color:'#7c3aed'},
          {icon:'🎯',label:'Avg Accuracy',    val:`${avgAcc}%`,           color:'#d97706'},
          {icon:'✅',label:'Completion Rate', val:`${compRate}%`,         color:'#059669'},
        ].map(c=>(
          <div key={c.label} className="metric">
            <p className="metric-label">{c.icon} {c.label}</p>
            <p className="metric-value" style={{color:c.color}}>{c.val}</p>
          </div>
        ))}
      </div>

      {/* Weak section */}
      {weakSection&&(
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 16px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:10}}>
          <span style={{fontSize:20}}>🎯</span>
          <p style={{fontSize:13,color:'#92400e'}}>
            <strong>Weak section: {weakSection}</strong> — lowest average across all mocks. Prioritise this in revision.
          </p>
        </div>
      )}

      <div className="grid-2">
        {/* Summary */}
        <div className="card">
          <p style={s.sec}>Overview</p>
          <div style={{display:'flex',flexDirection:'column',gap:12,marginTop:12}}>
            {[
              {label:'Days Completed',  val:daysCompleted, of:elapsed,  color:'#ff5e5f'},
              {label:'Pending Backlogs',val:backlogs.length,of:null,    color:'#e11d48'},
              {label:'Mocks Attempted', val:mocks.length,  of:null,     color:'#7c3aed'},
              {label:'Study Hours',     val:`${studyHrs}h`,of:null,     color:'#0284c7'},
              {label:'Streak',          val:`${streak} days`,of:null,   color:'#d97706'},
            ].map(r=>(
              <div key={r.label}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:13,color:'#475569'}}>{r.label}</span>
                  <span style={{fontSize:13,fontWeight:700,color:r.color}}>{r.val}{r.of!=null?` / ${r.of}`:''}</span>
                </div>
                {r.of!=null&&<div className="progress-track"><div className="progress-fill" style={{width:`${Math.round((r.val/r.of)*100)}%`,background:r.color}}/></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Weekly steps */}
        <div className="card">
          <p style={s.sec}>This Week — Steps Done</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={weekData} style={{marginTop:12}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
              <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false} domain={[0,5]}/>
              <Tooltip content={<TIP/>}/>
              <Bar dataKey="Steps" fill="#ff5e5f" radius={[6,6,0,0]} maxBarSize={28}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {trendData.length>1 ? (
        <>
          <div className="card">
            <p style={s.sec}>Mock Score Trend</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} style={{marginTop:12}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TIP/>}/>
                <Legend iconSize={10} wrapperStyle={{fontSize:12,color:'#475569'}}/>
                <Line type="monotone" dataKey="Total"      stroke="#ff5e5f" strokeWidth={2.5} dot={{r:4,fill:'#ff5e5f',strokeWidth:0}}/>
                <Line type="monotone" dataKey="Percentile" stroke="#059669" strokeWidth={2.5} dot={{r:4,fill:'#059669',strokeWidth:0}}/>
                <Line type="monotone" dataKey="Accuracy"   stroke="#d97706" strokeWidth={2.5} dot={{r:4,fill:'#d97706',strokeWidth:0}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <p style={s.sec}>Section-wise Scores (Mocks)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} style={{marginTop:12}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/>
                <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:'#94a3b8',fontSize:11}} axisLine={false} tickLine={false}/>
                <Tooltip content={<TIP/>}/>
                <Legend iconSize={10} wrapperStyle={{fontSize:12,color:'#475569'}}/>
                <Bar dataKey="VARC" fill="#ff5e5f" radius={[4,4,0,0]}/>
                <Bar dataKey="DILR" fill="#7c3aed" radius={[4,4,0,0]}/>
                <Bar dataKey="QA"   fill="#0284c7" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="empty-state"><span className="es-icon">📈</span><h3>Log 2+ mocks to see trends</h3><p>Add your mock scores to unlock trend charts.</p></div>
      )}
    </div>
  );
}

const s={
  page:{padding:'24px 28px',maxWidth:1060,margin:'0 auto',display:'flex',flexDirection:'column',gap:18},
  title:{fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:4},
  sub:{fontSize:13,color:'#94a3b8'},
  sec:{fontSize:14,fontWeight:700,color:'#0f172a'},
};
