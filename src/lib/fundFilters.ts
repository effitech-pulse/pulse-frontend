export interface FundFilters {search:string;sort:'id_asc'|'id_desc'|'name_asc'|'name_desc';ngdu?:number;department?:number}
/** Читаем только поддержанные поля сохранённого контекста; ноль — полноценный код. */
export function normalizeFundFilters(value:unknown):FundFilters{
 const raw=(typeof value==='object'&&value!==null?value:{}) as Record<string,unknown>;
 const sort=raw.sort==='id_desc'||raw.sort==='name_asc'||raw.sort==='name_desc'?raw.sort:'id_asc';
 return {search:typeof raw.search==='string'?Array.from(raw.search).slice(0,120).join(''):'',sort,...(Number.isSafeInteger(raw.ngdu)?{ngdu:raw.ngdu as number}:{}),...(Number.isSafeInteger(raw.department)?{department:raw.department as number}:{})};
}
