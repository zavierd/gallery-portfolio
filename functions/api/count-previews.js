// 统计预览图数量
export async function onRequestGet(context) {
  const { env } = context;

  try {
    let cursor = undefined;
    let previewCount = 0;
    let totalCount = 0;
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    do {
      const listed = await env.R2_BUCKET.list({ cursor, limit: 1000 });
      for (const obj of listed.objects) {
        const key = obj.key;
        const ext = '.' + key.split('.').pop().toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) continue;
        
        if (key.startsWith('0_preview/')) {
          previewCount++;
        } else {
          totalCount++;
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    return new Response(JSON.stringify({
      success: true,
      originalImages: totalCount,
      previewImages: previewCount,
      percentage: totalCount > 0 ? Math.round(previewCount / totalCount * 100) : 0
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
