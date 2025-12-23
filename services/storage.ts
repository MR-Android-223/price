
import { AppData, DebtRecord } from '../types';

const STORAGE_KEY = 'balance_zen_data';

const DEFAULT_DATA: AppData = {
  records: Array.from({ length: 200 }, (_, i) => ({
    id: `row-${i}`,
    name: '',
    liraDebt: '',
    dollarDebt: '',
    category: '',
    date: ''
  })),
  settings: {
    exchangeRate: 10000,
    columnNames: ['الاسم', 'ليرة', 'دولار', 'الصنف', 'التاريخ']
  }
};

export const storage = {
  save: (data: AppData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  load: (): AppData => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_DATA;
    try {
      return JSON.parse(stored);
    } catch (e) {
      return DEFAULT_DATA;
    }
  },
  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  },
  exportData: (data: AppData) => {
    const json = JSON.stringify(data);
    navigator.clipboard.writeText(json).then(() => {
      alert('تم نسخ البيانات يدوياً إلى الحافظة');
    });
  },
  importData: (json: string): AppData | null => {
    try {
      const data = JSON.parse(json);
      if (data.records && data.settings) return data;
      return null;
    } catch (e) {
      return null;
    }
  }
};
