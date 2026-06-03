import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as paymentApi from '@/api/payment';
import { useSnackbarStore } from '@/stores/snackbar.store';

/** 创建支付订单 */
export function useCreateOrder() {
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  return useMutation({
    mutationFn: paymentApi.createOrder,
    onError: (error: Error) => {
      const message = error.message || '创建订单失败，请稍后重试';
      showSnackbar(message, 'error');
    },
  });
}

/** 轮询订单状态（用于支付等待页面） */
export function usePollOrderStatus(orderId: string | null, enabled: boolean) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['payment', 'order-status', orderId],
    queryFn: () => paymentApi.getOrderStatus(orderId!),
    enabled: !!orderId && enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      // 支付成功或失败时停止轮询
      if (
        data &&
        (data.status === 'paid' ||
          data.status === 'failed' ||
          data.status === 'expired' ||
          data.status === 'refunded')
      ) {
        return false;
      }
      return 2000; // 每2秒轮询一次
    },
    refetchIntervalInBackground: true,
  });
}

/** 支付成功后刷新积分相关缓存 */
export function useInvalidateCreditsOnPayment() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ['credits'] });
  };
}
