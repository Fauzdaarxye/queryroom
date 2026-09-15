export function hasQuestionWork(problem, saved = {}) {
  return Boolean(saved.submissions?.length || saved.notes?.trim()
    || (saved.draft?.trim() && saved.draft.trim() !== (problem.starter || '').trim()));
}

export function filterQuestions(problems, progress, { search = '', difficulty = 'all', status = 'all', bookmarked = false } = {}) {
  const needle = search.trim().toLowerCase();
  return problems.filter(problem => `${problem.title} ${problem.number}`.toLowerCase().includes(needle)
    && (difficulty === 'all' || problem.difficulty.toLowerCase() === difficulty)
    && (status === 'all' || (status === 'in-progress'
      ? !progress[problem.slug]?.solved && hasQuestionWork(problem, progress[problem.slug])
      : Boolean(progress[problem.slug]?.solved) === (status === 'solved')))
    && (!bookmarked || progress[problem.slug]?.bookmarked));
}

export const defaultLibraryOptions = {search:'', difficulty:'all', status:'all', bookmarked:false, sort:'recommended', page:1, pageSize:8};
export function readLibraryOptions(search) {
  const params = new URLSearchParams(search);
  const allowed = (key, values, fallback) => values.includes(params.get(key)) ? params.get(key) : fallback;
  const page = Number(params.get('page'));
  return {search:(params.get('q') || '').slice(0,200), difficulty:allowed('difficulty',['all','easy','medium','hard'],'all'),
    status:allowed('status',['all','solved','unsolved','in-progress'],'all'), bookmarked:params.get('saved')==='1',
    sort:allowed('sort',['recommended','number','title','difficulty'],'recommended'),
    page:Number.isSafeInteger(page) && page>0 ? Math.min(page,100000) : 1,
    pageSize:[8,16,24].includes(Number(params.get('size'))) ? Number(params.get('size')) : 8};
}
export function libraryQuery(options) {
  const params = new URLSearchParams();
  if (options.search) params.set('q',options.search);
  if (options.difficulty!=='all') params.set('difficulty',options.difficulty);
  if (options.status!=='all') params.set('status',options.status);
  if (options.bookmarked) params.set('saved','1');
  if (options.sort!=='recommended') params.set('sort',options.sort);
  if (options.page>1) params.set('page',String(options.page));
  if (options.pageSize!==8) params.set('size',String(options.pageSize));
  return params.size ? `?${params}` : '';
}
export function questionPage(problems, progress, options = defaultLibraryOptions) {
  const filtered = filterQuestions(problems, progress, options);
  const rank = {Easy:0,Medium:1,Hard:2};
  if (options.sort === 'title') filtered.sort((a,b)=>a.title.localeCompare(b.title));
  else if (options.sort === 'number') filtered.sort((a,b)=>a.number-b.number);
  else if (options.sort === 'difficulty') filtered.sort((a,b)=>rank[a.difficulty]-rank[b.difficulty] || a.number-b.number);
  else filtered.sort((a,b)=>rank[a.difficulty]-rank[b.difficulty]);
  const pageSize = [8,16,24].includes(options.pageSize) ? options.pageSize : 8;
  const pages = Math.max(1,Math.ceil(filtered.length/pageSize));
  const page = Math.min(pages,Math.max(1,Math.floor(Number(options.page)||1)));
  const start = (page-1)*pageSize;
  return {items:filtered.slice(start,start+pageSize), page, pages, total:filtered.length, start:filtered.length ? start+1 : 0, end:Math.min(start+pageSize,filtered.length)};
}

export function practiceOverview(problems, progress, currentSlug) {
  const solved = problems.filter(p=>progress[p.slug]?.solved);
  const inProgress = problems.filter(p=>!progress[p.slug]?.solved && hasQuestionWork(p,progress[p.slug]));
  const bookmarked = problems.filter(p=>progress[p.slug]?.bookmarked);
  const history = problems.flatMap(p=>(progress[p.slug]?.submissions || []).map(submission=>({...submission,problem:p})))
    .sort((a,b)=>new Date(b.date)-new Date(a.date));
  const latest = history.find(s=>inProgress.some(p=>p.slug===s.problem.slug));
  const next = inProgress.find(p=>p.slug===currentSlug) || latest?.problem || inProgress[0]
    || [...problems].sort((a,b)=>({Easy:0,Medium:1,Hard:2}[a.difficulty]-{Easy:0,Medium:1,Hard:2}[b.difficulty])).find(p=>!progress[p.slug]?.solved)
    || problems.find(p=>p.slug===currentSlug) || problems[0];
  return {solved, inProgress, bookmarked, history, next, resuming:inProgress.includes(next), completed:solved.length===problems.length};
}
