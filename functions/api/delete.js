// 删除图片 API
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { key } = await request.json();

    if (!key) {
      return new Response(JSON.stringify({ error: '缺少图片路径' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 删除原图
    await env.R2_BUCKET.delete(key);

    // 尝试删除预览图
    const parts = key.split('/');
    if (parts.length >= 2) {
      const category = parts[0];
      const fileName = parts[parts.length - 1];
      const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
      const previewKey = `0_preview/${category}/${baseName}.webp`;
      
      try {
        await env.R2_BUCKET.delete(previewKey);
      } catch (e) {
        console.log('预览图删除失败或不存在:', previewKey);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: '删除成功'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('删除错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
