/**
 * 图片压缩工具
 * 上传前将图片压缩到指定尺寸，减少请求体大小
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  type?: string; // 输出格式，默认保持原格式
}

/**
 * 将 File 对象压缩为新的 File 对象
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的 File（如果不需要压缩则返回原文件）
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.85, type } = options;

  // 如果文件已经很小（< 500KB），直接返回原文件
  if (file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // 计算缩放比例
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      // 如果尺寸没有变化且质量设置合理，直接返回原文件
      if (width === img.width && height === img.height && file.size < 2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建 canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      const outputType = type || file.type || 'image/jpeg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('图片压缩失败'));
            return;
          }

          // 生成新文件名（保持原扩展名或根据输出格式调整）
          const ext = outputType === 'image/png' ? 'png' : 'jpg';
          const newName = file.name.replace(/\.[^.]+$/, '') + `_compressed.${ext}`;

          const compressedFile = new File([blob], newName, {
            type: outputType,
            lastModified: Date.now(),
          });

          console.log(
            `[Compress] ${file.name}: ${(file.size / 1024).toFixed(1)}KB -> ${(
              compressedFile.size / 1024
            ).toFixed(1)}KB (${width}x${height})`
          );

          resolve(compressedFile);
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      // 压缩失败时返回原文件，不阻断流程
      resolve(file);
    };

    img.src = url;
  });
}
