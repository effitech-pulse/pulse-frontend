import {useEffect, useMemo, useRef, useState} from 'react';
import type {CSSProperties, ReactNode} from 'react';
import {Alert, Button, Checkbox, Empty, Input, Pagination, Popover, Space, Table, theme} from 'antd';
import type {TableProps} from 'antd';
import type {ColumnType, ColumnsType} from 'antd/es/table';
import {applyTableQuery, parseTableNumberBound, cycleSort, resetFilters, resetSort, validateTableFilter} from '../../lib/tableQuery';
import type {FieldOption, FieldSchema, Scalar, TableFilter, TableQuery, TableSchema} from '../../lib/tableQuery';
import './PulseTable.css';

export type PulseColumn<T> = Omit<ColumnType<T>, 'sorter' | 'filters' | 'sortOrder' | 'defaultSortOrder' | 'filterDropdown'> & {
  key: string; filterKeys?: string[]; sortKey?: string;
};
type CommonProps<T> = Pick<TableProps<T>, 'rowKey' | 'scroll' | 'size' | 'locale' | 'rowClassName' | 'onRow' | 'components'> & {
  schema: TableSchema<T>; columns: PulseColumn<T>[]; query: TableQuery;
  onQueryChange: (query: TableQuery) => void; loading?: boolean; error?: ReactNode;
  headerActions?: ReactNode; emptyText?: ReactNode;
};
export type PulseTableProps<T> = CommonProps<T> & ({mode: 'local'; rows: T[];
  pagination: {page: number; pageSize: number; onPageChange: (page: number, pageSize: number) => void}}
  | {mode: 'server'; page: {items: T[]; next_cursor: string | null};
    pagination: {canPrevious: boolean; onPrevious: () => void; onNext: () => void}});

function FilterField<T>({field, filter, rows, onChange, inline = false, onClose}: {field: FieldSchema<T>; filter?: TableFilter;
  rows: T[]; onChange: (filter?: TableFilter) => void; inline?: boolean; onClose?:()=>void}) {
  const {token} = theme.useToken();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const nextController=useRef<AbortController>();
  useEffect(()=>()=>nextController.current?.abort(),[]);
  const [remote,setRemote]=useState<FieldOption[]>([]),[nextOption,setNextOption]=useState<string|null>(null),[optionError,setOptionError]=useState(false),[optionLoading,setOptionLoading]=useState(false);
  useEffect(()=>{
    nextController.current?.abort();
    if(!field.loadOptions||(!open&&!inline))return;
    const controller=new AbortController();const timer=setTimeout(()=>{setOptionLoading(true);setOptionError(false);
      field.loadOptions!(search,undefined,controller.signal).then(result=>{if(!controller.signal.aborted){setRemote(result.items);setNextOption(result.next_cursor);}}).catch(()=>{if(!controller.signal.aborted)setOptionError(true);}).finally(()=>{if(!controller.signal.aborted)setOptionLoading(false);});
    },200);
    return()=>{clearTimeout(timer);controller.abort();};
  },[field.loadOptions,search,open,inline]);

  const [text, setText] = useState(filter?.op === 'contains' ? filter.value : '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => popup.current?.querySelector<HTMLInputElement>('input')?.focus());
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {setOpen(false); trigger.current?.focus();}};
    document.addEventListener('keydown', escape);
    return () => {cancelAnimationFrame(frame); document.removeEventListener('keydown', escape);};
  }, [open]);
  const [invalid, setInvalid] = useState(false);
  useEffect(() => {
    setText(filter?.op === 'contains' ? filter.value : ''); setInvalid(false);
    if (inline && filter && (filter.op === 'range' || filter.op === 'overlap')) {
      const display = (value: string | number | undefined) => {
        if (value === undefined) return '';
        if (field.kind !== 'datetime' || field.timezone === 'unspecified') return String(value);
        const time = Date.parse(String(value));
        return Number.isFinite(time) ? new Date(time + 3 * 3600000).toISOString().slice(0, 23) : '';
      };
      setFrom(display(filter.from)); setTo(display(filter.to));
    }
  }, [filter, inline, field.kind]);
  const multi = field.kind === 'enum' || field.kind === 'boolean';
  const selected = filter?.op === 'in' ? filter.values : [];
  const options = useMemo(() => field.loadOptions ? remote : field.options ?? (field.kind === 'boolean'
    ? [{label: 'Да', value: true}, {label: 'Нет', value: false}, {label: 'Неизвестно', value: null}]
    : Array.from(new Set(rows.map(row => field.read(row) ?? null))).map(value => ({label: value === null ? 'Неизвестно' : String(value), value}))), [field, rows, remote]);
  const close = () => {if(inline){onClose?.();return;}setOpen(false); trigger.current?.focus();};
  const clear = () => {onChange(); setFrom(''); setTo(''); setText(''); setInvalid(false);};
  if (field.kind === 'text' || field.kind === 'pulseId') return <div className="pulse-table-filter-field">
    <Input aria-label={`Фильтр: ${field.label}`} placeholder="Поиск" allowClear value={text} status={invalid ? 'error' : undefined}
      onChange={event => {const value = event.target.value; setText(value); const next: TableFilter = {field: field.key, op: 'contains', value};
        const valid = validateTableFilter(field, next); setInvalid(!valid); if (valid) onChange(value ? next : undefined);}} />
    {field.options?.some(option=>option.value===null)?<Checkbox checked={filter?.op==='in'&&filter.values.includes(null)} onChange={event=>onChange(event.target.checked?{field:field.key,op:'in',values:[null]}:undefined)}>{field.options.find(option=>option.value===null)?.label}</Checkbox>:null}
    {invalid ? <span role="alert" className="pulse-table-filter-error">Введите положительный ID int64</span> : null}
  </div>;
  const range = filter && (filter.op === 'range' || filter.op === 'overlap') ? filter : undefined;
  const localValue = (value: string | number | undefined) => {
    if (value === undefined) return '';
    if (field.kind !== 'datetime' || field.timezone === 'unspecified') return String(value);
    const time = Date.parse(String(value)); return Number.isFinite(time) ? new Date(time + 3 * 3600000).toISOString().slice(0, 23) : '';
  };
  const content = <div ref={popup} className="pulse-table-popover" style={{'--pulse-table-error': token.colorError} as CSSProperties} onKeyDown={event => {if (event.key === 'Escape') {event.stopPropagation(); close();}}}>
    {multi ? <>
      <Input aria-label={`Поиск значений: ${field.label}`} placeholder="Поиск значений" allowClear value={search} onChange={event => setSearch(event.target.value)} />
      <div className="pulse-table-options" role="group" aria-label={field.label}>
        {options.filter(option => option.label.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru'))).map(option =>
          <Checkbox key={`${typeof option.value}:${String(option.value)}`} checked={selected.includes(option.value)} onChange={event => {
            const values: Scalar[] = event.target.checked ? [...selected, option.value] : selected.filter(value => value !== option.value);
            onChange(values.length ? {field: field.key, op: 'in', values} : undefined);
          }}>{option.label}</Checkbox>)}
      </div>
      {optionError?<span role="alert">Не удалось загрузить варианты</span>:null}
      {nextOption&&field.loadOptions?<Button loading={optionLoading} onClick={async()=>{nextController.current?.abort();const controller=new AbortController();nextController.current=controller;setOptionLoading(true);try{const result=await field.loadOptions!(search,nextOption,controller.signal);if(!controller.signal.aborted){setRemote(previous=>[...previous,...result.items]);setNextOption(result.next_cursor);}}catch{if(!controller.signal.aborted)setOptionError(true);}finally{if(!controller.signal.aborted)setOptionLoading(false);}}}>Ещё варианты</Button>:null}
      <Button onClick={clear}>Очистить</Button>
    </> : <>
      <div className="pulse-table-range-label">{field.label}{field.unit ? `, ${field.unit}` : ''}</div>
      {field.kind === 'datetime' ? <div>{field.timezone === 'unspecified' ? 'Пояс не задан · время записи' : 'Часовой пояс: Москва (UTC+03:00)'}</div> : null}
      <Input aria-label={`${field.label}: от`} step={field.kind === 'datetime' ? '0.001' : undefined} type={field.kind === 'number' ? 'number' : field.kind === 'datetime' ? field.timezone === 'unspecified' ? 'text' : 'datetime-local' : 'date'} placeholder={field.timezone === 'unspecified' ? 'YYYY-MM-DDTHH:mm:ss.ffffff' : undefined} value={from} onChange={event => {setFrom(event.target.value); setInvalid(false);}} />
      <Input aria-label={`${field.label}: до`} step={field.kind === 'datetime' ? '0.001' : undefined} type={field.kind === 'number' ? 'number' : field.kind === 'datetime' ? field.timezone === 'unspecified' ? 'text' : 'datetime-local' : 'date'} placeholder={field.timezone === 'unspecified' ? 'YYYY-MM-DDTHH:mm:ss.ffffff' : undefined} value={to} onChange={event => {setTo(event.target.value); setInvalid(false);}} />
      {invalid ? <span role="alert" className="pulse-table-filter-error">Проверьте границы интервала</span> : null}
      <Space><Button onClick={clear}>Очистить</Button><Button type="primary" onClick={() => {
        const convert = (value: string, previous: string | number | undefined) => {
          if (!value) return undefined;
          if (previous !== undefined && localValue(previous) === value) return previous;
          return field.kind === 'number' ? parseTableNumberBound(value) : field.kind === 'datetime' ? `${value.length === 16 ? `${value}:00` : value}${field.timezone === 'unspecified' ? '' : '+03:00'}` : value;
        };
        let next:TableFilter;try{next={field: field.key, op: field.readEnd ? 'overlap' : 'range', from: convert(from, range?.from), to: convert(to, range?.to)};}catch{setInvalid(true);return;}
        if (!validateTableFilter(field, next)) {setInvalid(true); return;}
        onChange(from || to ? next : undefined); close();
      }}>Применить</Button></Space>
    </>}
  </div>;
  if (inline) return content;
  return <div className="pulse-table-filter-field"><Popover trigger="click" open={open} content={content} placement="bottomLeft"
    onOpenChange={next => {setOpen(next); if (next) {setFrom(localValue(range?.from)); setTo(localValue(range?.to)); setInvalid(false);}}}>
    <button ref={trigger} type="button" className="pulse-table-filter-trigger" aria-label={`Фильтр: ${field.label}`} aria-expanded={open}
      onKeyDown={event => {if (event.key === 'Escape') close();}}>
      <span>{multi ? selected.length ? `Выбрано: ${selected.length}` : 'Все' : range ? 'Интервал задан' : 'Интервал'}</span><span aria-hidden="true">⌄</span>
    </button>
  </Popover>{filter ? <button type="button" className="pulse-table-filter-clear" aria-label={`Очистить: ${field.label}`} onClick={clear}>×</button> : null}</div>;
}

function ColumnFilters<T>({fields, rows, query, onChange}: {fields: FieldSchema<T>[]; rows: T[]; query: TableQuery; onChange: (query: TableQuery) => void}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => popup.current?.querySelector<HTMLInputElement>('input')?.focus());
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {setOpen(false); trigger.current?.focus();}};
    document.addEventListener('keydown', escape);
    return () => {cancelAnimationFrame(frame); document.removeEventListener('keydown', escape);};
  }, [open]);
  const setFilter = (field: FieldSchema<T>, next?: TableFilter) => onChange({...query,
    filters: [...query.filters.filter(filter => filter.field !== field.key), ...(next ? [next] : [])]});
  if (fields.length < 2) return fields.map(field => <FilterField key={field.key} field={field} rows={rows}
    filter={query.filters.find(filter => filter.field === field.key)} onChange={next => setFilter(field, next)} />);
  const count = query.filters.filter(filter => fields.some(field => field.key === filter.field)).length;
  return <div className="pulse-table-filter-field"><Popover open={open} onOpenChange={setOpen} trigger="click" placement="bottomLeft"
    content={<div ref={popup} className="pulse-table-compound">{fields.map(field => <section key={field.key} aria-label={field.label}>
      <div className="pulse-table-group-label">{field.label}</div><FilterField inline onClose={()=>{setOpen(false);trigger.current?.focus();}} field={field} rows={rows}
        filter={query.filters.find(filter => filter.field === field.key)} onChange={next => setFilter(field, next)} />
    </section>)}</div>}>
    <button ref={trigger} type="button" className="pulse-table-filter-trigger" aria-label={`Фильтры: ${fields.map(field => field.label).join(', ')}`} aria-expanded={open}>
      <span>{count ? `Условий: ${count}` : 'Все'}</span><span aria-hidden="true">⌄</span>
    </button></Popover>{count ? <button type="button" className="pulse-table-filter-clear" aria-label={`Очистить: ${fields.map(field => field.label).join(', ')}`}
      onClick={() => onChange({...query, filters: query.filters.filter(filter => !fields.some(field => field.key === filter.field))})}>×</button> : null}</div>;
}

/** Сортирует полный локальный набор; серверную страницу никогда не переставляет. */
export function PulseTable<T extends object>(props: PulseTableProps<T>) {
  const {schema, query, onQueryChange, loading, columns} = props;
  const {token} = theme.useToken();
  const rows = props.mode === 'local' ? props.rows : props.page.items;
  const filtered = useMemo(() => props.mode === 'local' ? applyTableQuery(props.rows, schema, query) : props.page.items, [props.mode, rows, schema, query]);
  const change = (next: TableQuery) => {if (props.mode === 'local') props.pagination.onPageChange(1, props.pagination.pageSize); onQueryChange(next);};
  const tableColumns: ColumnsType<T> = columns.map(column => {
    const {filterKeys, sortKey, ...base} = column;
    const fieldKey = sortKey ?? (schema.fields.some(field => field.key === column.key) ? column.key : undefined);
    const index = query.sort.findIndex(sort => sort.field === fieldKey);
    const active = query.sort[index];
    const fields = (filterKeys ?? (schema.fields.some(field => field.key === column.key) ? [column.key] : []))
      .map(key => schema.fields.find(field => field.key === key)).filter((field): field is FieldSchema<T> => Boolean(field));
    const sortLabel=typeof column.title==='string'?(fields.length>1?`${column.title}: ${schema.fields.find(field=>field.key===fieldKey)?.label??fieldKey}`:column.title):schema.fields.find(field=>field.key===fieldKey)?.label??fieldKey;
    const description = active ? `${active.direction === 'asc' ? 'По возрастанию' : 'По убыванию'}, приоритет ${index + 1}` : 'Без сортировки';
    return {key: `heading-${column.key}`, width: column.width, fixed: column.fixed,
      title: fieldKey ? <button className="pulse-table-sort" type="button" aria-label={`${sortLabel}. ${description}`}
        onClick={() => change(cycleSort(query, fieldKey))}><span>{typeof column.title === 'function' ? column.title({}) : column.title}</span>
        {active ? <span className="pulse-table-sort-state"><span className="pulse-table-sort-arrow" aria-hidden="true">{active.direction === 'asc' ? '↑' : '↓'}</span><span aria-hidden="true">{index + 1}</span></span> : null}</button> : column.title,
      onHeaderCell: () => ({'aria-sort': index === 0 ? active?.direction === 'asc' ? 'ascending' : 'descending' : undefined}),
      children: [{...base, title: <div className="pulse-table-filter-cell" onClick={event => event.stopPropagation()}>
        <ColumnFilters fields={fields} rows={rows} query={query} onChange={change} />
      </div>}],
    };
  });
  const style = {'--pulse-table-border': token.colorBorder, '--pulse-table-surface': token.colorBgContainer,
    '--pulse-table-heading': token.colorFillAlter, '--pulse-table-text': token.colorText, '--pulse-table-muted': token.colorTextSecondary,
    '--pulse-table-accent': token.colorPrimary, '--pulse-table-error': token.colorError} as CSSProperties;
  const safePage=props.mode==='local'?Math.min(props.pagination.page,Math.max(1,Math.ceil(filtered.length/props.pagination.pageSize))):1;
  const pagedRows = props.mode === 'local' ? filtered.slice((safePage - 1) * props.pagination.pageSize, safePage * props.pagination.pageSize) : filtered;
  return <div className="pulse-table" style={style}>
    <div className="pulse-table-actions">{props.headerActions}<Space wrap>
      {query.filters.length ? <Button onClick={() => change(resetFilters(query))}>Сбросить фильтры</Button> : null}
      {query.sort.length ? <Button onClick={() => change(resetSort(query))}>Сбросить сортировку</Button> : null}
    </Space></div>
    <span className="pulse-table-sr-only" role="status">{query.sort.length ? query.sort.map((sort, index) => `${schema.fields.find(field => field.key === sort.field)?.label ?? sort.field}: ${sort.direction === 'asc' ? 'по возрастанию' : 'по убыванию'}, приоритет ${index + 1}`).join('; ') : 'Исходный порядок'}</span>
    {props.error ? <Alert type="error" showIcon message={props.error} /> : null}
    <Table<T> columns={tableColumns} dataSource={pagedRows} rowKey={props.rowKey ?? schema.rowId} pagination={false} loading={loading}
      scroll={props.scroll ?? {x: 'max-content'}} size={props.size ?? 'small'} rowClassName={props.rowClassName} onRow={props.onRow} components={props.components}
      locale={{...props.locale, emptyText: props.emptyText ?? (!query.filters.length&&props.locale?.emptyText ? props.locale.emptyText : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query.filters.length ? 'Нет совпадений' : 'Нет данных'} />)}} />
    <div className="pulse-table-pagination">{props.mode === 'local' ? <Pagination current={safePage} pageSize={props.pagination.pageSize} total={filtered.length} onChange={props.pagination.onPageChange} showSizeChanger />
      : <Space><Button disabled={!props.pagination.canPrevious || loading} onClick={props.pagination.onPrevious}>Назад</Button><Button disabled={!props.page.next_cursor || loading} onClick={props.pagination.onNext}>Далее</Button></Space>}</div>
  </div>;
}
export default PulseTable;
