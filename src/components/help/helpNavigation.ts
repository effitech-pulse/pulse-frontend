/** Показывает текущую ссылку прокруткой только локального оглавления, без сдвига страницы. */
export function revealHelpNavigation(scroller:HTMLElement|null,link:HTMLElement|null,viewportHeight=typeof window==='undefined'?Infinity:window.innerHeight):void {
 if(!scroller?.getBoundingClientRect||!link?.getBoundingClientRect)return;
 const bounds=scroller.getBoundingClientRect(),target=link.getBoundingClientRect();
 const top=Math.max(0,bounds.top),bottom=Math.min(bounds.bottom,viewportHeight);
 if(bottom<=top)return;
 if(target.top<top)scroller.scrollTop=Math.max(0,scroller.scrollTop+target.top-top);
 else if(target.bottom>bottom)scroller.scrollTop+=target.bottom-bottom;
}
