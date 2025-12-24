import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// R2 配置
const R2 = new S3Client({
  region: 'auto',
  endpoint: 'https://1e07f2edc2a30fb53ed0e4afdc636238.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: '56ed4d953bbb4dc0bbe9d59c11b5315f',
    secretAccessKey: '80d90f06cf2dfc2104e89be8b5edda36c5e4c83cb90e460b2f4bff50bad6ad0c'
  }
});

const BUCKET = 'gallery';
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

async function listAllImages() {
  const images = [];
  let continuationToken;

  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken
    });
    const response = await R2.send(command);
    
    for (const obj of response.Contents || []) {
      const key = obj.Key;
      // 跳过预览图目录
      if (key.startsWith('0_preview/')) continue;
      // 跳过非图片文件
      const ext = '.' + key.split('.').pop().toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) continue;
      images.push(key);
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return images;
}

async function generatePreview(imageKey) {
  try {
    // 下载原图
    const getCommand = new GetObjectCommand({ Bucket: BUCKET, Key: imageKey });
    const response = await R2.send(getCommand);
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 使用 sharp 生成 400px 预览图
    const previewBuffer = await sharp(buffer)
      .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 60 })
      .toBuffer();

    // 上传预览图
    const parts = imageKey.split('/');
    const category = parts[0];
    const fileName = parts[parts.length - 1];
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const previewKey = `0_preview/${category}/${baseName}.webp`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: previewKey,
      Body: previewBuffer,
      ContentType: 'image/webp'
    });
    await R2.send(putCommand);

    return { success: true, key: previewKey, size: previewBuffer.length };
  } catch (error) {
    return { success: false, key: imageKey, error: error.message };
  }
}

async function main() {
  console.log('正在获取图片列表...');
  const images = await listAllImages();
  console.log(`找到 ${images.length} 张图片需要处理\n`);

  let success = 0, failed = 0;
  
  for (let i = 0; i < images.length; i++) {
    const key = images[i];
    process.stdout.write(`\r处理中: ${i + 1}/${images.length} - ${key.substring(0, 50)}...`);
    
    const result = await generatePreview(key);
    if (result.success) {
      success++;
    } else {
      failed++;
      console.log(`\n  失败: ${result.error}`);
    }
  }

  console.log(`\n\n完成! 成功: ${success}, 失败: ${failed}`);
}

main().catch(console.error);
