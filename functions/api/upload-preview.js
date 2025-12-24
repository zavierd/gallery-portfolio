// 单独上传预览图 API（用于批量优化）
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const formData = await request.formData();
    const preview = formData.get('preview');
    const category = formData.get('category');
    const baseName = formData.get('baseName');

    if (!preview || !category || !baseName) {
      return new Response(JSON.stringify({ error: '缺少参数' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const previewKey = `0_preview/${category}/${baseName}.webp`;
    const previewBuffer = await preview.arrayBuffer();
    
    await env.R2_BUCKET.put(previewKey, previewBuffer, {
      httpMetadata: { contentType: 'image/webp' }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      key: previewKey,
      size: previewBuffer.byteLength
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('上传预览图错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
