// ============================================================
// 玩具AI视频生成器 - 路由 V1.0
// ============================================================

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import fp from 'fastify-plugin';
import {
  analyzeProductImage,
  generateStoryboard,
  createTask,
  updateTaskStatus,
  getTask,
  getUserTasks,
  CONTENT_TEMPLATES,
  SUPPORTED_LANGUAGES,
  SUPPORTED_SIZES,
} from '../services/toy-video.service.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { chargeCredits, refundCredits } from '../services/credits.service.js';
import path from 'path';
import fs from 'fs';
import { config } from '../config/index.js';

async function toyVideoRoutes(app: FastifyInstance, opts: FastifyPluginOptions) {
  /** 获取支持的模板列表 */
  app.get('/templates', async (request, reply) => {
    const templates = Object.entries(CONTENT_TEMPLATES).map(([id, t]: [string, any]) => ({
      id,
      name: t.name,
      category: t.category,
      duration: t.duration,
      shotCount: t.shots.length,
    }));
    return { code: 200, data: templates, message: 'success' };
  });

  /** 获取支持的语言列表 */
  app.get('/languages', async (request, reply) => {
    const languages = SUPPORTED_LANGUAGES.map(lang => ({
      value: lang,
      label: lang === 'zh' ? '中文' : lang === 'en' ? 'English' : 'Español',
    }));
    return { code: 200, data: languages, message: 'success' };
  });

  /** 获取支持的尺寸列表 */
  app.get('/sizes', async (request, reply) => {
    return { code: 200, data: SUPPORTED_SIZES, message: 'success' };
  });

  /** 分析产品图片 */
  app.post('/analyze-image', {
    preHandler: [authenticate],
  }, async (request: any, reply) => {
    const { imageUrl } = request.body as { imageUrl: string };
    
    if (!imageUrl) {
      return reply.status(400).send({ code: 400, message: '缺少图片URL' });
    }

    try {
      const analysis = await analyzeProductImage(imageUrl);
      return { code: 200, data: analysis, message: '分析成功' };
    } catch (error: any) {
      return reply.status(500).send({ code: 500, message: error.message || '分析失败' });
    }
  });

  /** 生成故事板（分镜脚本） */
  app.post('/generate-storyboard', {
    preHandler: [authenticate],
  }, async (request: any, reply) => {
    const userId = (request as any).user.userId;
    const {
      templateId,
      productInfo,
      language,
    } = request.body as {
      templateId: string;
      productInfo: any;
      language: string;
    };

    if (!templateId || !productInfo || !language) {
      return reply.status(400).send({ code: 400, message: '缺少必要参数' });
    }

    // 扣除积分（故事板生成约 3 积分）
    try {
      await chargeCredits(userId, 3, `玩具视频故事板生成: ${templateId}`, 'toy_video_storyboard');
    } catch (error: any) {
      return reply.status(402).send({ code: 402, message: '积分不足' });
    }

    try {
      const storyboard = await generateStoryboard({
        templateId,
        productInfo,
        language,
      });
      return { code: 200, data: storyboard, message: '故事板生成成功' };
    } catch (error: any) {
      // 退款
      await refundCredits(userId, 3, 'toy_video_storyboard_refund', '故事板生成失败退款');
      return reply.status(500).send({ code: 500, message: error.message || '生成失败' });
    }
  });

  /** 创建视频生成任务 */
  app.post('/create-task', {
    preHandler: [authenticate],
  }, async (request: any, reply) => {
    const userId = (request as any).user.userId;
    const {
      templateId,
      language,
      size,
      productInfo,
      storyboard,
    } = request.body as {
      templateId: string;
      language: string;
      size: string;
      productInfo: any;
      storyboard: any;
    };

    if (!templateId || !language || !size || !storyboard) {
      return reply.status(400).send({ code: 400, message: '缺少必要参数' });
    }

    // 估算积分（视频生成约 50-100 积分）
    const estimatedCredits = 80;
    try {
      await chargeCredits(userId, estimatedCredits, `玩具视频生成: ${templateId}`, 'toy_video_generation');
    } catch (error: any) {
      return reply.status(402).send({ code: 402, message: '积分不足' });
    }

    try {
      const taskId = await createTask({
        userId,
        templateId,
        language,
        size,
        productInfo,
      });

      // TODO: 异步处理视频生成（调用 Kling 3.0 API）
      // 这里先返回任务ID，前端轮询状态
      updateTaskStatus(taskId, 'processing');

      return {
        code: 200,
        data: { taskId, estimatedCredits },
        message: '任务已创建，正在生成中',
      };
    } catch (error: any) {
      await refundCredits(userId, estimatedCredits, 'toy_video_generation_refund', '视频生成失败退款');
      return reply.status(500).send({ code: 500, message: error.message || '创建任务失败' });
    }
  });

  /** 获取任务状态 */
  app.get('/task/:taskId', {
    preHandler: [authenticate],
  }, async (request: any, reply) => {
    const { taskId } = request.params as { taskId: string };
    const userId = (request as any).user.userId;

    const task = await getTask(taskId);
    if (!task) {
      return reply.status(404).send({ code: 404, message: '任务不存在' });
    }

    // 检查权限
    if (task.user_id !== userId) {
      return reply.status(403).send({ code: 403, message: '无权限' });
    }

    return { code: 200, data: task, message: 'success' };
  });

  /** 获取用户的任务列表 */
  app.get('/tasks', {
    preHandler: [authenticate],
  }, async (request: any, reply) => {
    const userId = (request as any).user.userId;
    const tasks = await getUserTasks(userId);
    return { code: 200, data: tasks, message: 'success' };
  });
}

export default fp(toyVideoRoutes, { prefix: '/api/v1/toy-video' });
