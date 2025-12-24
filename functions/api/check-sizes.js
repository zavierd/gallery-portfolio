// 检查预览图和原图大小对比
export async function onRequestGet(context) {
  const { env } = context;

  try {
    let cursor = undefined;
    const originals = new Map();
    const previews = new Map();
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    do {
      const listed = await env.R2_BUCKET.list({ cursor, limit: 1000 });
      for (const obj of listed.objects) {
        const key = obj.key;
        const ext = '.' + key.split('.').pop().toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) continue;
        
        if (key.startsWith('0_preview/')) {
          const id = key.replace('0_preview/', '').replace(/\.[^.]+$/, '');
          previews.set(id, { key, size: obj.size });
        } else {
          const id = key.replace(/\.[^.]+$/, '');
          originals.set(id, { key, size: obj.size });
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // 统计
    let compressed = 0, notCompressed = 0;
    const samples = [];
    
    for (const [id, orig] of originals) {
      const prev = previews.get(id);
      if (prev) {
        const ratio = prev.size / orig.size;
        if (ratio < 0.5) {
          compressed++;
        } else {
          notCompressed++;
          if (samples.length < 10) {
            samples.push({
              original: orig.key,
              originalSize: (orig.size / 1024).toFixed(0) + 'KB',
              previewSize: (prev.size / 1024).toFixed(0) + 'KB',
              ratio: (ratio * 100).toFixed(0) + '%'
            });
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: originals.size,
      compressed,
      notCompressed,
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
