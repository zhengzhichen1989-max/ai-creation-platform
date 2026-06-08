import { useState } from 'react';
import {
  Box,
  Paper,
  IconButton,
  Typography,
  Tooltip,
  Fade,
  Divider,
} from '@mui/material';
import WechatIcon from '@mui/icons-material/Chat';
import CloseIcon from '@mui/icons-material/Close';
import HeadsetMicIcon from '@mui/icons-material/HeadsetMic';

/**
 * 客服微信二维码悬浮组件
 * 固定在页面右下角，点击展开/收起微信二维码
 *
 * 使用方式：
 * 1. 将微信二维码图片放到 /public/wechat-qr.png
 * 2. 在 AppLayout 中引入此组件
 */
export default function CustomerService() {
  const [open, setOpen] = useState(false);

  // 二维码图片路径 —— 替换为你的微信二维码图片（放到 public/ 目录）
  const qrImageSrc = '/wechat-qr.png';

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 32,
        right: 24,
        zIndex: 1300,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1,
      }}
    >
      {/* 展开的客服卡片 */}
      <Fade in={open}>
        <Paper
          elevation={8}
          sx={{
            width: 220,
            borderRadius: 3,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          {/* 标题栏 */}
          <Box
            sx={{
              px: 2,
              py: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              color: 'white',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WechatIcon fontSize="small" />
              <Typography variant="subtitle2" fontWeight={600}>
                微信客服
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              sx={{ color: 'white', p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>

          {/* 二维码区域 */}
          <Box sx={{ p: 2, textAlign: 'center' }}>
            <Box
              component="img"
              src={qrImageSrc}
              alt="微信客服二维码"
              sx={{
                width: 160,
                height: 160,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                objectFit: 'cover',
                display: 'block',
                mx: 'auto',
                // 图片加载失败时显示占位背景
                bgcolor: 'grey.100',
              }}
              onError={(e) => {
                // 图片不存在时显示占位提示
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent && !parent.querySelector('.qr-placeholder')) {
                  const placeholder = document.createElement('div');
                  placeholder.className = 'qr-placeholder';
                  placeholder.style.cssText = `
                    width: 160px; height: 160px; border-radius: 8px;
                    border: 2px dashed #ccc; display: flex; flex-direction: column;
                    align-items: center; justify-content: center; margin: 0 auto;
                    background: #f9f9f9; color: #999; font-size: 13px; text-align: center; padding: 16px;
                    box-sizing: border-box;
                  `;
                  placeholder.innerHTML = '🖼️<br/><br/>请将微信二维码<br/>图片放置到<br/>/public/wechat-qr.png';
                  parent.insertBefore(placeholder, e.target as HTMLImageElement);
                }
              }}
            />

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="caption" color="text.secondary" display="block">
              扫码添加微信
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              有任何问题欢迎咨询
            </Typography>
          </Box>

          {/* 底部提示 */}
          <Box
            sx={{
              px: 2,
              py: 1,
              bgcolor: 'action.hover',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" color="text.secondary">
              工作日 9:00 - 22:00 在线
            </Typography>
          </Box>
        </Paper>
      </Fade>

      {/* 悬浮按钮 */}
      <Tooltip title={open ? '' : '联系客服'} placement="left">
        <Box
          onClick={() => setOpen(!open)}
          sx={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: open
              ? 'linear-gradient(135deg, #6b21a8, #7c3aed)'
              : 'linear-gradient(135deg, #7c3aed, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(124, 58, 237, 0.4)',
            transition: 'all 0.2s ease',
            color: 'white',
            '&:hover': {
              transform: 'scale(1.08)',
              boxShadow: '0 6px 20px rgba(124, 58, 237, 0.5)',
            },
          }}
        >
          {open ? (
            <CloseIcon />
          ) : (
            <HeadsetMicIcon />
          )}
        </Box>
      </Tooltip>
    </Box>
  );
}
