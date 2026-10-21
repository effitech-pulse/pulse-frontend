/** Идентификатор Pulse передаётся строкой без потери разрядов. */
export function validPulseId(value: string): boolean {
  return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
}
export function parseFileCheckLink(value: string | null): {kind:'file'|'period';id:string}|{kind:'invalid'|'none'} {
  if (!value) return {kind:'none'};
  if (/^q1_[a-f0-9]{32}$/.test(value)) return {kind:'file',id:value.slice(3)};
  if (/^[a-f0-9]{32}$/.test(value)) return {kind:'period',id:value};
  return {kind:'invalid'};
}
export function jobTerminal(state: string): boolean {
  return ['succeeded','failed','cancelled','expired','revoked','quarantined'].includes(state);
}
export function pollDelay(state: string, elapsed: number, failures: number): number | false {
  if (jobTerminal(state)) return false;
  return failures ? Math.min(30000,2000*2**Math.min(failures,4)) : elapsed >= 60000 ? 5000 : 2000;
}
/** JSON scanner: небезопасные целые сохраняются десятичными строками. */
export function parseLosslessJSON(raw: string): unknown {
  return JSON.parse(raw.replace(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, token => {
    if (token.startsWith('"') || /[.eE]/.test(token)) return token;
    const n=BigInt(token);return n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(Number.MIN_SAFE_INTEGER) ? `"${token}"` : token;
  }));
}
/** Commitment/key живут только в памяти; транспортная ошибка их не сбрасывает. */
export class StableFileSubmission {
  private operation?: {commitment:string;key:string};
  private busy=false;
  async submit<T>(commitment:string, send:(key:string)=>Promise<T>):Promise<T|undefined> {
    if(this.busy)return undefined;
    if(this.operation && this.operation.commitment!==commitment)throw new Error('new_operation_required');
    this.operation ??= {commitment,key:crypto.randomUUID()};
    this.busy=true;
    try{return await send(this.operation.key);}finally{this.busy=false;}
  }
  reset(){if(!this.busy)this.operation=undefined;}
}
const errors:Record<string,string>={
 cancelled:'Проверка отменена.',job_deadline:'Срок обработки проверки истёк.',access_revoked:'Проверка недоступна.',
 pinned_input_unavailable:'Не удалось получить закреплённые входные данные. Проверка завершилась без результата.',
 input_corrupt:'Входные данные повреждены. Проверка завершилась без результата.',
 execution_failed:'Проверка завершилась ошибкой обработки.',
 execution_busy:'Обработка занята. Проверка ожидает серверного повтора.',
 ml_unavailable:'Сервис обработки временно недоступен. Проверка ожидает серверного повтора.',
 ml_deadline:'Время обработки истекло. Проверка ожидает серверного повтора.',
 result_not_ready:'Результат ещё не готов. Обновите состояние проверки.',
 result_unavailable:'Результат недоступен для текущего состояния проверки.',
 result_cancelled:'Проверка отменена.',result_expired:'Срок обработки проверки истёк.',
 job_revision_conflict:'Состояние проверки изменилось. Обновите его перед действием.',job_terminal:'Проверка уже завершена. Обновите состояние.',
 request_key_conflict:'Конфликт операции. Ваш файл и настройки сохранены.',
 request_commitment_conflict:'Конфликт операции. Ваш файл и настройки сохранены.',input_not_job:'Конфликт операции. Ваш файл и настройки сохранены.',
 invalid_parse_spec:'Проверьте настройки чтения и соответствие каналов.',invalid_mapping:'Проверьте соответствие каналов.',
 raw_limit:'Файл превышает 20 МБ.',body_limit:'Файл превышает допустимый размер.',row_limit:'Допускается не более 100 000 строк.',
 invalid_timezone:'Укажите часовой пояс IANA.',explicit_timezone_required:'Укажите часовой пояс IANA.',
 file_checks_disabled:'Сохранённая проверка сейчас отключена.',file_check_forbidden:'Проверка недоступна.',
};
export function fileJobErrorCopy(reason:string):string{return errors[reason] ?? 'Проверка пока недоступна. Повторите позже.';}
export const fileJobStates:Record<string,string>={pending_dispatch:'Проверка принята. Ожидает отправки',queued:'Ожидает обработки',running:'Выполняется',retry_wait:'Ожидает повтора после сбоя обработки',cancel_requested:'Отмена запрошена. Текущий расчёт ещё может завершиться',succeeded:'Результат сохранён',failed:'Проверка завершилась ошибкой',quarantined:'Обработка остановлена',cancelled:'Проверка отменена',expired:'Срок обработки истёк',revoked:'Проверка недоступна'};
/** Старый статус не откатывает принятую revision или необратимое завершение. */
export function canAdvanceFileJobStatus(previous:{revision:number;state:string}|undefined,next:{revision:number;state:string}):boolean {
 if(!previous)return true;
 if(next.revision<previous.revision)return false;
 if(next.revision===previous.revision&&next.state!==previous.state)return false;
 if(['succeeded','failed','cancelled','expired','revoked'].includes(previous.state)&&next.state!==previous.state)return false;
 return true;
}
/** Причина сохранённого состояния не является транспортной ошибкой запроса. */
export function fileJobStatusReason(state:string,code:string|null):string|null {
 if(!code||['cancelled','revoked','succeeded'].includes(state))return null;
 if(state==='retry_wait')return ['execution_busy','ml_unavailable','ml_deadline'].includes(code)?fileJobErrorCopy(code):'Проверка ожидает серверного повтора.';
 if(state==='expired')return fileJobErrorCopy('job_deadline');
 if(state==='quarantined')return 'Обработка остановлена. Автоматические повторы прекращены.';
 if(state==='failed')return ['pinned_input_unavailable','input_corrupt','execution_failed'].includes(code)?fileJobErrorCopy(code):'Проверка завершилась ошибкой обработки без сохранённого результата.';
 return null;
}
