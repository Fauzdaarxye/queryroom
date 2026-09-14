import React from 'react';
import ProblemTextControls from './ProblemTextControls.jsx';
import { ArrowUpRight, Circle, CircleCheck, Database, Play, ShieldCheck, Star } from 'lucide-react';

export default function PlaylistDescription({ problem, progress, onBookmark, fontSize, onFontSize }) {
  return <div className="description-content playlist-description">
    <div className="problem-eyebrow"><span>DATABASE</span><span className="eyebrow-dot">/</span><span>#{problem.number}</span><ProblemTextControls value={fontSize} onChange={onFontSize}/><button className={`bookmark ${progress.bookmarked ? 'is-bookmarked' : ''}`} onClick={onBookmark} aria-label={progress.bookmarked ? 'Remove bookmark' : 'Bookmark question'}><Star size={17} fill={progress.bookmarked ? 'currentColor' : 'none'}/></button></div>
    <h1>{problem.title}</h1>
    <div className="problem-badges"><span className={`badge ${problem.difficulty.toLowerCase()}`}>{problem.difficulty}</span><span className="badge tag"><Database size={12}/> SQL</span><span className={`problem-status ${progress.solved ? 'solved' : ''}`}>{progress.solved ? <CircleCheck size={14}/> : <Circle size={13}/>} {progress.solved ? 'Solved' : 'Unsolved'}</span></div>
    {problem.playlist && <div className="playlist-context"><Play size={12}/><span>{problem.playlist}</span><span>Lesson {problem.videos.map(v=>v.playlistIndex).join(' & ')}</span></div>}
    <div className="result-contract"><span>{problem.schema.length} {problem.schema.length===1?'table':'tables'}</span><span>{problem.orderMatters ? 'Follow the specified result order' : 'Results may be in any order'}</span></div>
    <div className="imported-statement" dangerouslySetInnerHTML={{__html:problem.statementHtml}}/>
    {problem.videos?.length > 0 && <details className="video-reference"><summary><Play size={14}/> Video walkthrough{problem.videos.length>1?'s':''} <span>Includes the solution</span></summary><p>Open the lesson when you’re ready to review an explanation.</p>{problem.videos.map(v=><a key={v.videoId} href={v.url} target="_blank" rel="noreferrer">Watch lesson {v.playlistIndex} on YouTube <ArrowUpRight size={13}/></a>)}</details>}
    <div className="practice-note"><ShieldCheck size={17}/><p>{problem.testNotes} Test data uses ISO dates such as 2020-01-13 in the test tables.</p></div>
    <div className="problem-source-links"><a className="source-link" href={problem.source} target="_blank" rel="noreferrer">Original question <ArrowUpRight size={13}/></a>{problem.playlistUrl && <a className="source-link" href={problem.playlistUrl} target="_blank" rel="noreferrer">YouTube playlist <ArrowUpRight size={13}/></a>}</div>
  </div>;
}
