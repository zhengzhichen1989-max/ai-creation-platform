// ============================================================
// 智影工厂 ZhiyingWorks - 邮件发送服务 (nodemailer)
// ============================================================

import nodemailer from "nodemailer";
import { config } from "../config/index.js";

/** 创建 SMTP 传输器 */
function createTransporter() {
  return nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });
}

/** 发送密码重置邮件 */
export async function sendPasswordResetEmail(toEmail: string, resetToken: string): Promise<void> {
  const transporter = createTransporter();

  // 重置链接指向前端页面
  const resetUrl = `${config.publicBaseUrl}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"${config.email.fromName}" <${config.email.user}>`,
    to: toEmail,
    subject: "【智影工厂】密码重置",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f0f4ff;">
        <div style="background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="color: #1565c0; font-size: 26px; margin: 0; letter-spacing: 2px;">智影工厂</h1>
            <p style="color: #999; margin-top: 6px; font-size: 13px; letter-spacing: 1px;">ZhiyingWorks</p>
          </div>

          <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 16px;">密码重置申请</h2>
          <p style="color: #555; line-height: 1.6; margin-bottom: 24px;">
            您好！我们收到了您的密码重置请求。请点击下方按钮重置您的密码：
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="display: inline-block; background: linear-gradient(135deg, #1565c0, #1976d2); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; letter-spacing: 0.5px;">
              重置密码
            </a>
          </div>

          <div style="background: #e3f2fd; border-left: 4px solid #1565c0; padding: 16px; border-radius: 4px; margin-bottom: 24px;">
            <p style="margin: 0; color: #555; font-size: 14px;">⏰ 此链接 <strong>30分钟内有效</strong>，过期需重新申请。</p>
          </div>

          <p style="color: #888; font-size: 13px; line-height: 1.6;">
            如果您没有申请密码重置，请忽略此邮件。您的密码不会被修改。
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px; text-align: center;">
            智影工厂 ZhiyingWorks · AI智能创作平台<br/>
            如有疑问请联系客服微信咨询
          </p>
        </div>
      </div>
    `,
    text: `您好！\n\n请访问以下链接重置密码（30分钟内有效）：\n${resetUrl}\n\n如果您没有申请密码重置，请忽略此邮件。\n\n智影工厂 ZhiyingWorks`,
  };

  await transporter.sendMail(mailOptions);
}

/** 验证邮件配置是否可用（启动时检查） */
export async function verifyEmailConfig(): Promise<boolean> {
  if (!config.email.user || !config.email.pass) {
    console.warn("[email] 邮件配置未完整设置，密码找回功能不可用");
    return false;
  }
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log("[email] 邮件服务连接正常");
    return true;
  } catch (err) {
    console.warn("[email] 邮件服务连接失败:", (err as Error).message);
    return false;
  }
}
