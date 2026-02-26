/**
 * ============================================================================
 * 文件: src/app/api/upload/route.ts
 * 目录: 文件上传 API
 * 功能: 
 *   - POST: 上传图片到S3存储
 *   - 支持多种S3兼容服务（AWS S3、阿里云OSS等）
 *   - 返回签名URL（有效期7天）
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// S3 客户端配置
function getS3Client() {
  const endpoint = process.env.COZE_BUCKET_ENDPOINT_URL || process.env.S3_ENDPOINT_URL;
  const region = process.env.S3_REGION || 'auto';
  const accessKey = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
  const secretKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';

  if (!endpoint) {
    throw new Error('S3 endpoint URL is not configured');
  }

  return new S3Client({
    region,
    endpoint,
    credentials: accessKey && secretKey ? {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    } : undefined,
    // 对于某些 S3 兼容服务（如 Cloudflare R2）需要禁用路径样式
    forcePathStyle: endpoint.includes('amazonaws.com') ? false : true,
  });
}

function getBucketName() {
  return process.env.COZE_BUCKET_NAME || process.env.S3_BUCKET_NAME || '';
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 });
    }

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '只能上传图片文件' }, { status: 400 });
    }

    // 检查文件大小（最大 10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '图片大小不能超过 10MB' }, { status: 400 });
    }

    const bucketName = getBucketName();
    if (!bucketName) {
      return NextResponse.json({ error: 'S3 存储桶未配置' }, { status: 500 });
    }

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成文件名
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `leave-images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    // 上传到 S3
    const client = getS3Client();
    
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: buffer,
      ContentType: file.type,
    }));

    // 生成访问 URL（有效期 7 天）
    // 使用 any 类型绕过 AWS SDK 版本兼容问题
    const imageUrl = await (getSignedUrl as any)(
      client,
      new GetObjectCommand({
        Bucket: bucketName,
        Key: fileName,
      }),
      { expiresIn: 7 * 24 * 60 * 60 }
    );

    return NextResponse.json({
      success: true,
      key: fileName,
      imageUrl,
    });
  } catch (error) {
    console.error('上传失败:', error);
    const errorMessage = error instanceof Error ? error.message : '上传失败';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
