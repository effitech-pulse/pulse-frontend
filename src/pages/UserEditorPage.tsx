import { useParams } from 'react-router-dom';
import { AccountsPage } from './AccountsPage';
/** Route wrapper only: AccountsPage owns the existing atomic authorization flow. */
export function UserEditorPage(){const {id}=useParams();return <AccountsPage userEditorID={id??'new'}/>;}
