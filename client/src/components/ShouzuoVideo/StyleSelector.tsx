import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { StyleTemplate } from '@/types/shouzuo';

interface StyleSelectorProps {
  styles: StyleTemplate[];
  selectedId?: string;
  onSelect: (styleId: string) => void;
}

/** 风格配色映射 */
const STYLE_COLORS: Record<string, string> = {
  '森系': '#4A7C59',
  '日系': '#D4A574',
  '复古': '#8B4513',
  '极简': '#607D8B',
  '氛围感': '#9C27B0',
};

export default function StyleSelector({ styles, selectedId, onSelect }: StyleSelectorProps) {
  if (styles.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">正在分析图片风格...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Step 3: 选择风格模板
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        AI 已根据你的产品图推荐了以下风格，请选择你喜欢的
      </Typography>

      <Grid container spacing={2}>
        {styles.map((style) => {
          const isSelected = style.id === selectedId;
          const accentColor = STYLE_COLORS[style.name] || '#1976d2';

          return (
            <Grid item xs={12} sm={4} key={style.id}>
              <Card
                variant={isSelected ? 'elevation' : 'outlined'}
                elevation={isSelected ? 4 : 0}
                sx={{
                  position: 'relative',
                  borderColor: isSelected ? accentColor : 'divider',
                  borderWidth: isSelected ? 2 : 1,
                  bgcolor: isSelected ? `${accentColor}10` : 'background.paper',
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: accentColor, transform: 'translateY(-2px)' },
                }}
              >
                <CardActionArea onClick={() => onSelect(style.id)}>
                  <CardContent>
                    {isSelected && (
                      <CheckCircleIcon
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          color: accentColor,
                          fontSize: 20,
                        }}
                      />
                    )}
                    <Typography variant="subtitle1" fontWeight={600} sx={{ color: accentColor }}>
                      {style.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
                      {style.description}
                    </Typography>
                    <Chip
                      label={style.name}
                      size="small"
                      sx={{
                        bgcolor: `${accentColor}20`,
                        color: accentColor,
                        fontWeight: 500,
                      }}
                    />
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
