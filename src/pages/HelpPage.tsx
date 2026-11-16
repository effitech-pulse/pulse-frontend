import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Input,type InputRef} from 'antd';
import {BulbOutlined,MoonOutlined} from '@ant-design/icons';
import {Link,useLocation,useOutletContext,useParams} from 'react-router-dom';
import {useAuth} from '@/auth/AuthProvider';
import {routeAccess} from '@/auth/authorization';
import {useTheme} from '@/theme/ThemeProvider';
import {revealHelpNavigation} from '@/components/help/helpNavigation';
import {resolveHelp,searchHelp,type HelpGuide} from '@/lib/help';
import userGuide from '@/content/help/user-guide.json';
import businessGuide from '@/content/help/business-guide.json';
import '@/styles/help.css';

const guides:HelpGuide[]=[userGuide,businessGuide];
const articlePath=(guideId:string,articleId:string)=>`/help/${guideId}/${articleId}`;
export interface HelpHostContext {helpRouteEnabled?:(path:string)=>boolean;helpActions?:ReactNode}

export function HelpPage(){
 const {guideId,articleId,'*':unknownPath}=useParams();
 const location=useLocation(),{principal}=useAuth(),{dark,toggle}=useTheme();
 const host=useOutletContext<HelpHostContext|undefined>();
 const [query,setQuery]=useState(''),[copyStatus,setCopyStatus]=useState('');
 const heading=useRef<HTMLHeadingElement>(null),searchInput=useRef<InputRef>(null);
 const sidebar=useRef<HTMLElement>(null),currentNav=useRef<HTMLAnchorElement>(null),revealedPath=useRef<string>();
 const resolved=unknownPath?{kind:'not-found' as const}:resolveHelp(guides,guideId,articleId);
 // Entry routes display the existing introduction without changing the URL or resolver.
 const guide=resolved.kind==='article'||resolved.kind==='guide'?resolved.guide:resolved.kind==='index'?guides[0]:undefined;
 const article=resolved.kind==='article'?resolved.article:guide?.articles[0];
 const searching=query.trim().length>0,results=searching?searchHelp(guides,query):[];
 const matches=new Set(results.map(result=>articlePath(result.guide.id,result.article.id)));
 useEffect(()=>{setQuery('');setCopyStatus('');heading.current?.focus();},[location.pathname]);
 useEffect(()=>{
  if(!searching&&revealedPath.current!==location.pathname){revealHelpNavigation(sidebar.current,currentNav.current);revealedPath.current=location.pathname;}
 },[location.pathname,searching]);
 const linkAllowed=(to:string)=>/^\/help(?:\/|$)/.test(to)||(host?.helpRouteEnabled?.(to)===true&&routeAccess(principal,to));
 const clearSearch=()=>setQuery('');
 const clearInput=()=>{clearSearch();searchInput.current?.focus();};
 const copyLink=async()=>{
  if(!guide||!article)return;
  try{await navigator.clipboard.writeText(new URL(articlePath(guide.id,article.id),window.location.origin).href);setCopyStatus('Ссылка скопирована');}
  catch{setCopyStatus('Не удалось скопировать. Скопируйте адрес статьи из строки браузера.');}
 };
 return <div className="help-docs">
  <a className="help-docs-skip" href="#help-main">К содержимому</a>
  <header className="help-docs-header">
   <Link className="help-docs-brand" to="/help" onClick={clearSearch}>
    <img src="/figma/pulse-symbol.svg" alt=""/>
    <span><strong>Пульс скважины</strong><small>Справка и руководства</small></span>
   </Link>
   <div className="help-docs-header-actions">
    <Link className="help-docs-return" to="/">В приложение</Link>
    <button type="button" className="help-docs-theme" aria-label="Переключить тему" title={dark?'Светлая тема':'Тёмная тема'} onClick={toggle}>{dark?<BulbOutlined/>:<MoonOutlined/>}</button>
    {host?.helpActions}
   </div>
  </header>
  <div className="help-docs-layout">
   <aside ref={sidebar} className="help-docs-sidebar" aria-label="Навигация по справке">
    <label htmlFor="help-search">Поиск по содержимому</label>
    <div className="help-docs-search-controls">
     <Input ref={searchInput} id="help-search" type="search" autoComplete="off" value={query} placeholder="Например: пилот, тревога" onChange={event=>setQuery(event.target.value)}/>
     {query?<button type="button" className="help-docs-clear" aria-label="Очистить поиск" onClick={clearInput}>Очистить</button>:null}
    </div>
    <p className="help-docs-search-status" role="status" aria-live="polite">{searching?`Найдено статей: ${results.length}`:'Все статьи'}</p>
    {guides.map(item=><div className="help-docs-nav-group" key={item.id}>
     <h2>{item.title}</h2>
     <nav aria-label={item.title}>{item.articles.filter(entry=>!searching||matches.has(articlePath(item.id,entry.id))).map(entry=><Link key={entry.id} ref={guide?.id===item.id&&article?.id===entry.id?currentNav:undefined} to={articlePath(item.id,entry.id)} onClick={clearSearch} aria-current={guide?.id===item.id&&article?.id===entry.id?'page':undefined}>{entry.title}</Link>)}</nav>
    </div>)}
   </aside>
   <main id="help-main" className="help-docs-main" tabIndex={-1}>
    {searching?<article className="help-docs-article">
     <h1 ref={heading} tabIndex={-1}>Результаты поиска</h1>
     {results.length?<ul className="help-docs-results">{results.map(({guide:resultGuide,article:resultArticle})=><li key={`${resultGuide.id}/${resultArticle.id}`}>
      <Link to={articlePath(resultGuide.id,resultArticle.id)} onClick={clearSearch}>{resultArticle.title}</Link>
      <p>{resultArticle.summary}</p><small>{resultGuide.title}</small>
     </li>)}</ul>:<><h2>Ничего не найдено</h2><p>Попробуйте другое слово или очистите поиск.</p><button type="button" className="help-docs-text-action" onClick={clearInput}>Очистить поиск</button></>}
    </article>:!guide||!article?<article className="help-docs-article">
     <h1 ref={heading} tabIndex={-1}>Статья не найдена</h1><p>Проверьте адрес или выберите статью в справке.</p><Link to="/help">Открыть справку</Link>
    </article>:<>
     <article className="help-docs-article">
      <h1 ref={heading} tabIndex={-1}>{article.title}</h1>
      <p>{article.summary}</p>
      <button type="button" className="help-docs-text-action" aria-label="Скопировать ссылку на статью" onClick={()=>void copyLink()}>Скопировать ссылку</button>
      <p role="status" className="help-docs-copy-status">{copyStatus}</p>
      {article.sections.map((section,index)=><section key={index}>
       <h2>{section.heading}</h2>
       {section.paragraphs?.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
       {section.steps?<ol>{section.steps.map((step,i)=><li key={i}>{step}</li>)}</ol>:null}
       {section.bullets?<ul>{section.bullets.map((bullet,i)=><li key={i}>{bullet}</li>)}</ul>:null}
       {section.links?.filter(link=>linkAllowed(link.to)).map(link=><p key={link.to}><Link to={link.to} onClick={clearSearch}>{link.label}</Link></p>)}
      </section>)}
     </article>
     <footer className="help-docs-footer">{guide.title} · редакция <time dateTime={guide.updatedAt}>{new Date(`${guide.updatedAt}T00:00:00Z`).toLocaleDateString('ru-RU',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'})}</time></footer>
    </>}
   </main>
  </div>
 </div>;
}
