import { createContext, useContext, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { normalizeFundFilters, type FundFilters } from '@/lib/fundFilters';
interface FilterContext {filters:FundFilters;setFilters:(patch:Partial<FundFilters>)=>void;reset:()=>void}
const Context=createContext<FilterContext>({filters:{search:'',sort:'id_asc'},setFilters:()=>{},reset:()=>{}});
export const useFundFilters=()=>useContext(Context);
export function FundFiltersProvider({children}:{children:ReactNode}){
 const {principal}=useAuth();const key=`pulse-filters:${principal?.account_id??'shared'}:connector`;
 const [states,setStates]=useState<Record<string,FundFilters>>({});
 let filters=states[key];if(!filters){try{filters=normalizeFundFilters(JSON.parse(localStorage.getItem(key)??'{}'));}catch{filters=normalizeFundFilters({});}}
 function setFilters(patch:Partial<FundFilters>){const next=normalizeFundFilters({...filters,...patch});setStates(s=>({...s,[key]:next}));try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Выбор сохраняется до закрытия страницы. */}}
 return <Context.Provider value={{filters,setFilters,reset:()=>setFilters({search:'',sort:'id_asc',ngdu:undefined,department:undefined})}}>{children}</Context.Provider>;
}
