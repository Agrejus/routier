import { useEffect, useState } from 'react';
import type { Article } from '../schemas';
import { useLive } from '../hooks';
import { useStore } from '../StoreContext';

export function Knowledge() {
  const { store, backend } = useStore();
  const live = useLive<Article[]>(cb => store.articles.subscribe().where(x => x.published === true).sortDescending(x => x.helpful).toArray(cb as never) as never, [store]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Article[] | null>(null);
  const [mode, setMode] = useState<'text' | 'similar'>('text');
  const [error, setError] = useState('');
  const all = live.status === 'success' ? live.data : [];

  useEffect(() => { if (!query.trim()) setResults(null); }, [query]);
  const search = async () => {
    setError('');
    try {
      if (mode === 'similar') setResults(await store.articles.where(x => x.published === true).nearest(x => x.embedding, [0.82, 0.15, 0.28, 0.18], 4).toArrayAsync());
      else setResults(query.trim() ? await store.articles.search(query, { match: 'any' }).take(12).toArrayAsync() : null);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };
  const helpful = async (article: Article) => { store.articles.update(article, current => ({ ...current, helpful: current.helpful + 1, updatedAt: new Date() })); await store.saveChangesAsync(); };
  const rows = results ?? all;

  return <section className="page knowledge-page" data-testid="knowledge-page"><div className="knowledge-hero"><span className="eyebrow">Team knowledge</span><h1>Find the answer, then fix it.</h1><p>Full-text and vector queries run through the active <b>{backend}</b> plugin.</p><div className="knowledge-search"><input aria-label="Search knowledge" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') search(); }} placeholder="Try “packet loss” or “certificate”…" /><select value={mode} onChange={e => setMode(e.target.value as 'text' | 'similar')}><option value="text">Full-text</option><option value="similar">Vector similarity</option></select><button onClick={search}>Search</button></div>{error && <div className="error-banner">{error}</div>}</div>
    <div className="article-grid">{rows.map(article => <article className="article-card" key={article.id}><span className="article-category">{article.category}</span><h2>{article.title}</h2><p>{article.body}</p><footer><span>Updated {new Date(article.updatedAt).toLocaleDateString()}</span><button onClick={() => helpful(article)}>♡ {article.helpful}</button></footer></article>)}</div>
  </section>;
}
