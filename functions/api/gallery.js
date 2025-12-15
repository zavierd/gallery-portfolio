// 动态获取图片列表 API
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const gallery = {};
    let totalImages = 0;

    // 列出 R2 中的所有对象
    let cursor = undefined;
    const allObjects = [];

    do {
      const listed = await env.R2_BUCKET.list({ cursor });
      allObjects.push(...listed.objects);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // 获取 R2 公开 URL（从环境变量）
    const baseUrl = env.R2_PUBLIC_URL || 'https://gallery.aicc0.com';

    // 按分类整理图片
    for (const obj of allObjects) {
      const key = obj.key;
      if (!key) continue;

      // 跳过预览图目录
      if (key.startsWith('0_preview/')) continue;

      // 检查是否是图片文件
      const ext = '.' + key.split('.').pop().toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(ext)) continue;

      // 解析分类和文件名
      const parts = key.split('/');
      if (parts.length < 2) continue;

      const category = parts[0];
      const fileName = parts[parts.length - 1];
      const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
      const fileExt = fileName.split('.').pop();

      const imageInfo = {
        name: baseName,
        original: `${baseUrl}/${category}/${fileName}`,
        preview: `${baseUrl}/0_preview/${category}/${baseName}.webp`,
        category: category
      };

      if (!gallery[category]) {
        gallery[category] = {
          name: category,
          images: [],
          count: 0
        };
      }

      gallery[category].images.push(imageInfo);
      gallery[category].count++;
      totalImages++;
    }

    // 排序图片
    for (const cat of Object.values(gallery)) {
      cat.images.sort((a, b) => a.name.localeCompare(b.name));
    }

    const result = {
      gallery: gallery,
      total_images: totalImages,
      generated_at: new Date().toISOString()
    };

    return new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    console.error('获取图片列表失败:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
