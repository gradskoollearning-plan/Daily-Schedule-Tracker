import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

export default function StudyTimer({ date, existingSeconds = 0, onUpdate }) {
  const { user }  = useAuth();
  const [secs, setSecs]       = useState(existingSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);
  const startRef    = useRef(null);

  useEffect(() => { setSecs(existingSeconds); }, [existingSeconds]);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now() - (secs * 1000);
      intervalRef.current = setInterval(() => {
        setSecs(Math.floor((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  async function toggleTimer() {
    if (running) {
      // Save to DB
      setRunning(false);
      const newSecs = secs;
      await supabase.from('daily_progress').upsert(
        { user_id: user.id, date, study_seconds: newSecs, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,date' }
      );
      onUpdate && onUpdate(newSecs);
    } else {
      setRunning(true);
    }
  }

  async function resetTimer() {
    setRunning(false);
    setSecs(0);
    await supabase.from('daily_progress').upsert(
      { user_id: user.id, date, study_seconds: 0, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    );
    onUpdate && onUpdate(0);
  }

  return (
    <div style={s.wrap}>
      <div style={s.timerRow}>
        <div className={`timer-display ${running ? 'running' : ''}`} style={{ fontSize: 32, padding: '8px 0' }}>
          {fmt(secs)}
        </div>
        <div style={s.timerBtns}>
          <button className={`btn ${running ? 'btn-danger' : 'btn-success'}`} onClick={toggleTimer}>
            {running ? '⏹ Stop' : '▶ Start'}
          </button>
          {!running && secs > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={resetTimer}>Reset</button>
          )}
        </div>
      </div>
      {secs > 0 && !running && (
        <p style={s.saved}>✓ {fmt(secs)} logged for today</p>
      )}
      {running && (
        <p style={{ fontSize:12, color:'var(--indigo)', textAlign:'center', marginTop:4 }}>
          Timer running… click Stop to save
        </p>
      )}
    </div>
  );
}

const s = {
  wrap: { display:'flex', flexDirection:'column', gap:6 },
  timerRow: { display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, flexWrap:'wrap' },
  timerBtns: { display:'flex', gap:8, alignItems:'center' },
  saved: { fontSize:12, color:'var(--emerald)', textAlign:'center' },
};
