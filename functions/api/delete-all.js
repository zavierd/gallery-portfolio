// 删除所有图片 API
export async function onRequestPost(context) {
  const { env } = context;

  try {
    let cursor = undefined;
    const allObjects = [];
    let deletedCount = 0;

    // 列出所有对象
    do {
      const listed = await env.R2_BUCKET.list({ cursor, limit: 1000 });
      allObjects.push(...listed.objects);
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    // 批量删除（每次最多1000个）
    const keys = allObjects.map(obj => obj.key);
    
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await env.R2_BUCKET.delete(batch);
      deletedCount += batch.length;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: `成功删除 ${deletedCount} 个文件`,
      count: deletedCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('批量删除错误:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
