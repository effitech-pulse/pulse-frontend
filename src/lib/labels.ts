/** Русские названия типов отказов (значения failure_type в БД и ML-манифесте). */
export const FAILURE_TYPE_RU: Record<string, string> = {
  PARAFFIN: 'Парафин',
  SCALING: 'Соль / засорение',
  TUBING_LEAK_UPPER: 'Утечка НКТ (верх)',
  TUBING_LEAK_LOWER: 'Утечка НКТ (низ)',
  EMULSION: 'Эмульсия (ВНЭ)',
  SHAFT_BREAK: 'Слом вала',
  REGIME_CHANGE: 'Смена режима',
  IMPELLER_WEAR: 'Износ РК',
  INSULATION: 'Изоляция',
};

export const failureTypeRu = (t: string): string => FAILURE_TYPE_RU[t] ?? t;
