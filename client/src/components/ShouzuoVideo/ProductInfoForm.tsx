// ============================================================
// 服饰短片 - 产品信息表单组件
// ============================================================

import { Box, TextField, Typography, Paper } from '@mui/material';
import type { ShouzuoProductInfo } from '@/api/shouzuoVideo';

interface ProductInfoFormProps {
  productInfo: ShouzuoProductInfo;
  onChange: (info: Partial<ShouzuoProductInfo>) => void;
  disabled?: boolean;
}

export default function ProductInfoForm({
  productInfo,
  onChange,
  disabled = false,
}: ProductInfoFormProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}
    >
      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
        产品信息
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        填写产品信息，帮助AI生成更精准的服饰短片和文案
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="产品名称"
          placeholder="例如：手工钩针向日葵挂件"
          value={productInfo.productName}
          onChange={(e) => onChange({ productName: e.target.value })}
          disabled={disabled}
          required
          fullWidth
          size="small"
          inputProps={{ maxLength: 100 }}
          helperText={`${productInfo.productName.length}/100`}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            label="产品品类"
            placeholder="例如：手工钩针"
            value={productInfo.category || ''}
            onChange={(e) => onChange({ category: e.target.value })}
            disabled={disabled}
            fullWidth
            size="small"
            sx={{ flex: '1 1 200px' }}
            inputProps={{ maxLength: 50 }}
          />
          <TextField
            label="材质"
            placeholder="例如：纯棉线"
            value={productInfo.material || ''}
            onChange={(e) => onChange({ material: e.target.value })}
            disabled={disabled}
            fullWidth
            size="small"
            sx={{ flex: '1 1 200px' }}
            inputProps={{ maxLength: 50 }}
          />
        </Box>

        <TextField
          label="核心卖点"
          placeholder={'每行一个卖点，例如：\n纯手工钩织，每件独一无二\n天然棉线，亲肤透气\n可定制颜色和尺寸'}
          value={productInfo.sellingPoints}
          onChange={(e) => onChange({ sellingPoints: e.target.value })}
          disabled={disabled}
          required
          fullWidth
          multiline
          minRows={3}
          maxRows={5}
          size="small"
          inputProps={{ maxLength: 500 }}
          helperText={`${productInfo.sellingPoints.length}/500 — 每行一个卖点，AI将为每帧分配不同卖点`}
        />

        <TextField
          label="目标受众"
          placeholder="例如：25-35岁女性，喜欢手工制品"
          value={productInfo.targetAudience || ''}
          onChange={(e) => onChange({ targetAudience: e.target.value })}
          disabled={disabled}
          fullWidth
          size="small"
          inputProps={{ maxLength: 100 }}
        />
      </Box>
    </Paper>
  );
}
