export type IfrcSurgeAlertResponse = {
  count: number;
  next: string | null;
  previous: string | null;
  results: IfrcSurgeAlertRaw[];
};

export type IfrcSurgeAlertRaw = {
  id: number;
  country: {
    id: number;
    name: string;
    iso3: string;
  };
  event: {
    id: number;
    name: string;
    dtype: {
      id: number;
      name: string;
    };
    summary?: string;
  };
  created_at: string;
  modified_at?: string;
  status?: string;
  molnix_status_display?: string;
  category_display?: string;
  deployment_needed?: boolean;
  molnix_tags?: Array<{
    id: number;
    name: string;
    groups?: string[];
  }>;
  opens?: string;
  closes?: string;
  message?: string;
  atype_display?: string;
};
