/** Локальная справка: только структурированный текст и статические маршруты. */
export interface HelpSection {heading:string; paragraphs?:string[]; steps?:string[]; bullets?:string[]; links?:{label:string;to:string}[]}
export interface HelpArticle {id:string;title:string;summary:string;keywords:string[];sections:HelpSection[]}
export interface HelpGuide {id:string;title:string;description:string;updatedAt:string;articles:HelpArticle[]}
export type HelpLocation = {kind:'index'} | {kind:'guide';guide:HelpGuide} | {kind:'article';guide:HelpGuide;article:HelpArticle} | {kind:'not-found'};
export function resolveHelp(guides:HelpGuide[],guideId?:string,articleId?:string):HelpLocation {
 if(!guideId)return {kind:'index'};
 const guide=guides.find(item=>item.id===guideId);
 if(!guide)return {kind:'not-found'};
 if(!articleId)return {kind:'guide',guide};
 const article=guide.articles.find(item=>item.id===articleId);
 return article?{kind:'article',guide,article}:{kind:'not-found'};
}
const normalize=(value:string)=>value.toLocaleLowerCase('ru').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
export function searchHelp(guides:HelpGuide[],query:string):{guide:HelpGuide;article:HelpArticle}[] {
 const terms=normalize(query).split(' ').filter(Boolean);
 if(!terms.length)return [];
 return guides.flatMap(guide=>guide.articles.flatMap(article=>{
  const text=normalize([guide.title,article.title,article.summary,...article.keywords,...article.sections.flatMap(section=>[section.heading,...section.paragraphs??[],...section.steps??[],...section.bullets??[],...section.links?.map(link=>link.label)??[]])].join(' '));
  return terms.every(term=>text.includes(term))?[{guide,article}]:[];
 }));
}
