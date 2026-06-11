// ============================================================
// 智影工厂 - 隐私政策页面
// ============================================================

import { Container, Typography, Box, Paper, Divider } from '@mui/material';

export default function PrivacyPage() {
  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          隐私政策
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          生效日期：2026年6月1日
        </Typography>
        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" fontWeight={600} gutterBottom>
          核心要点
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          以下为注册页面已展示的核心要点，完整内容如下：
        </Typography>

        {/* 1. 我们收集什么 */}
        <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
          一、我们收集什么
        </Typography>
        <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
          <li>
            <Typography variant="body1">
              <strong>身份信息：</strong>手机号（用于实名核验）。
            </Typography>
          </li>
          <li>
            <Typography variant="body1">
              <strong>行为信息：</strong>提示词（Prompt）、生成任务记录、操作日志、IP地址、设备信息。
            </Typography>
          </li>
          <li>
            <Typography variant="body1">
              <strong>内容数据：</strong>您上传的图片/视频及生成的图片/视频数据。
            </Typography>
          </li>
        </Box>

        {/* 2. 我们怎么用 */}
        <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
          二、我们怎么用
        </Typography>
        <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
          <li>
            <Typography variant="body1">
              用于提供生成服务、账号管理、安全风控（识别违规 Prompt 和内容）及产品优化。
            </Typography>
          </li>
          <li>
            <Typography variant="body1">
              不会将您的提示词和生成内容用于未经授权的商业训练或对外出售。
            </Typography>
          </li>
        </Box>

        {/* 3. 留存期限 */}
        <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
          三、留存期限
        </Typography>
        <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
          <li>
            <Typography variant="body1">
              账号存续期间持续保存。
            </Typography>
          </li>
          <li>
            <Typography variant="body1">
              账号注销后或生成任务结束后，相关数据依法留存不少于 6 个月，以配合网络安全监管与执法调查，期满后按规定销毁。
            </Typography>
          </li>
        </Box>

        {/* 4. 数据共享 */}
        <Typography variant="h6" fontWeight={600} gutterBottom sx={{ mt: 3 }}>
          四、数据共享
        </Typography>
        <Box component="ul" sx={{ pl: 2, '& li': { mb: 0.5 } }}>
          <li>
            <Typography variant="body1">
              除依法配合监管部门、公安机关调查取证外，未经您同意，我们不会向第三方共享您的数据。
            </Typography>
          </li>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Typography variant="body1">
          广州寅客商贸有限公司
        </Typography>
        <Typography variant="body1">
          2026年6月1日
        </Typography>
      </Paper>
    </Container>
  );
}
