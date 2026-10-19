import { createContext, useContext, useState, type ReactNode } from 'react';
import {useAuth} from '@/auth/AuthProvider';
export type FundType = 'operational' | 'presentation';
const FundContext = createContext<{fund: FundType; setFund: (fund: FundType) => void}>({fund:'operational',setFund:()=>{}});
export const useFund = () => useContext(FundContext);
export function FundProvider({children}: {children: ReactNode}) {
  const {principal}=useAuth();
  const [storedFund, update] = useState<FundType>(() => {try {return localStorage.getItem('pulse-fund') === 'presentation' ? 'presentation' : 'operational';} catch {return 'operational';}});
  const allowed=principal?.scope.funds ?? [];
  const fund=allowed.includes(storedFund)?storedFund:(allowed[0] ?? 'operational');
  const setFund = (value: FundType) => {if(!allowed.includes(value))return;update(value);try {localStorage.setItem('pulse-fund',value);} catch { /* выбор сохраняется в текущем сеансе */ }};
  return <FundContext.Provider value={{fund,setFund}}>{children}</FundContext.Provider>;
}
