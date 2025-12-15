// 移动图片到其他分类 API
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { sourceKey, targetCategory } = await request.json();

    if (!sourceKey || !targetCategory) {
      return new Response(JSON.stringify({ error: '缺少参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取原文件
    const sourceObj = await env.R2_BUCKET.get(sourceKey);
    if (!sourceObj) {
      return new Response(JSON.stringify({ error: '源文件不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 解析文件名
    const parts = sourceKey.split('/');
    const fileName = parts[parts.length - 1];
    const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
    const ext = fileName.split('.').pop();
    
    // 新路径
    const targetKey = `${targetCategory}/${fileName}`;
    const sourcePreviewKey = `0_preview/${parts[0]}/${baseName}.webp`;
    const targetPreviewKey = `0_preview/${targetCategory}/${baseName}.webp`;

    // 复制原图到新位置
    const body = await sourceObj.arrayBuffer();
    await env.R2_BUCKET.put(targetKey, body, {
      httpMetadata: sourceObj.httpMetadata
    });

    // 尝试复制预览图
    try {
      const previewObj = await env.R2_BUCKET.get(sourcePreviewKey);
      if (previewObj) {
        const previewBody = await previewObj.arrayBuffer();
        await env.R2_BUCKET.put(targetPreviewKey, previewBody, {
          httpMetadata: previewObj.httpMetadata
        });
        // 删除旧预览图
        await env.R2_BUCKET.delete(sourcePreviewKey);
      }
    } catch (e) {
      console.log('预览图移动失败:', e);
    }

    // 删除原文件
    await env.R2_BUCKET.delete(sourceKey);

    return new Response(JSON.stringify({ 
      success: true, 
      message: '移动成功',
      newKey: targetKey
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('移动错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
