// ============================================================
// 服饰短片 - AI图片分析结果展示组件
// ============================================================

import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Stack,
  Paper,
  CircularProgress,
  Fade,
} from '@mui/material';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Analytics from '@mui/icons-material/Analytics';
import Palette from '@mui/icons-material/Palette';
import Category from '@mui/icons-material/Category';
import Texture from '@mui/icons-material/Texture';
import type { ShouzuoImageAnalysis, StyleTemplateId, StyleTemplateInfo } from '@/api/shouzuoVideo';

/** 风格模板颜色映射 */
const STYLE_COLORS: Record<string, string> = {
  morihealing: '#8BC34A',
  japanfresh: '#80DEEA',
  retroart: '#D7CCC8',
  cinematic: '#5C6BC0',
  minimalist: '#BDBDBD',
};

/** 风格模板图标映射 */
const STYLE_ICONS: Record<string, string> = {
  morihealing: '🌿',
  japanfresh: '🎐',
  retroart: '🕯️',
  cinematic: '🎬',
  minimalist: '▪️',
};

interface ImageAnalysisResultProps {
  analysis: ShouzuoImageAnalysis | null;
  isLoading: boolean;
  styleTemplates: StyleTemplateInfo[];
  selectedTemplate: StyleTemplateId | null;
  onSelectTemplate: (templateId: StyleTemplateId) => void;
}

export default function ImageAnalysisResult({
  analysis,
  isLoading,
  styleTemplates,
  selectedTemplate,
  onSelectTemplate,
}: ImageAnalysisResultProps) {
  if (isLoading) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <CircularProgress size={40} sx={{ mb: 2 }} />
        <Typography variant="body1" color="text.secondary">
          AI正在分析你的产品图片...
        </Typography>
        <Typography variant="caption" color="text.disabled">
          识别品类、颜色、材质，推荐最佳风格模板
        </Typography>
      </Box>
    );
  }

  if (!analysis) return null;

  // 查找模板名称
  const getTemplateName = (templateId: string): string => {
    const t = styleTemplates.find((s) => s.id === templateId);
    return t?.name ?? templateId;
  };

  return (
    <Fade in={true} timeout={500}>
      <Box>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          AI分析结果
        </Typography>

        <Stack spacing={2}>
          {/* 品类 & 颜色 & 材质 */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: '1 1 180px' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Category sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="caption" color="text.secondary">识别品类</Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysis.category}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: '1 1 180px' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Palette sx={{ fontSize: 18, color: 'secondary.main' }} />
                <Typography variant="caption" color="text.secondary">主色调</Typography>
              </Stack>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {analysis.colors.map((color, i) => (
                  <Chip key={i} label={color} size="small" sx={{ fontSize: 11, height: 22 }} />
                ))}
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, flex: '1 1 180px' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <Texture sx={{ fontSize: 18, color: 'info.main' }} />
                <Typography variant="caption" color="text.secondary">材质风格</Typography>
              </Stack>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{analysis.material}</Typography>
            </Paper>
          </Box>

          {/* AI推荐风格 */}
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <Analytics sx={{ fontSize: 20, color: 'warning.main' }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                AI推荐风格模板
              </Typography>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 1.5 }}>
              {analysis.styleRecommendations.map((rec, index) => {
                const isSelected = selectedTemplate === rec.templateId;
                const template = styleTemplates.find((t) => t.id === rec.templateId);

                return (
                  <Card
                    key={rec.templateId}
                    onClick={() => onSelectTemplate(rec.templateId as StyleTemplateId)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      border: isSelected ? '2px solid' : '2px solid transparent',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      bgcolor: isSelected ? 'primary.50' : 'background.paper',
                      transition: 'all 0.2s',
                      position: 'relative',
                      '&:hover': {
                        borderColor: 'primary.light',
                        transform: 'translateY(-2px)',
                        boxShadow: 2,
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Chip
                          label={`推荐${index + 1}`}
                          size="small"
                          color={index === 0 ? 'warning' : 'default'}
                          sx={{ fontSize: 10, height: 20 }}
                        />
                        {isSelected && (
                          <CheckCircle color="primary" sx={{ fontSize: 18 }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <span style={{ fontSize: 20 }}>{STYLE_ICONS[rec.templateId] || '🎨'}</span>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {template?.name ?? rec.templateId}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {rec.reason}
                      </Typography>
                      {template && (
                        <Chip
                          label={template.colorTone}
                          size="small"
                          sx={{
                            fontSize: 10,
                            height: 20,
                            bgcolor: STYLE_COLORS[rec.templateId] + '33',
                            color: STYLE_COLORS[rec.templateId],
                          }}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Box>

          {/* 总结 */}
          {analysis.summary && (
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary">
                💡 {analysis.summary}
              </Typography>
            </Paper>
          )}
        </Stack>
      </Box>
    </Fade>
  );
}
