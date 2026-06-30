import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function ResetPassword({ onDone }) {
  const { updatePassword } = useAuth();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);
  const [loading, setLoading]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <div style={s.page}>
      <div style={s.box} className="fade-in">
        <div style={s.logo}><span style={s.logoTxt}>GRADSKOOL</span><span style={s.logoDot}>.</span></div>

        {done ? (
          <>
            <h2 style={s.title}>Password updated ✅</h2>
            <p style={s.sub}>You're all set. Continue to your tracker.</p>
            <button className="btn btn-primary btn-lg" style={{width:'100%'}} onClick={onDone}>
              Continue →
            </button>
          </>
        ) : (
          <>
            <h2 style={s.title}>Set a new password</h2>
            <p style={s.sub}>Choose a new password for your account.</p>
            <form onSubmit={handleSubmit} style={s.form}>
              <div>
                <label className="label">New Password</label>
                <input className="input" type="password" placeholder="Min 6 characters"
                  value={password} onChange={e=>setPassword(e.target.value)} required minLength={6} />
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input className="input" type="password" placeholder="Re-enter password"
                  value={confirm} onChange={e=>setConfirm(e.target.value)} required minLength={6} />
              </div>
              {error && <div style={s.err}>⚠️ {error}</div>}
              <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{width:'100%'}}>
                {loading ? '…' : 'Update Password →'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const s = {
  page:  {display:'flex',minHeight:'100vh',background:'#f5f7fa',alignItems:'center',justifyContent:'center',padding:32},
  box:   {width:'100%',maxWidth:400,background:'#fff',border:'1px solid #e2e8f0',borderRadius:16,padding:32,boxShadow:'0 4px 14px rgba(15,23,42,0.08)'},
  logo:  {display:'flex',alignItems:'baseline',gap:2,marginBottom:20},
  logoTxt:{fontSize:22,fontWeight:900,letterSpacing:'-0.5px',color:'#1e1b4b'},
  logoDot:{fontSize:22,fontWeight:900,color:'#F5A623'},
  title: {fontSize:22,fontWeight:800,color:'#0f172a',marginBottom:6},
  sub:   {fontSize:13,color:'#64748b',marginBottom:24},
  form:  {display:'flex',flexDirection:'column',gap:14},
  err:   {padding:'9px 12px',background:'#fff1f2',border:'1px solid #fecdd3',borderRadius:8,fontSize:13,color:'#9f1239'},
};
