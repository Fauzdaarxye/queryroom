import type { ApiClient, LeaderboardData } from './types';
import { useEffect, useState } from 'react';
import { leaderboardQuery } from '../shared/leaderboard.mjs';

export function useLeaderboard(api: ApiClient, { search = '', page = 1, userId = null }: {search?: string; page?: number; userId?: string | null} = {}) {
  const requestKey = JSON.stringify([search, page, userId]);
  const [snapshot, setSnapshot] = useState<{key: string; data: LeaderboardData} | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let disposed = false, pending = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (pending || disposed) return;
      pending = true;
      setLoading(true);
      try {
        const result = await api<LeaderboardData>('/api/leaderboard' + leaderboardQuery({ search, page }), { signal: controller.signal });
        if (!disposed) { setSnapshot({ key: requestKey, data: result }); setError(''); }
      } catch (e: any) { if (!disposed) setError(e.message || 'Could not load the leaderboard.'); }
      finally { pending = false; if (!disposed) setLoading(false); }
    };
    setSnapshot(null);
    setError('');
    setLoading(true);
    const timeout = setTimeout(refresh, search ? 200 : 0);
    const interval = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { disposed = true; controller.abort(); clearTimeout(timeout); clearInterval(interval); window.removeEventListener('focus', refresh); };
  }, [api, search, page, userId, revision]);
  const data = snapshot?.key === requestKey ? snapshot.data : null;
  return { data, error, loading: loading || (!data && !error), retry: () => setRevision(n => n + 1) };
}
