export interface CompetitorEntry {
  name: string;
  website: string;
  description?: string;
  source?: string;
}

export interface CompanyProfile {
  id: string;
  companyName: string;
  website: string;
  productSummary: string;
  icp: string;
  revenueModel: string;
  pricingSummary: string;
  businessContext: string;
  strategicGoals: string[];
  nonGoals: string[];
  competitors: CompetitorEntry[];
  updatedAt: string;
  updatedBy?: string | null;
}

export type CompanyProfileInput = Partial<
  Omit<CompanyProfile, "id" | "updatedAt">
>;

export type BusinessFit = "strong" | "moderate" | "weak" | "misaligned";

export interface CompanyIdeaValidation {
  businessFit: BusinessFit;
  revenueImpact: string;
  alignmentNotes: string;
  companyValidationSummary: string;
}
