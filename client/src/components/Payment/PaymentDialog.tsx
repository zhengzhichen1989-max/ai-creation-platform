import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  CircularProgress,
  IconButton,
  Fade,
} from '@mui/material';
import Close from '@mui/icons-material/Close';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutline';
import ErrorOutline from '@mui/icons-material/ErrorOutline';
import HourglassEmpty from '@mui/icons-material/HourglassEmpty';
import QRCode from 'qrcode';
import { useCreateOrder, usePollOrderStatus, useInvalidateCreditsOnPayment } from '@/hooks/usePayment';
import { useSnackbarStore } from '@/stores/snackbar.store';

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  packageId: string;
  packageName: string;
  credits: number;
  priceCents: number;
}

/** 微信支付状态 */
type PaymentState = 'creating' | 'scanning' | 'success' | 'failed' | 'expired';

export function PaymentDialog({
  open,
  onClose,
  packageId,
  packageName,
  credits,
  priceCents,
}: PaymentDialogProps) {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [codeUrl, setCodeUrl] = useState<string | null>(null);
  const [qrSvg, setQrSvg] = useState<string>('');
  const [paymentState, setPaymentState] = useState<PaymentState>('creating');

  const createOrderMutation = useCreateOrder();
  const invalidateCredits = useInvalidateCreditsOnPayment();
  const showSnackbar = useSnackbarStore((s) => s.showSnackbar);

  // 轮询订单状态（仅在 scanning 状态时启用）
  const { data: orderStatus } = usePollOrderStatus(
    orderId,
    paymentState === 'scanning',
  );

  // 格式化价格
  const formatPrice = (cents: number): string => {
    return `¥${(cents / 100).toFixed(2)}`;
  };

  // 创建订单
  const handleCreateOrder = useCallback(async () => {
    setPaymentState('creating');
    setOrderId(null);
    setCodeUrl(null);
    setQrSvg('');

    try {
      const result = await createOrderMutation.mutateAsync(packageId);
      setOrderId(result.orderId);
      setCodeUrl(result.codeUrl);

      // 生成二维码 SVG
      const svgString = await QRCode.toString(result.codeUrl, {
        type: 'svg',
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      });
      setQrSvg(svgString);
      setPaymentState('scanning');
    } catch {
      // error 已由 useCreateOrder 的 onError 处理
      setPaymentState('failed');
    }
  }, [packageId, createOrderMutation]);

  // Dialog 打开时创建订单
  useEffect(() => {
    if (open) {
      handleCreateOrder();
    } else {
      // 关闭时重置状态
      setOrderId(null);
      setCodeUrl(null);
      setQrSvg('');
      setPaymentState('creating');
    }
  }, [open, handleCreateOrder]);

  // 监听订单状态变化
  useEffect(() => {
    if (!orderStatus) return;

    if (orderStatus.status === 'paid') {
      setPaymentState('success');
      invalidateCredits();
      showSnackbar('支付成功，积分已到账', 'success');
    } else if (orderStatus.status === 'failed') {
      setPaymentState('failed');
      showSnackbar('支付失败，请重新尝试', 'error');
    } else if (orderStatus.status === 'expired') {
      setPaymentState('expired');
      showSnackbar('订单已过期，请重新下单', 'warning');
    } else if (orderStatus.status === 'refunded') {
      setPaymentState('failed');
      showSnackbar('订单已退款', 'info');
    }
  }, [orderStatus, invalidateCredits, showSnackbar]);

  // 支付成功后自动关闭弹窗
  useEffect(() => {
    if (paymentState === 'success') {
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [paymentState, onClose]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* 顶部标题栏 */}
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Typography variant="h6" component="span" fontWeight={600}>
          微信支付
        </Typography>
        <IconButton
          aria-label="关闭"
          onClick={onClose}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: 4, pb: 2 }}>
        {/* 套餐信息 */}
        <Box
          sx={{
            textAlign: 'center',
            mb: 3,
            py: 2,
            px: 2,
            bgcolor: 'primary.50',
            borderRadius: 2,
          }}
        >
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {packageName}
          </Typography>
          <Typography variant="h4" color="primary" fontWeight={700}>
            {formatPrice(priceCents)}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {credits} 积分
          </Typography>
        </Box>

        {/* 创建订单中 */}
        {paymentState === 'creating' && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="body1" color="text.secondary">
              正在创建订单...
            </Typography>
          </Box>
        )}

        {/* 扫码支付中 */}
        {paymentState === 'scanning' && qrSvg && (
          <Fade in>
            <Box sx={{ textAlign: 'center' }}>
              {/* 二维码 */}
              <Box
                sx={{
                  display: 'inline-block',
                  p: 2,
                  bgcolor: '#fff',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  mb: 2,
                }}
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />

              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                请使用微信扫码支付
              </Typography>
              <Typography variant="caption" color="text.disabled">
                订单将在30分钟后过期
              </Typography>
            </Box>
          </Fade>
        )}

        {/* 支付成功 */}
        {paymentState === 'success' && (
          <Fade in>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CheckCircleOutline
                sx={{ fontSize: 72, color: 'success.main', mb: 2 }}
              />
              <Typography variant="h6" color="success.main" fontWeight={600}>
                支付成功
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                积分已到账，即将关闭...
              </Typography>
            </Box>
          </Fade>
        )}

        {/* 支付失败 */}
        {paymentState === 'failed' && (
          <Fade in>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ErrorOutline
                sx={{ fontSize: 72, color: 'error.main', mb: 2 }}
              />
              <Typography variant="h6" color="error.main" fontWeight={600}>
                支付失败
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                请重新尝试下单
              </Typography>
            </Box>
          </Fade>
        )}

        {/* 订单过期 */}
        {paymentState === 'expired' && (
          <Fade in>
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <HourglassEmpty
                sx={{ fontSize: 72, color: 'warning.main', mb: 2 }}
              />
              <Typography variant="h6" color="warning.main" fontWeight={600}>
                订单已过期
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                请重新下单
              </Typography>
            </Box>
          </Fade>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 4, pb: 3, justifyContent: 'center' }}>
        {(paymentState === 'failed' || paymentState === 'expired') && (
          <Button
            variant="contained"
            onClick={handleCreateOrder}
            size="large"
            sx={{ minWidth: 160 }}
          >
            重新下单
          </Button>
        )}
        {paymentState === 'scanning' && (
          <Button variant="outlined" onClick={onClose} size="large">
            取消支付
          </Button>
        )}
        {paymentState === 'success' && (
          <Button variant="contained" onClick={onClose} size="large">
            完成
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
