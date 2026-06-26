import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerSmartVideoRoutes(fastify: FastifyInstance) {

  // Health check - no auth needed
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: Date.now(),
      version: 'v7-minimal'
    };
  });

  // Test endpoint
  fastify.get('/test', async (request, reply) => {
    return {
      message: 'Smart Video API is working',
      endpoints: [
        '/health',
        '/test',
        '/upload-images',
        '/generate-script',
        '/generate-video'
      ]
    };
  });

}
