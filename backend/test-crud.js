// 中文数据 CRUD 验证脚本（node test-crud.js）
const BASE = 'http://localhost:3000/api';

async function req(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

(async () => {
  let pass = 0, fail = 0;
  const check = (name, cond, extra = '') => {
    console.log(`${cond ? '[PASS]' : '[FAIL]'} ${name} ${extra}`);
    cond ? pass++ : fail++;
  };

  const { data: login } = await req('POST', '/auth/login', { username: 'P001', password: '123456' });
  const token = login.token;

  // Create (with Unicode content and base64 image field)
  const fakeImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const { status: cs, data: created } = await req('POST', '/products', {
    name: 'Test Timer QA-中文',
    category: 'chess-timer',
    price: 99.5,
    stock: 8,
    description: 'Unicode content check ⏱♟ 中文验证',
    image: fakeImg,
  }, token);
  check('create product', cs === 201 && created.product.name === 'Test Timer QA-中文', `id=${created.product?.id}`);
  const id = created.product.id;

  // Read back
  const { data: one } = await req('GET', `/products/${id}`);
  check('read-back consistent', one.product.description === 'Unicode content check ⏱♟ 中文验证' && one.product.image === fakeImg);

  // Update
  const { data: upd } = await req('PUT', `/products/${id}`, { name: 'Test Timer QA-Renamed', price: 66 }, token);
  check('update product', upd.product.name === 'Test Timer QA-Renamed' && Number(upd.product.price) === 66);

  // Delete
  const { status: ds } = await req('DELETE', `/products/${id}`, null, token);
  check('delete product', ds === 200);

  console.log(`\n==== ${pass} passed / ${fail} failed ====`);
  process.exit(fail);
})();
