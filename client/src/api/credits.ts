import apiClient from './client';
import type { ApiResponse } from './auth';

export interface CreditBalance {
  balance: number;
  userId: number;
}

export interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  unitLabel: string | null;
  maxPerUser: number | null;
}

export interface CreditTransaction {
  id: number;
  userId: number;
  type: 'purchase' | 'consume' | 'refund';
  amount: number;
  balanceAfter: number;
  referenceId: string | null;
  description: string | null;
  createdAt: string;
}

export interface PurchaseResult {
  balance: number;
  transactionId: number;
}

export interface TransactionListResult {
  items: CreditTransaction[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TransactionListParams {
  type?: 'purchase' | 'consume' | 'refund';
  page?: number;
  pageSize?: number;
}

/** Get current user's credit balance */
export async function getBalance(): Promise<CreditBalance> {
  const res = await apiClient.get<ApiResponse<CreditBalance>>('/credits/balance');
  return res.data.data;
}

/** List available credit packages */
export async function listPackages(): Promise<CreditPackage[]> {
  const res = await apiClient.get<ApiResponse<CreditPackage[]>>('/credits/packages');
  return res.data.data;
}

/** Purchase a credit package (MVP: simulated) */
export async function purchasePackage(packageId: string): Promise<PurchaseResult> {
  const res = await apiClient.post<ApiResponse<PurchaseResult>>('/credits/purchase', {
    packageId,
  });
  return res.data.data;
}

/** List credit transaction history */
export async function listTransactions(params?: TransactionListParams): Promise<TransactionListResult> {
  const res = await apiClient.get<ApiResponse<TransactionListResult>>(
    '/credits/transactions',
    { params },
  );
  return res.data.data;
}
