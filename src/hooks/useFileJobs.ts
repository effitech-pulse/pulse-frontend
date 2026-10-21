import {useCallback, useEffect, useRef, useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import axios from 'axios';
import {useAuth} from '@/auth/AuthProvider';
import {fileJobsApi, type FileJobStatus} from '@/api/fileJobs';
import {fileJobErrorCopy, jobTerminal, pollDelay, canAdvanceFileJobStatus} from '@/lib/fileJobs';
import {toApiError} from '@/api/client';

export function usePrivateFileRequest(){
 const {capturePrivate,denyPrivate}=useAuth();const controllers=useRef(new Set<AbortController>());
 useEffect(()=>()=>{controllers.current.forEach(c=>c.abort());controllers.current.clear();},[]);
 return async <T,>(work:(signal:AbortSignal)=>Promise<T>,externalSignal?:AbortSignal):Promise<T>=>{
  const ticket=capturePrivate();const controller=new AbortController();controllers.current.add(controller);
  const signal=externalSignal?AbortSignal.any([controller.signal,externalSignal]):controller.signal;
  try{const value=await work(signal);if(!ticket.current()||signal.aborted)throw new DOMException('Old session','AbortError');return value;}
  catch(error){if(ticket.current()&&!signal.aborted&&axios.isAxiosError(error)&&[401,403,404].includes(error.response?.status??0))denyPrivate();throw error;}
  finally{controllers.current.delete(controller);}
 };
}
export function useFileCapabilities(){
 const auth=useAuth();const request=usePrivateFileRequest();const eligible=auth.mode==='local'&&auth.canOperate&&!auth.privateBlocked;
 const query=useQuery({queryKey:['file-capabilities',auth.privateEpoch],enabled:eligible,retry:false,staleTime:0,refetchOnWindowFocus:false,queryFn:({signal})=>request(s=>fileJobsApi.capabilities(s),signal)});
 useEffect(()=>{if(!eligible)return;const refresh=async()=>{if(document.visibilityState==='hidden')return;const ticket=auth.capturePrivate();await auth.refreshSession();if(ticket.current())void query.refetch();};window.addEventListener('focus',refresh);window.addEventListener('online',refresh);return()=>{window.removeEventListener('focus',refresh);window.removeEventListener('online',refresh);};},[eligible,auth.privateEpoch]);
 return {...query,enabled:eligible&&!query.isError&&query.data?.enabled===true&&query.data.mode==='synthetic'};
}
export function fileProblem(error:unknown){const problem=toApiError(error);return {message:fileJobErrorCopy(problem.message),http_request_id:problem.http_request_id};}
export function useFileJobStatus(well:string,job:string|undefined,initial?:FileJobStatus){
 const auth=useAuth();const request=usePrivateFileRequest();const requestRef=useRef(request);requestRef.current=request;
 const [status,setStatus]=useState<FileJobStatus|undefined>(initial);const [error,setError]=useState<ReturnType<typeof fileProblem>>();const [refresh,setRefresh]=useState(0);
 const reload=useCallback(()=>setRefresh(v=>v+1),[]);
 const snapshot=useRef<{scope:string;status?:FileJobStatus;started:number}>({scope:'',started:Date.now()});
 useEffect(()=>{
  if(!job||auth.privateBlocked||!auth.canOperate)return;
  const scope=JSON.stringify([auth.privateEpoch,well,job]);
  if(snapshot.current.scope!==scope){snapshot.current={scope,status:initial,started:Date.now()};setStatus(initial);setError(undefined);}
  let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,active:AbortController|undefined;
  let sequence=0,wakeSequence=0,failures=0;
  const isVisible=()=>document.visibilityState!=='hidden';
  const clearTimer=()=>{if(timer!==undefined){clearTimeout(timer);timer=undefined;}};
  const interrupt=()=>{sequence++;active?.abort();active=undefined;clearTimer();};
  const poll=async()=>{
   if(stopped||!isVisible())return;
   interrupt();const ownSequence=sequence;const controller=new AbortController();active=controller;
   const owns=()=>!stopped&&sequence===ownSequence&&!controller.signal.aborted;
   try{
    const next=await requestRef.current(signal=>fileJobsApi.status(well,job,signal),controller.signal);
    if(!owns())return;
    if(canAdvanceFileJobStatus(snapshot.current.status,next)){snapshot.current.status=next;setStatus(next);setError(undefined);failures=0;}
   }catch(problem){if(!owns())return;setError(fileProblem(problem));failures++;}
   if(!owns())return;
   active=undefined;
   const delay=pollDelay(snapshot.current.status?.state??'pending_dispatch',Date.now()-snapshot.current.started,failures);
   if(delay!==false)timer=setTimeout(()=>{if(!owns())return;timer=undefined;void poll();},delay);
  };
  const wake=async()=>{
   const ownWake=++wakeSequence;interrupt();
   if(!isVisible()||stopped||snapshot.current.status&&jobTerminal(snapshot.current.status.state))return;
   const ticket=auth.capturePrivate();await auth.refreshSession();
   if(stopped||ownWake!==wakeSequence||!ticket.current()||!isVisible())return;
   void poll();
  };
  void poll();window.addEventListener('focus',wake);window.addEventListener('online',wake);document.addEventListener('visibilitychange',wake);
  return()=>{stopped=true;wakeSequence++;interrupt();window.removeEventListener('focus',wake);window.removeEventListener('online',wake);document.removeEventListener('visibilitychange',wake);};
 },[well,job,refresh,auth.privateEpoch,auth.privateBlocked,auth.canOperate]);
 return {status,error,reload,terminal:!!status&&jobTerminal(status.state)};
}
