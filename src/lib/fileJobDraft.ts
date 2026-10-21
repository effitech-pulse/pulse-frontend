import type {FileParseSpec} from '../api/fileJobs.ts';
import {validPulseId} from './fileJobs.ts';
export function validateFileDraft(well:string,file:{name:string;size:number},spec:FileParseSpec):string|null {
 if(!validPulseId(well))return 'Укажите точный ID Pulse одной скважины.';
 if(!/\.(csv|xlsx)$/i.test(file.name))return 'Выберите CSV или XLSX.';
 if(file.size>20*1024*1024)return 'Размер файла превышает 20 МБ.';
 if(!spec.timezone)return 'Укажите часовой пояс IANA.';
 try{new Intl.DateTimeFormat('ru',{timeZone:spec.timezone});}catch{return 'Укажите допустимый часовой пояс IANA.';}
 if(!spec.time_column||spec.header_row<1||spec.header_row>100||!Number.isInteger(spec.header_row)||!spec.mappings.length)return 'Укажите строку заголовка, время и хотя бы один канал.';
 const fields=new Set<string>(),parameters=new Set<string>();
 for(const mapping of spec.mappings){if(!mapping.field||!mapping.parameter||mapping.field===spec.time_column||mapping.field===spec.well_column||fields.has(mapping.field)||parameters.has(mapping.parameter)||!Number.isFinite(mapping.scale)||!Number.isFinite(mapping.offset))return 'Проверьте соответствие каналов.';fields.add(mapping.field);parameters.add(mapping.parameter);}
 return null;
}
export interface FilePreview {sheets:string[];columns:string[];rows:string[][];total:number}
/** Ограниченный локальный просмотр. Исходные байты отправляются серверу отдельно. */
export async function previewFile(file:File,spec:FileParseSpec):Promise<FilePreview>{
 const XLSX=await import('xlsx');const bytes=await file.arrayBuffer();
 const book=spec.format==='csv'?XLSX.read(new TextDecoder('utf-8',{fatal:true}).decode(bytes),{type:'string',raw:true,FS:spec.delimiter,sheetRows:100102}):XLSX.read(bytes,{type:'array',raw:true,sheetRows:100102});
 const name=spec.format==='csv'?book.SheetNames[0]:spec.sheet||book.SheetNames[0];
 const sheet=book.Sheets[name];if(!sheet)throw new Error('Выберите лист файла.');
 const matrix=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:'',raw:true});
 const total=matrix.length-spec.header_row;if(total>100000)throw new Error('Допускается не более 100 000 строк.');
 if(total<1)throw new Error('В файле нет строк данных.');
 const columns=(matrix[spec.header_row-1]??[]).map(String);if(!columns.length||new Set(columns).size!==columns.length||columns.some(v=>!v))throw new Error('Нужны непустые уникальные заголовки колонок.');
 return {sheets:book.SheetNames,columns,rows:matrix.slice(spec.header_row,spec.header_row+5).map(row=>row.map(value=>String(value))),total};
}
/** Только параметры, меняющие колонки/строки локального просмотра. */
export function previewParseKey(spec:Pick<FileParseSpec,'format'|'delimiter'|'sheet'|'header_row'>):string {
 return JSON.stringify([spec.format,spec.delimiter,spec.sheet,spec.header_row]);
}
