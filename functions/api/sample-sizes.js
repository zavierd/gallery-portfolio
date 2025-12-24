// 随机抽样检查压缩效果
export async function onRequestGet(context) {
  const { env } = context;

  try {
    let cursor = undefined;
    const samples = [];
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    let count = 0;

    do {
      const listed = await env.R2_BUCKET.list({ cursor, limit: 1000 });
      for (const obj of listed.objects) {
        const key = obj.key;
        if (!key.startsWith('0_preview/')) continue;
        const ext = '.' + key.split('.').pop().toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) continue;
        
        // 每100个取1个样本
        count++;
        if (count % 100 === 0 && samples.length < 20) {
          samples.push({
            preview: key,
            previewSize: obj.size,
            previewKB: (obj.size / 1024).toFixed(1)
          });
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    return new Response(JSON.stringify({
      success: true,
      totalPreviews: count,
      samples
    }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
