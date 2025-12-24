// 修复缺失的预览图（直接复制原图作为预览）
export async function onRequestPost(context) {
  const { env } = context;

  try {
    const missing = [
      { key: "宁波慈溪/11.jpg", preview: "0_preview/宁波慈溪/11.webp" },
      { key: "上海亚太旗舰店/DSC05939-编辑 [原始大小].jpg", preview: "0_preview/上海亚太旗舰店/DSC05939-编辑 [原始大小].webp" }
    ];

    const results = [];
    
    for (const item of missing) {
      try {
        // 获取原图
        const original = await env.R2_BUCKET.get(item.key);
        if (!original) {
          results.push({ key: item.key, success: false, error: '原图不存在' });
          continue;
        }

        // 复制到预览目录（Worker 无法压缩，只能复制）
        const body = await original.arrayBuffer();
        await env.R2_BUCKET.put(item.preview, body, {
          httpMetadata: { contentType: 'image/webp' }
        });

        results.push({ key: item.key, success: true, preview: item.preview, size: body.byteLength });
      } catch (e) {
        results.push({ key: item.key, success: false, error: e.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
