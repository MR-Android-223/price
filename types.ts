
export interface DebtRecord {
  id: string;
  name: string;
  liraDebt: string; // Stored as string to handle manual input easily
  dollarDebt: string;
  category: string;
  date: string;
}

export interface AppSettings {
  exchangeRate: number;
  password?: string;
  columnNames: string[];
}

export interface AppData {
  records: DebtRecord[];
  settings: AppSettings;
}

export enum ModalType {
  NONE,
  SETTINGS,
  SEARCH,
  PASSWORD,
  CALENDAR,
  AI_CHAT,
  IMAGE_GEN,
  DELETE_CONFIRM
}
