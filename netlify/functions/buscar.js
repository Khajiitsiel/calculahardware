exports.handler = async (event) => {
  const q = event.queryStringParameters ? event.queryStringParameters.q || '' : '';
  const C = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const K = '3d2e6e143emsh45f8d9dfda9a045p14a51ajsnf5a0691b1e9d';

  function iqr(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort(function(a,b){return a-b;});
    const q1 = s[Math.floor(s.length*0.25)];
    const q3 = s[Math.floor(s.length*0.75)];
    const r = q3 - q1;
    const f = s.filter(function(v){return v >= q1-1.5*r && v <= q3+1.5*r;});
    return f.reduce(function(a,v){return a+v;},0) / f.length;
  }

  const debug = event.queryStringParameters && event.queryStringParameters.debug === '1';

  if (debug) {
    const tests = [];

    try {
      const r1 = await fetch('https://mercado-libre8.p.rapidapi.com/search?keyword=RTX+3060&country=BR', {
        headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' }
      });
      tests.push({ fonte: 'ml8-BR', status: r1.status, body: (await r1.text()).slice(0,400) });
    } catch(e1) { tests.push({ fonte: 'ml8-BR', erro: e1.message }); }

    try {
      const r2 = await fetch('https://mercado-libre8.p.rapidapi.com/products?keyword=RTX+3060&country=BR', {
        headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' }
      });
      tests.push({ fonte: 'ml8-products', status: r2.status, body: (await r2.text()).slice(0,400) });
    } catch(e2) { tests.push({ fonte: 'ml8-products', erro: e2.message }); }

    try {
      const r3 = await fetch('https://mercado-libre8.p.rapidapi.com/search?keyword=RTX+3060&country=MLA', {
        headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' }
      });
      tests.push({ fonte: 'ml8-MLA', status: r3.status, body: (await r3.text()).slice(0,400) });
    } catch(e3) { tests.push({ fonte: 'ml8-MLA', erro: e3.message }); }

    return { statusCode: 200, headers: C, body: JSON.stringify({ testes: tests }, null, 2) };
  }

  if (!q) {
    return { statusCode: 400, headers: C, body: JSON.stringify({ erro: 'Parametro q obrigatorio.' }) };
  }

  try {
    const resp = await fetch('https://mercado-libre8.p.rapidapi.com/search?keyword=' + encodeURIComponent(q) + '&country=BR', {
      headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' }
    });

    if (!resp.ok) throw new Error('API retornou ' + resp.status);

    const data    = await resp.json();
    const results = data.results || data.items || data.data || (Array.isArray(data) ? data : []);

    if (!results.length) {
      return { statusCode: 200, headers: C, body: JSON.stringify({ encontrado: false, mensagem: 'Sem resultados.' }) };
    }

    const precos = results.map(function(r){ return r.price || r.preco || r.sale_price || 0; }).filter(function(p){ return p >= 50; });
    const base   = iqr(precos);

    if (!base) {
      return { statusCode: 200, headers: C, body: JSON.stringify({ encontrado: false, mensagem: 'Sem dados de preco.' }) };
    }

    return { statusCode: 200, headers: C, body: JSON.stringify({
      encontrado: true,
      valorBase: Math.round(base),
      totalResultados: results.length,
      anuncios: results.slice(0,6).map(function(r) {
        return {
          titulo:    r.title    || r.titulo || '',
          preco:     r.price    || r.preco  || r.sale_price || 0,
          condicao:  r.condition === 'new' ? 'Novo' : 'Usado',
          link:      r.permalink || r.url   || r.link || '#',
          thumbnail: r.thumbnail || r.image || r.img  || ''
        };
      })
    })};

  } catch(err) {
    return { statusCode: 500, headers: C, body: JSON.stringify({ erro: err.message }) };
  }
};
