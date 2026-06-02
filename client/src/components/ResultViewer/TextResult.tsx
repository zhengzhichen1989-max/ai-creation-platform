import { Box, Typography, Button } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useState } from 'react';
import type { GenerationTask } from '@/api/tasks';

interface TextResultProps {
  task: GenerationTask;
}

export function TextResult({ task }: TextResultProps) {
  const resultUrl = task.resultUrl;
  const [copied, setCopied] = useState(false);

  if (!resultUrl) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography color="text.secondary">结果暂不可用</Typography>
      </Box>
    );
  }

  const handleCopy = async () => {
    try {
      // If resultUrl is a relative path to uploaded text file, fetch and copy
      const response = await fetch(resultUrl);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: copy the URL itself
      try {
        await navigator.clipboard.writeText(resultUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard API not available
      }
    }
  };

  return (
    <Box>
      <Box
        sx={{
          borderRadius: 2,
          bgcolor: '#f5f5f5',
          p: 3,
          mb: 2,
          maxHeight: 400,
          overflow: 'auto',
        }}
      >
        {/* Display link to text file or embedded content */}
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          文案已生成，请查看下方文件
        </Typography>
        <Box sx={{ mt: 2 }}>
          <a
            href={resultUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#6200ee', textDecoration: 'underline' }}
          >
            查看文案内容
          </a>
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        提示词：{task.prompt}
      </Typography>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          href={resultUrl}
          download
          size="small"
        >
          下载文案
        </Button>
        <Button
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          onClick={handleCopy}
          size="small"
        >
          {copied ? '已复制' : '复制内容'}
        </Button>
      </Box>
    </Box>
  );
}
