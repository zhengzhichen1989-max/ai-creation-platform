import { useState } from 'react';
import { Card, CardContent, Typography, Button, Chip, Grid } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { usePackages } from '@/hooks/useCredits';
import { PaymentDialog } from '@/components/Payment/PaymentDialog';
import type { CreditPackage } from '@/api/credits';

interface SelectedPackage {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
}

export function CreditsPackage() {
  const { data: packages, isLoading } = usePackages();
  const [selectedPkg, setSelectedPkg] = useState<SelectedPackage | null>(null);

  if (isLoading) {
    return <Typography color="text.secondary">加载中...</Typography>;
  }

  if (!packages || packages.length === 0) {
    return <Typography color="text.secondary">暂无可用套餐</Typography>;
  }

  const formatPrice = (priceCents: number): string => {
    return `¥${(priceCents / 100).toFixed(2)}`;
  };

  const handleBuyClick = (pkg: CreditPackage) => {
    setSelectedPkg({
      id: pkg.id,
      name: pkg.name,
      credits: pkg.credits,
      priceCents: pkg.priceCents,
    });
  };

  const handleDialogClose = () => {
    setSelectedPkg(null);
  };

  return (
    <>
      <Grid container spacing={2}>
        {packages.map((pkg) => (
          <Grid item xs={12} sm={6} md={4} key={pkg.id}>
            <Card
              variant="outlined"
              sx={{
                textAlign: 'center',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  boxShadow: '0 4px 12px rgba(98, 0, 234, 0.2)',
                },
              }}
            >
              <CardContent sx={{ py: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {pkg.name}
                </Typography>

                <Typography variant="h3" color="primary" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {formatPrice(pkg.priceCents)}
                </Typography>

                <Chip
                  label={`${pkg.credits} 积分`}
                  color="primary"
                  size="small"
                  sx={{ mb: 1.5 }}
                />

                {pkg.unitLabel && (
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 2 }}>
                    {pkg.unitLabel}
                  </Typography>
                )}

                <Button
                  variant="contained"
                  startIcon={<ShoppingCartIcon />}
                  onClick={() => handleBuyClick(pkg)}
                  fullWidth
                >
                  购买
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 微信支付弹窗 */}
      {selectedPkg && (
        <PaymentDialog
          open={!!selectedPkg}
          onClose={handleDialogClose}
          packageId={selectedPkg.id}
          packageName={selectedPkg.name}
          credits={selectedPkg.credits}
          priceCents={selectedPkg.priceCents}
        />
      )}
    </>
  );
}
