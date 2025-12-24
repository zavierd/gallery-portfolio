// 批量重新生成预览图 API
// 由于 Workers 不能处理图片压缩，这个 API 只是标记需要处理的图片
// 实际压缩需要在前端或使用 Cloudflare Image Resizing

export async function onRequestPost(context) {
  const { env } = context;

  try {
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    let cursor = undefined;
    const images = [];

    // 列出所有图片
    do {
      const listed = await env.R2_BUCKET.list({ cursor, limit: 1000 });
      for (const obj of listed.objects) {
        const key = obj.key;
        if (key.startsWith('0_preview/')) continue;
        const ext = '.' + key.split('.').pop().toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) continue;
        images.push({ key, size: obj.size });
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // 返回需要处理的图片列表
    return new Response(JSON.stringify({
      success: true,
      total: images.length,
      images: images.slice(0, 100) // 只返回前100个，避免响应太大
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
