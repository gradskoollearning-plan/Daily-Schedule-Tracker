import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function AuthPage() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode]    = useState('login'); // login | signup | forgot
  const [form, setForm]    = useState({ name:'', email:'', password:'' });
  const [error, setError]  = useState('');
  const [info, setInfo]    = useState('');
  const [loading, setLoading] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  function switchMode(m) { setMode(m); setError(''); setInfo(''); }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setInfo(''); setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await signIn(form.email, form.password);
        if (error) setError(error.message);
      } else if (mode === 'signup') {
        const { error } = await signUp(form.email, form.password, form.name);
        if (error) setError(error.message);
      } else if (mode === 'forgot') {
        if (!form.email) { setError('Enter your email first'); return; }
        const { error } = await resetPassword(form.email);
        if (error) setError(error.message);
        else setInfo('✅ Reset link sent — check your email (and spam folder).');
      }
    } finally { setLoading(false); }
  }

  const heading = mode==='login' ? 'Welcome back 👋' : mode==='signup' ? 'Create account' : 'Reset password';
  const sub = mode==='login' ? 'Log in to your tracker'
    : mode==='signup' ? 'Start tracking your CAT 2026 prep'
    : "Enter your email and we'll send you a reset link";
  const btnLabel = loading ? '…' : mode==='login' ? 'Log In →' : mode==='signup' ? 'Create Account →' : 'Send Reset Link →';

  return (
    <div style={s.page}>
      <div style={s.left}>
        <div style={s.leftInner}>
          <div style={s.logo}><span style={s.logoTxt}>GRADSKOOL</span><span style={s.logoDot}>.</span></div>
          <p style={s.tagline}>CAT 2026 — Personal Study Tracker</p>
          <div style={s.feats}>
            {[
              ['📅','Daily planner with 5-step class tracker'],
              ['✅','Track mocks, sectionals & area tests'],
              ['📊','Score trends & percentile analytics'],
              ['🏆','Batch leaderboard & streak tracking'],
              ['⚠️','Backlog alerts so nothing slips'],
              ['⏱️','Built-in study timer per session'],
              ['🔗','One-tap links to every platform'],
              ['🗒️','Your own custom planner & to-dos'],
            ].map(([ic,tx])=>(
              <div key={tx} style={s.feat}>
                <span style={s.featIc}>{ic}</span>
                <span style={s.featTx}>{tx}</span>
              </div>
            ))}
          </div>
          <p style={s.url}>gradskool.in</p>
        </div>
      </div>

      <div style={s.right}>
        <div style={s.box} className="fade-in" key={mode}>
          <h2 style={s.title}>{heading}</h2>
          <p style={s.sub}>{sub}</p>

          <form onSubmit={handleSubmit} style={s.form}>
            {mode==='signup'&&(
              <div><label className="label">Your Name</label>
              <input className="input" placeholder="Rahul Sharma" value={form.name} onChange={e=>set('name',e.target.value)} required /></div>
            )}
            <div><label className="label">Email</label>
            <input className="input" type="email" placeholder="you@email.com" value={form.email} onChange={e=>set('email',e.target.value)} required /></div>

            {mode!=='forgot'&&(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <label className="label" style={{marginBottom:0}}>Password</label>
                  {mode==='login'&&(
                    <button type="button" onClick={()=>switchMode('forgot')} style={s.forgotLink}>Forgot password?</button>
                  )}
                </div>
                <input className="input" type="password" placeholder="Min 6 characters" value={form.password} onChange={e=>set('password',e.target.value)} required minLength={6} style={{marginTop:4}} />
              </div>
            )}

            {error && <div style={s.err}>⚠️ {error}</div>}
            {info && <div style={s.info}>{info}</div>}

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{width:'100%'}}>
              {btnLabel}
            </button>
          </form>

          {mode==='forgot' ? (
            <p style={s.sw}>
              Remembered it?{' '}
              <button onClick={()=>switchMode('login')} style={s.swBtn}>Back to log in</button>
            </p>
          ) : (
            <p style={s.sw}>
              {mode==='login'?"Don't have an account? ":"Already have an account? "}
              <button onClick={()=>switchMode(mode==='login'?'signup':'login')} style={s.swBtn}>
                {mode==='login'?'Sign up free':'Log in'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const s = {
  page:   {display:'flex',minHeight:'100vh',background:'#f5f7fa'},
  left:   {flex:'0 0 420px',background:'linear-gradient(160deg,#1c1417 0%,#3a1f20 60%,#1c1417 100%)',display:'flex',alignItems:'center',padding:'48px'},
  leftInner: {width:'100%'},
  logo:   {display:'flex',alignItems:'baseline',gap:2,marginBottom:8},
  logoTxt:{fontSize:26,fontWeight:900,letterSpacing:'-0.5px',color:'#fff'},
  logoDot:{fontSize:26,fontWeight:900,color:'#F5A623'},
  tagline:{fontSize:13,color:'#ffb3b3',marginBottom:36,fontWeight:500},
  feats:  {display:'flex',flexDirection:'column',gap:14,marginBottom:44},
  feat:   {display:'flex',alignItems:'center',gap:12},
  featIc: {width:34,height:34,background:'rgba(255,255,255,0.1)',borderRadius:9,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0},
  featTx: {fontSize:13,color:'#ffd6d6',fontWeight:500},
  url:    {fontSize:11,color:'#ff8a8a',letterSpacing:'0.1em',fontWeight:600,textTransform:'uppercase'},
  right:  {flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:32},
  box:    {width:'100%',maxWidth:400},
  title:  {fontSize:24,fontWeight:800,color:'#0f172a',marginBottom:6},
  sub:    {fontSize:13,color:'#64748b',marginBottom:28},
  form:   {display:'flex',flexDirection:'column',gap:14},
  err:    {padding:'9px 12px',background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:8,fontSize:13,color:'#9f1239'},
  info:   {padding:'9px 12px',background:'#ecfdf5',border:'1px solid #a7f3d0',borderRadius:8,fontSize:13,color:'#065f46'},
  sw:     {marginTop:22,fontSize:13,color:'#64748b',textAlign:'center'},
  swBtn:  {background:'none',border:'none',color:'#ff5e5f',fontWeight:700,cursor:'pointer',fontSize:13,fontFamily:'inherit'},
  forgotLink: {background:'none',border:'none',color:'#ff5e5f',fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:'inherit'},
};
