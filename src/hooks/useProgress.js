import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { SCHEDULE } from '../lib/schedule';

export function useProgress() {
  const { user } = useAuth();
  const [progress, setProgress] = useState({});
  const [scores, setScores]     = useState([]);
  const [loading, setLoading]   = useState(true);

  const today = new Date().toISOString().split('T')[0];

  const load = useCallback(async () => {
    if (!user) return;
    const [{ data: pr }, { data: sc }] = await Promise.all([
      supabase.from('daily_progress').select('*').eq('user_id', user.id),
      supabase.from('test_scores').select('*').eq('user_id', user.id).order('date'),
    ]);
    const map = {};
    (pr || []).forEach(r => { map[r.date] = r; });
    setProgress(map);
    setScores(sc || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function upsertProgress(date, patch) {
    const existing = progress[date] || {};
    const merged = { ...existing, ...patch, user_id: user.id, date, updated_at: new Date().toISOString() };
    setProgress(p => ({ ...p, [date]: merged }));
    await supabase.from('daily_progress').upsert(merged, { onConflict: 'user_id,date' });
  }

  // Backlogs: past days not done and not cleared
  const backlogs = SCHEDULE.filter(d => {
    if (d.date >= today) return false;
    const p = progress[d.date];
    if (!p) return true;
    return !p.task_done && !p.backlog_cleared;
  });

  // Stats
  const elapsed        = SCHEDULE.filter(d => d.date <= today).length;
  const daysCompleted  = SCHEDULE.filter(d => progress[d.date]?.task_done).length;
  const mocks          = scores.filter(s => s.test_type === 'mock');
  const avgPercentile  = mocks.length ? Math.round(mocks.reduce((a,s)=>a+(s.percentile||0),0)/mocks.length) : 0;
  const bestPercentile = mocks.length ? Math.max(...mocks.map(s=>s.percentile||0)) : 0;

  // Streak
  let streak = 0;
  const pastSorted = [...SCHEDULE].filter(d => d.date <= today).sort((a,b)=>b.date.localeCompare(a.date));
  for (const d of pastSorted) {
    if (progress[d.date]?.task_done) streak++;
    else break;
  }

  // Weak section
  let weakSection = null;
  if (mocks.length >= 2) {
    const avg = {
      VARC: mocks.reduce((a,s)=>a+(s.varc_score||0),0)/mocks.length,
      DILR: mocks.reduce((a,s)=>a+(s.dilr_score||0),0)/mocks.length,
      QA:   mocks.reduce((a,s)=>a+(s.qa_score||0),0)/mocks.length,
    };
    weakSection = Object.entries(avg).sort((a,b)=>a[1]-b[1])[0][0];
  }

  return {
    progress, scores, loading, backlogs, elapsed,
    daysCompleted, mocks, avgPercentile, bestPercentile,
    streak, weakSection, reload: load, upsertProgress,
  };
}
