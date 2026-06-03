// ============================================================
// AI创作聚合平台 - 支付路由
// ============================================================

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import * as orderService from "../services/order.service.js";
import * as wechatPayService from "../services/wechat-pay.service.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { successResponse } from "../utils/helpers.js";
import { ValidationError } from "../utils/errors.js";

const createOrderSchema = z.object({
  packageId: z.string().min(1, "积分包ID不能为空"),
});

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  /** POST /api/v1/payment/create-order - 创建支付订单（需认证） */
  app.post("/create-order", { preHandler: authMiddleware }, async (request, reply) => {
    const body = createOrderSchema.parse(request.body);
    const userId = request.userId!;

    const result = await orderService.createOrder(userId, body.packageId);

    reply.send(successResponse({
      orderId: result.orderId,
      codeUrl: result.codeUrl,
    }));
  });

  /** POST /api/v1/payment/notify - 微信支付回调通知（公开，不需认证） */
  app.post("/notify", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 获取原始body和请求头
      // 使用Fastify自定义parser保留的rawBody，确保签名验证时body与微信签名原文一致
      const rawBody = (request as any).rawBody || JSON.stringify(request.body);
      const headers = request.headers as Record<string, string | string[] | undefined>;

      // 验证微信回调签名并解密通知内容
      const notifyResult = await wechatPayService.verifyCallback(
        headers,
        rawBody
      );

      console.log(`[PaymentNotify] 收到支付通知: orderId=${notifyResult.orderId}, tradeState=${notifyResult.tradeState}`);

      // 只处理支付成功的通知
      if (notifyResult.tradeState === "SUCCESS") {
        orderService.handlePaymentSuccess(notifyResult.orderId, notifyResult.transactionId);
      }

      // 微信要求返回200 + 成功标识，否则会重复通知
      reply.code(200).send({
        code: "SUCCESS",
        message: "处理成功",
      });
    } catch (error) {
      console.error("[PaymentNotify] 处理微信回调失败:", error);

      // 返回失败，微信会重试通知
      reply.code(500).send({
        code: "FAIL",
        message: "处理失败",
      });
    }
  });

  /** GET /api/v1/payment/order-status/:orderId - 查询支付状态（需认证） */
  app.get<{ Params: { orderId: string } }>(
    "/order-status/:orderId",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const { orderId } = request.params;
      const userId = request.userId!;

      // 查询订单
      const order = orderService.getOrderById(orderId);
      if (!order) {
        reply.code(404).send({
          code: 404,
          data: null,
          message: "订单不存在",
        });
        return;
      }

      // 权限校验：只能查询自己的订单
      if (order.userId !== userId) {
        reply.code(403).send({
          code: 403,
          data: null,
          message: "无权查看此订单",
        });
        return;
      }

      // 如果订单状态为pending，检查是否已过期
      if (order.status === "pending") {
        const now = new Date();
        const expiredAt = new Date(order.expiredAt.replace(" ", "T"));
        if (now > expiredAt) {
          // 标记订单为过期
          orderService.expireOrders();
          // 重新查询订单状态
          const updatedOrder = orderService.getOrderById(orderId);
          reply.send(successResponse({
            orderId: updatedOrder!.id,
            status: updatedOrder!.status,
            amount: updatedOrder!.amount,
            credits: updatedOrder!.credits,
            packageId: updatedOrder!.packageId,
            createdAt: updatedOrder!.createdAt,
          }));
          return;
        }

        // 尝试主动查询微信支付状态（可选，作为兜底方案）
        try {
          const wxResult = await wechatPayService.queryOrder(orderId);
          if (wxResult.tradeState === "SUCCESS") {
            // 微信端已支付但本地未更新，主动处理
            orderService.handlePaymentSuccess(orderId, wxResult.transactionId);
            const updatedOrder = orderService.getOrderById(orderId);
            reply.send(successResponse({
              orderId: updatedOrder!.id,
              status: updatedOrder!.status,
              amount: updatedOrder!.amount,
              credits: updatedOrder!.credits,
              packageId: updatedOrder!.packageId,
              createdAt: updatedOrder!.createdAt,
            }));
            return;
          }
        } catch {
          // 查询微信失败，忽略，继续返回本地状态
        }
      }

      reply.send(successResponse({
        orderId: order.id,
        status: order.status,
        amount: order.amount,
        credits: order.credits,
        packageId: order.packageId,
        createdAt: order.createdAt,
      }));
    }
  );
}
