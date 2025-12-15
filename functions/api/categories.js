// 分类管理 API
const CATEGORIES_KEY = '_config/categories.json';

// 获取分类列表
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const obj = await env.R2_BUCKET.get(CATEGORIES_KEY);
    
    if (!obj) {
      // 返回默认分类
      return new Response(JSON.stringify({
        categories: [
          { id: '1', name: '分类1', children: [] },
          { id: '2', name: '分类2', children: [] },
          { id: '3', name: '分类3', children: [] }
        ]
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await obj.text();
    return new Response(data, {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// 保存分类列表
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { categories } = await request.json();

    if (!categories || !Array.isArray(categories)) {
      return new Response(JSON.stringify({ error: '无效的分类数据' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await env.R2_BUCKET.put(CATEGORIES_KEY, JSON.stringify({ categories }, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
