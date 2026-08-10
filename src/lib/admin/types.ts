export type AdminDashboardStats = {
  totalSalons: number;
  activeSalons: number;
  monthlyAnalyses: number;
  pendingAnalyses: number;
  completedReports: number;
  estimatedRevenue: string;
};

export type AdminSalonListItem = {
  id: string;
  name: string;
  owner: string;
  city: string;
  packageName: string;
  status: string;
  userCount: number;
  monthlyAnalysisLimit: number;
  usedAnalyses: number;
  monthlyAnalyses: number;
  remainingAnalyses: number;
  createdBy?: string;
};
