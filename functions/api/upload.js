export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category');
    const generatePreview = formData.get('generatePreview') === 'true';

    if (!file || !category) {
      return new Response(JSON.stringify({ error: '缺少文件或分类' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileName = file.name;
    const fileExt = fileName.split('.').pop().toLowerCase();
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const contentType = file.type || 'image/jpeg';

    // 上传原图到 R2
    const originalKey = `${category}/${fileName}`;
    const fileBuffer = await file.arrayBuffer();
    
    await env.R2_BUCKET.put(originalKey, fileBuffer, {
      httpMetadata: { contentType }
    });

    // 生成并上传预览图
    if (generatePreview) {
      try {
        // 使用 Cloudflare Image Resizing 生成预览图
        // 注意：这需要在 Cloudflare 账户中启用 Image Resizing 功能
        // 如果没有启用，预览图将使用原图
        const previewKey = `0_preview/${category}/${baseName}.webp`;
        
        // 简单方案：直接存储原图作为预览（实际项目中可以用 Workers 处理图片）
        await env.R2_BUCKET.put(previewKey, fileBuffer, {
          httpMetadata: { contentType: 'image/webp' }
        });
      } catch (e) {
        console.error('生成预览图失败:', e);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: '上传成功',
      file: originalKey
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('上传错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
