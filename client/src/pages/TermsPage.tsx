import { Container, Typography, Box, Card, CardContent, Divider } from '@mui/material';

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Box sx={{ mb: 3 }}>
    <Typography variant="h6" gutterBottom>{title}</Typography>
    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 2, whiteSpace: 'pre-wrap' }}>
      {children}
    </Typography>
  </Box>
);

export default function TermsPage() {
  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 8 }}>
      <Card sx={{ borderRadius: 2 }}>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="h4" gutterBottom fontWeight="bold">
            服务协议
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            （AI 生图 / 视频 · 算力 & 大模型调用版）
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            生效日期：2026年6月1日
          </Typography>

          <Typography variant="body1" paragraph color="text.secondary" sx={{ lineHeight: 2 }}>
            欢迎使用本平台（以下简称"平台"）。在使用我们的 AI 图像/视频生成服务（下称"本服务"）前，请您仔细阅读并理解本协议的全部内容。
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Section title="一、服务说明">
            1. 本平台系生成式人工智能（AIGC）技术服务商，通过调用第三方或自建大模型，为用户提供基于算力资源的 AI 内容生成能力。{"\n"}
            2. 本服务仅为用户提供技术工具支持，不保证生成内容的准确性、完整性和时效性，用户应自行判断生成内容的使用风险。
          </Section>

          <Section title="二、账号与身份核验">
            1. 您必须使用本人实名手机号完成注册与核验。{"\n"}
            2. 您承诺提供的注册信息真实、准确、完整。因信息不实导致的服务中断或法律责任，由您自行承担。
          </Section>

          <Section title="三、用户行为规范（重点）">
            您承诺严格遵守《网络安全法》《生成式人工智能服务管理暂行办法》等法律法规，不得利用本服务从事以下活动：{"\n"}
            1. 制作、复制、发布、传播涉政、暴恐、色情、赌博、诈骗、侵犯他人隐私或深度伪造（Deepfake）等违法有害信息；{"\n"}
            2. 研发、训练或部署用于规避平台安全风控的对抗性工具；{"\n"}
            3. 对他人进行网络攻击、骚扰、诽谤或侵害他人合法权益；{"\n"}
            4. 利用本平台算力资源进行加密货币挖矿或其他非约定用途的计算任务。
          </Section>

          <Section title={'四、关于"算力提供与技术中立"的责任界定'}>
            1. 用户主责原则：本平台仅依据您输入的提示词（Prompt）调用大模型生成结果。您对输入内容的合法性、以及生成内容的后续使用行为承担全部法律责任。{"\n"}
            2. 平台免责边界：平台已依法履行算法备案、安全评估、内容风控及日志留存等法定义务。对于您规避平台安全策略、采用隐晦提示词诱导生成违规内容所产生的后果，平台不承担连带赔偿责任或行政责任。{"\n"}
            3. 处置权利：若您的行为违反法律法规或本协议，平台有权在不事先通知的情况下，采取限制生成、封禁账号、销毁违规数据等措施，并保留向有关监管部门举报的权利。
          </Section>

          <Section title="五、知识产权">
            1. 在遵守法律法规及本协议的前提下，您对使用本服务生成的内容享有相应权益，但不得侵害他人肖像权、著作权等合法权益。{"\n"}
            2. 平台保留对本服务底层模型、算法架构及相关技术的全部知识产权。
          </Section>

          <Section title="六、隐私保护">
            我们严格按照《隐私政策》收集、存储和使用您的个人信息（包括手机号、提示词、生成记录等），并采取加密措施保障数据安全。详情请参阅《隐私政策》。
          </Section>

          <Section title="七、法律适用">
            本协议适用中华人民共和国法律。因使用本服务产生争议的，由平台所在地人民法院管辖。
          </Section>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body1" fontWeight="bold">
            广州寅客商贸有限公司
          </Typography>
          <Typography variant="body2" color="text.secondary">
            2026年6月1日
          </Typography>
        </CardContent>
      </Card>
    </Container>
  );
}
