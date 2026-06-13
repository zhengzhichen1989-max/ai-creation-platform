import { useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Tooltip,
  Alert,
} from '@mui/material';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import type { LockedItem, ItemCategory } from '@/types/shouzuo';
import { ITEM_CATEGORIES } from '@/types/shouzuo';

interface ItemLockSelectorProps {
  lockedItems: LockedItem[];
  detectingItemCategory: ItemCategory | null;
  isItemDetecting: boolean;
  onLockItem: (category: ItemCategory) => void;
  onUnlockItem: (category: ItemCategory) => void;
  onInitLockedItems: () => void;
}

export default function ItemLockSelector({
  lockedItems,
  detectingItemCategory,
  isItemDetecting,
  onLockItem,
  onUnlockItem,
  onInitLockedItems,
}: ItemLockSelectorProps) {
  // 初始化锁定列表（首次渲染时，使用 useRef 防止重复触发）
  const initRef = useRef(false);
  useEffect(() => {
    if (lockedItems.length === 0 && !initRef.current) {
      initRef.current = true;
      onInitLockedItems();
    }
  }, [lockedItems.length, onInitLockedItems]);

  const lockedCount = lockedItems.filter((i) => i.locked).length;

  const handleToggle = (category: ItemCategory) => {
    const item = lockedItems.find((i) => i.category === category);
    if (item?.locked) {
      onUnlockItem(category);
    } else {
      onLockItem(category);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderColor: 'warning.main', borderWidth: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <LockIcon sx={{ color: 'warning.main', fontSize: 20 }} />
        <Typography variant="subtitle1" fontWeight={600}>
          商品锁定
        </Typography>
        {lockedCount > 0 && (
          <Chip
            label={`${lockedCount}项已锁定`}
            color="warning"
            size="small"
            sx={{ ml: 1, height: 22 }}
          />
        )}
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        锁定商品后，AI生成视频时会保持锁定商品的外观一致（颜色/款式/材质不变）。
        AI会自动裁剪锁定商品区域作为额外参考图。
      </Typography>

      {lockedCount > 0 && (
        <Alert severity="info" sx={{ mb: 2, py: 0 }}>
          <Typography variant="body2">
            {lockedItems.filter((i) => i.locked).map((i) => i.category).join('、')}将被保持不变
            {lockedItems.some((i) => i.locked && i.croppedImageUrl) && ' · 裁剪参考图已就绪'}
          </Typography>
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        {ITEM_CATEGORIES.map((cat) => {
          const item = lockedItems.find((i) => i.category === cat.key);
          const isLocked = item?.locked ?? false;
          const isDetecting = detectingItemCategory === cat.key && isItemDetecting;
          const hasCrop = item?.croppedImageUrl != null;

          return (
            <Paper
              key={cat.key}
              variant="outlined"
              sx={{
                p: 1.5,
                cursor: isDetecting ? 'wait' : 'pointer',
                borderColor: isLocked ? 'warning.main' : 'divider',
                borderWidth: isLocked ? 2 : 1,
                bgcolor: isLocked ? 'warning.50' : 'background.paper',
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: isLocked ? 'warning.dark' : 'warning.light',
                  bgcolor: isLocked ? 'warning.100' : 'action.hover',
                },
                minWidth: 110,
                textAlign: 'center',
                opacity: isDetecting ? 0.7 : 1,
              }}
              onClick={() => !isDetecting && handleToggle(cat.key)}
            >
              <Typography fontSize="1.3rem">{cat.icon}</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mt: 0.5 }}>
                {cat.label}
              </Typography>

              {isDetecting && (
                <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="warning.main">检测中...</Typography>
                </Box>
              )}

              {!isDetecting && isLocked && (
                <Tooltip title={item?.itemDescription || `${cat.key}已锁定`}>
                  <Chip
                    icon={hasCrop ? <AutoFixHighIcon sx={{ fontSize: 14 }} /> : <LockIcon sx={{ fontSize: 14 }} />}
                    label={hasCrop ? '锁定+裁剪' : '已锁定'}
                    color="warning"
                    size="small"
                    sx={{ mt: 0.5, height: 22, fontSize: '0.7rem' }}
                  />
                </Tooltip>
              )}

              {!isDetecting && !isLocked && (
                <Chip
                  icon={<LockOpenIcon sx={{ fontSize: 14 }} />}
                  label="未锁定"
                  variant="outlined"
                  size="small"
                  sx={{ mt: 0.5, height: 22, fontSize: '0.7rem', color: 'text.secondary' }}
                />
              )}

              {/* 裁剪缩略图预览 */}
              {isLocked && hasCrop && item?.croppedImageUrl && (
                <Box sx={{ mt: 1 }}>
                  <img
                    src={item.croppedImageUrl}
                    alt={`${cat.key}裁剪参考`}
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: 'cover',
                      borderRadius: 4,
                      border: '1px solid #e0e0e0',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>

      {/* 快捷操作 */}
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        <Chip
          label="全部锁定"
          color="warning"
          variant="outlined"
          icon={<LockIcon />}
          onClick={() => {
            ITEM_CATEGORIES.forEach((cat) => {
              const item = lockedItems.find((i) => i.category === cat.key);
              if (!item?.locked) {
                onLockItem(cat.key);
              }
            });
          }}
          sx={{ cursor: 'pointer' }}
        />
        <Chip
          label="全部解锁"
          variant="outlined"
          icon={<LockOpenIcon />}
          onClick={() => {
            lockedItems.filter((i) => i.locked).forEach((item) => {
              onUnlockItem(item.category);
            });
          }}
          sx={{ cursor: 'pointer' }}
        />
      </Box>
    </Paper>
  );
}