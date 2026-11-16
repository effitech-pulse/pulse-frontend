import {Component,Suspense,lazy,type ReactNode} from 'react';
import '../../styles/help.css';
const HelpPage=lazy(()=>import('../../pages/HelpPage').then(module=>({default:module.HelpPage})));
/** Ошибка загрузки статического чанка не подменяется ошибкой бизнес-API. */
export class HelpErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<section className="help-page help-empty"><h1>Не удалось открыть справку</h1><p>Обновите страницу и попробуйте снова.</p><button type="button" className="help-action" onClick={()=>window.location.reload()}>Обновить страницу</button></section>:this.props.children;}
}
export function HelpRoute(){return <HelpErrorBoundary><Suspense fallback={<section className="help-page help-empty" role="status"><h2>Загрузка справки…</h2><div className="help-skeleton" aria-hidden="true"><span/><span/><span/></div></section>}><HelpPage/></Suspense></HelpErrorBoundary>;}
