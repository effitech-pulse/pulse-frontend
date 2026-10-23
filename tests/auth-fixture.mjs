import {can,canAny,canFull} from '../src/auth/authorization.ts';
/** Auth boundary for existing product tests exercising frozen compatibility. */
export function legacyAuth(role='viewer') {
 const principal={account_id:11,name:'Test',role,scope:{funds:['operational','presentation'],ngdus:null,departments:null},authenticated:true,mechanism:'local'};
 return {mode:'local',principal,can:(...keys)=>can(principal,...keys),canAny:(...alternatives)=>canAny(principal,...alternatives),canFull:(...keys)=>canFull(principal,...keys),capturePrivate:()=>({value:0,current:()=>true}),privateEpoch:0,privateBlocked:false};
}
