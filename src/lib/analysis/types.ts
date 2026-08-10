export type AnalysisProvider = "mock" | "openai" | "openaiVision" | "perfectcorp";

export type AnalysisPhotoInput = {
  front?: string;
  left?: string;
  right?: string;
  close?: string;
};

export type AnalysisProductCatalogItem = {
  name: string;
  usagePurpose: string;
  usageTime?: string;
};

export type AnalysisInput = {
  customerId: string;
  customerName: string;
  age?: string | number;
  gender?: string;
  consentAccepted: boolean;
  photos: AnalysisPhotoInput;
  skinType: string;
  mainConcern: string;
  spfUsage: string;
  homeCareRoutine: string;
  notes: string;
  productCatalog?: AnalysisProductCatalogItem[];
};

export type RecommendedProtocol = {
  name: string;
  sessions: number;
  frequency: string;
  salonNote: string;
};

export type RecommendedProduct = {
  name: string;
  time: string;
  purpose: string;
  salesNote: string;
};

export type AnalysisOutput = {
  reportId: string;
  customerId: string;
  customerName: string;
  createdAt: string;
  overallScore: number;
  scores: {
    hydration: number;
    pigmentation: number;
    pores: number;
    wrinkles: number;
    sensitivity: number;
  };
  skinType: string;
  mainConcern: string;
  aiComment: string;
  rawAiResponse?: unknown;
  recommendedProtocol: RecommendedProtocol;
  recommendedProducts: RecommendedProduct[];
};
