// Analytics service — backend endpoints under /analytics/*
// Centralized so future analytics pages reuse identical contracts.

import { api } from "@/lib/api-client";

export const analyticsService = {
  dashboard: () => api.get<unknown>("/analytics/dashboard"),
  summaryToday: () => api.get<unknown>("/analytics/summary/today"),
  revenueDaily: () => api.get<unknown>("/analytics/revenue/daily"),
  revenueWeekly: () => api.get<unknown>("/analytics/revenue/weekly"),
  revenueMonthly: () => api.get<unknown>("/analytics/revenue/monthly"),
  revenueLostEstimate: () => api.get<unknown>("/analytics/revenue/lost-estimate"),
  topDiseases: () => api.get<unknown>("/analytics/diseases/top"),
  topPatients: () => api.get<unknown>("/analytics/patients/top"),
  missedPatients: () => api.get<unknown>("/analytics/patients/missed"),
  retention: () => api.get<unknown>("/analytics/patients/retention"),
  whatsappDelivery: () => api.get<unknown>("/analytics/whatsapp/delivery"),
  followupsToday: () => api.get<unknown>("/analytics/followups/today"),
};
