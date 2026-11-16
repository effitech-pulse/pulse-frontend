import type {FieldOption, Scalar} from './tableQuery';
/** Ant Select получает строковый ключ, исходное значение фильтра остаётся типизированным. */
export const optionKey = (value: Scalar): string => `${typeof value}:${String(value)}`;
export function mergeFieldOptions(previous: FieldOption[], next: FieldOption[]): FieldOption[] {
  const options = new Map(previous.map(option => [optionKey(option.value), option]));
  next.forEach(option => options.set(optionKey(option.value), option));
  return [...options.values()];
}
export const availableFieldOptions = (options: FieldOption[], selected: Scalar[]): FieldOption[] => options.filter(option => !selected.includes(option.value));
export const selectedFieldOptions = (options: FieldOption[], selected: Scalar[]): FieldOption[] => selected.map(value => options.find(option => option.value === value) ?? {value, label: value === null ? 'Неизвестно' : String(value)});
