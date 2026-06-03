import apiClient from './client';
import type { ApiResponse } from './auth';

export interface CreateOrderResult {
  orderId: string;
  codeUrl: string;
}

export interface OrderStatusResult {
  orderId: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded';
  amount: number;
  credits: number;
  packageId: string;
  createdAt: string;
}

/** 创建微信支付订单 */
export async function createOrder(packageId: string): Promise<CreateOrderResult> {
  const res = await apiClient.post<ApiResponse<CreateOrderResult>>('/payment/create-order', { packageId });
  return res.data.data;
}

/** 查询订单支付状态 */
export async function getOrderStatus(orderId: string): Promise<OrderStatusResult> {
  const res = await apiClient.get<ApiResponse<OrderStatusResult>>(`/payment/order-status/${orderId}`);
  return res.data.data;
}
