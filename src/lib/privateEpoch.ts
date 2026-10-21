/** Поколение приватного сеанса; старый callback не может записать новый кэш. */
export class PrivateEpoch {
 private value=0;
 private listeners=new Set<()=>void>();
 capture(){const value=this.value;return {value,current:()=>value===this.value};}
 invalidate(){this.value++;this.listeners.forEach(listener=>listener());}
 subscribe(listener:()=>void){this.listeners.add(listener);return()=>{this.listeners.delete(listener);};}
}
