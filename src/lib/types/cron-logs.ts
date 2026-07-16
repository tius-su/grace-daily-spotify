export interface CronLogEntry {
  id: string;
  date: string;
  cronType: string;
  target: number;
  success: number;
  duplicate: number;
  failed: number;
  entries: Array<{
    keyword: string;
    kategori: string;
    slug: string;
    title?: string;
    status: "success" | "duplicate" | "failed";
    error?: string;
    generatedAt: string;
  }>;
  status: "BERHASIL" | "PERLU_PERHATIAN";
  createdAt: Date | string;
}

