import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as creditsApi from '@/api/credits';
import { useSnackbarStore } from '@/stores/snackbar.store';

/** Fetch current user's credit balance */
export function useBalance() {
  return useQuery({
    queryKey: ['credits', 'balance'],
    queryFn: creditsApi.getBalance,
  });
}

/** List available credit packages */
export function usePackages() {
  return useQuery({
    queryKey: ['credits', 'packages'],
    queryFn: creditsApi.listPackages,
  });
}

/** Purchase a credit package */
export function usePurchasePackage() {
  const queryClient = useQueryClient();
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  return useMutation({
    mutationFn: creditsApi.purchasePackage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      showSnackbar('充值成功', 'success');
    },
  });
}

/** List credit transaction history */
export function useTransactions(params?: creditsApi.TransactionListParams) {
  return useQuery({
    queryKey: ['credits', 'transactions', params],
    queryFn: () => creditsApi.listTransactions(params),
  });
}
