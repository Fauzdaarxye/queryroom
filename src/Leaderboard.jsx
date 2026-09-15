import React, { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, ChevronLeft, ChevronRight, CircleCheck, Crown, LoaderCircle, RefreshCw, Search, ShieldCheck, Trophy, Users, X } from 'lucide-react';
import { difficultyPoints } from '../shared/leaderboard.mjs';
import { useLeaderboard } from './use-leaderboard.mjs';
import './leaderboard.css';

const number = value => value.toLocaleString();

export default function Leaderboard({ api, user, options, onChange, onBrowse, onSignIn }) {
  const { data, loading, error, retry } = useLeaderboard(api, { ...options, userId: user?.id });
  const tableRef = useRef(null), previousPage = useRef(options.page);
  useEffect(() => {
    if (data && data.page !== options.page) onChange({ page: data.page }, true);
  }, [data, options.page, onChange]);
  useEffect(() => {
    if (previousPage.current !== options.page) tableRef.current?.scrollIntoView({ block: 'start' });
    previousPage.current = options.page;
  }, [options.page]);
  const me = data?.currentUser;
  const pages = data ? Array.from({ length: data.pages }, (_, i) => i + 1).filter(n => n === 1 || n === data.pages || Math.abs(n - data.page) <= 1) : [];
  const pageButtons = [];
  pages.forEach((page, index) => {
    if (index && page - pages[index - 1] > 1) pageButtons.push(<span key={`gap-${page}`} className="page-ellipsis">…</span>);
    pageButtons.push(<button key={page} aria-label={`Page ${page}`} aria-current={page === data.page ? 'page' : undefined} onClick={() => onChange({ page })}>{page}</button>);
  });
  return <main className="leaderboard-page"><div className="leaderboard-inner">
    <header className="overview-heading"><div><div className="overview-kicker">THE QUERYROOM COMMUNITY</div><h1>Leaderboard</h1><p>Keep learning. Solve a challenge. Make your way up.</p></div><button className="primary-button" onClick={onBrowse}><BookOpen size={17}/>Find a question<ArrowRight size={16}/></button></header>
    <section className="standings-summary" aria-label="Your leaderboard overview">
      <div className="standing-stat"><span><Trophy size={17}/>Your rank</span><strong>{me ? `#${number(me.rank)}` : '—'}</strong><small>{user ? me ? `Among ${number(data.totalUsers)} ${data.totalUsers === 1 ? 'learner' : 'learners'}` : 'Your standing will appear here' : 'Sign in to join the rankings'}</small></div>
      <div className="standing-stat"><span><Crown size={17}/>Your points</span><strong>{me ? number(me.points) : '—'}</strong><small>{me ? `${number(me.solved)} verified ${me.solved === 1 ? 'solution' : 'solutions'}` : 'Earn points with accepted solutions'}</small></div>
      <div className="standing-stat"><span><Users size={17}/>Registered learners</span><strong>{data ? number(data.totalUsers) : '—'}</strong><small>One community. Plenty to learn.</small></div>
      <div className="scoring-card"><span><ShieldCheck size={17}/>Every challenge counts</span><div>{Object.entries(difficultyPoints).map(([level, points]) => <span key={level}><i className={`level-dot ${level.toLowerCase()}`}/>{level}<strong>+{points}</strong></span>)}</div><small>Points once per question. Equal scores share a rank.</small></div>
    </section>
    {!user && <aside className="leaderboard-guest"><span><strong>A place on the board is waiting.</strong> Practise freely, or sign in to earn points and save your progress.</span><button className="secondary-button" onClick={onSignIn}>Continue with Google<ArrowRight size={15}/></button></aside>}
    <section ref={tableRef} className="standings-panel" aria-label="All-time rankings" aria-busy={loading}>
      <header className="standings-heading"><div><Trophy size={19}/><h2>All-time rankings</h2><span className="standings-live">{data ? `${number(data.totalUsers)} ${data.totalUsers === 1 ? 'learner' : 'learners'}` : 'Loading'}</span></div><button className="standings-refresh" aria-label="Refresh leaderboard" disabled={loading} onClick={retry}><RefreshCw size={15} className={loading ? 'spin' : ''}/><span>Refresh</span></button></header>
      <div className="standings-controls"><label className="dashboard-search"><Search size={17}/><input aria-label="Search leaderboard by username" maxLength={24} placeholder="Search by username" value={options.search} onChange={e => onChange({ search: e.target.value, page: 1 })}/>{options.search && <button aria-label="Clear username search" onClick={() => onChange({ search: '', page: 1 })}><X size={15}/></button>}</label>{me && <button className="secondary-button" onClick={() => onChange({ search: me.username, page: 1 })}>Find my position<ArrowRight size={14}/></button>}<span>{options.search && data ? `${number(data.totalResults)} matching ${data.totalResults === 1 ? 'learner' : 'learners'}` : 'Ranked by verified points'}</span></div>
      {error && <div className="standings-error" role="alert"><span>{error}</span><button onClick={retry}>Try again</button></div>}
      {!data && loading ? <div className="standings-empty" role="status"><LoaderCircle className="spin" size={25}/><h2>Loading the leaderboard…</h2></div> : data && <>
        <div className="standings-table-wrap"><table className="standings-table"><thead><tr><th>Rank</th><th>Learner</th><th>Points</th><th className="standings-total">Solved</th><th className="standings-difficulty">Easy</th><th className="standings-difficulty">Medium</th><th className="standings-difficulty">Hard</th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.username} className={entry.isYou ? 'your-standing' : ''} aria-label={entry.isYou ? `Your ranking: ${entry.rank}` : undefined}><td><span className={`standing-rank rank-${entry.rank <= 3 && entry.points > 0 ? entry.rank : 'other'}`}>{entry.rank <= 3 && entry.points > 0 && <Trophy size={15}/>}<span>{number(entry.rank)}</span></span></td><td><div className="standing-learner"><span className="standing-avatar">{entry.username.slice(0, 1).toUpperCase()}</span><div><strong>@{entry.username}</strong>{entry.isYou && <span className="standing-you">You</span>}<small className="standing-mobile-breakdown">{entry.solved} solved · E {entry.easy} / M {entry.medium} / H {entry.hard}</small></div></div></td><td className="standing-points">{number(entry.points)}</td><td className="standings-total">{number(entry.solved)}</td><td className="standings-difficulty">{entry.easy}</td><td className="standings-difficulty">{entry.medium}</td><td className="standings-difficulty">{entry.hard}</td></tr>)}</tbody></table></div>
        {!data.entries.length && <div className="standings-empty"><Search size={27}/><h2>{options.search ? 'No learners found' : 'Be the first on the board'}</h2><p>{options.search ? 'Try another username. Rankings stay global when you search.' : 'Create your profile and submit an accepted solution to start earning points.'}</p>{options.search && <button className="secondary-button" onClick={() => onChange({ search: '', page: 1 })}>Show all learners</button>}</div>}
        <footer className="library-pagination standings-pagination"><span aria-live="polite">Showing <strong>{data.totalResults ? (data.page - 1) * data.pageSize + 1 : 0}–{Math.min(data.page * data.pageSize, data.totalResults)}</strong> of <strong>{number(data.totalResults)}</strong></span><nav aria-label="Leaderboard pages"><button aria-label="Previous leaderboard page" disabled={data.page === 1 || loading} onClick={() => onChange({ page: data.page - 1 })}><ChevronLeft size={17}/></button>{pageButtons}<button aria-label="Next leaderboard page" disabled={data.page === data.pages || loading} onClick={() => onChange({ page: data.page + 1 })}><ChevronRight size={17}/></button></nav></footer>
      </>}
    </section>
    <footer className="standings-rules"><ShieldCheck size={17}/><p><strong>Earn your place, one solution at a time.</strong> Only accepted submissions checked against every test earn points. Manual solved marks, failed attempts, and repeat solutions don’t change your score.</p><span><CircleCheck size={14}/>Updates automatically</span></footer>
  </div></main>;
}
