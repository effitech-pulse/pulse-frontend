/** Поколение приватного сеанса; старый callback не может записать новый кэш. */
export class PrivateEpoch {
 private value=0;
 private listeners=new Set<()=>void>();
 capture(){const value=this.value;return {value,current:()=>value===this.value};}
 invalidate(){this.value++;this.listeners.forEach(listener=>listener());}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
}

/** Display metadata and the global graph are not a private-session identity. */
export function privateBoundary(state:import('../api/access').AuthState):string {
 const p=state.principal;
 if(!p)return JSON.stringify([state.mode,null]);
 if(p.access_model==='rbac_v1')return JSON.stringify([state.mode,p.access_model,p.access_id,p.authz_epoch,p.authenticated]);
 return JSON.stringify([state.mode,p.access_model??'absent',p.account_id,p.authenticated,p.role,p.scope]);
}
