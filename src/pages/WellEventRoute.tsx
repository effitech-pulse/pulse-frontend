import {useLocation} from 'react-router-dom';
import {WellDetailPage} from '@/pages/WellDetailPage';
import {EventDetailPage} from '@/pages/EventDetailPage';

/** Presence (even invalid/empty) dispatches before legacy hooks or numeric conversions. */
export function WellEventRoute() {
 const location=useLocation();
 return new URLSearchParams(location.search).has('event')?<EventDetailPage wellMode/>:<WellDetailPage/>;
}
