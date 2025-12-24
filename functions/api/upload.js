export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category');
    const preview = formData.get('preview'); // 前端生成的预览图

    if (!file || !category) {
      return new Response(JSON.stringify({ error: '缺少文件或分类' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const fileName = file.name;
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const contentType = file.type || 'image/jpeg';

    // 上传原图到 R2
    const originalKey = `${category}/${fileName}`;
    const fileBuffer = await file.arrayBuffer();
    
    await env.R2_BUCKET.put(originalKey, fileBuffer, {
      httpMetadata: { contentType }
    });

    // 上传预览图（如果前端提供了）
    if (preview) {
      try {
        const previewKey = `0_preview/${category}/${baseName}.webp`;
        const previewBuffer = await preview.arrayBuffer();
        await env.R2_BUCKET.put(previewKey, previewBuffer, {
          httpMetadata: { contentType: 'image/webp' }
        });
      } catch (e) {
        console.error('上传预览图失败:', e);
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
