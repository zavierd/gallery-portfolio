// 检查缺失预览图的图片
export async function onRequestGet(context) {
  const { env } = context;

  try {
    let cursor = undefined;
    const originals = new Map(); // key -> size
    const previews = new Set();
    const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

    do {
      const listed = await env.R2_BUCKET.list({ cursor, limit: 1000 });
      for (const obj of listed.objects) {
        const key = obj.key;
        const ext = '.' + key.split('.').pop().toLowerCase();
        if (!IMAGE_EXTENSIONS.includes(ext)) continue;
        
        if (key.startsWith('0_preview/')) {
          // 0_preview/分类/文件名.webp -> 分类/文件名
          const parts = key.replace('0_preview/', '').split('/');
          const category = parts[0];
          const fileName = parts[parts.length - 1];
          const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
          previews.add(`${category}/${baseName}`);
        } else {
          // 分类/文件名.ext -> 分类/文件名
          const parts = key.split('/');
          const category = parts[0];
          const fileName = parts[parts.length - 1];
          const baseName = fileName.substring(0, fileName.lastIndexOf('.'));
          originals.set(`${category}/${baseName}`, { key, size: obj.size });
        }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // 找出缺失预览图的原图
    const missing = [];
    for (const [id, info] of originals) {
      if (!previews.has(id)) {
        missing.push({
          key: info.key,
          size: info.size,
          sizeMB: (info.size / 1024 / 1024).toFixed(2)
        });
      }
    }

    // 按大小排序
    missing.sort((a, b) => b.size - a.size);

    return new Response(JSON.stringify({
      success: true,
      totalOriginals: originals.size,
      totalPreviews: previews.size,
      missingCount: missing.length,
      missing: missing
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
