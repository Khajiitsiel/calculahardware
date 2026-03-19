exports.handler = async (event) => {
  const query = event.queryStringParameters?.q || '';
  const CORS  = { 'Access-Control-Allow-Origin':'*', 'Content-Type':'application/json' };
  const KEY   = '3d2e6e143emsh45f8d9dfda9a045p14a51ajsnf5a0691b1e9d';

  function mediaIQR(arr) {
    if (!arr.length) return null;
    const s  = [...arr].sort((a,b)=>a-b);
    const q1 = s[Math.floor(s.length*.25)];
    const q3 = s[Math.floor(s.length*.75)];
    const f  = s.filter(v=>v>=q1-1.5*(q3-q1)&&v<=q3+1.5*(q3-q1));
    return f.reduce((a,v)=>a+v,0)/f.length;
  }

  function extrairResultados(data) {
    return data.results || data.items || data.data || data || [];
  }

  function extrairPreco(r) {
    return r.price || r.preco || r.sale_price || r.original_price || 0;
  }

  // Debug
  if (event.queryStringParameters?.debug === '1') {
    const tests = [];

    const apis = [
      { nome:'mercado-libre8', url:`https://mercado-libre8.p.rapidapi.com/search?query=RTX+3060&site=MLB&num=5`, host:'mercado-libre8.p.rapidapi.com' },
      { nome:'mercado-libre7', url:`https://mercado-libre7.p.rapidapi.com/search?query=RTX+3060&site=MLB&num=5`, host:'mercado-libre7.p.rapidapi.com' },
      { nome:'ML categorias',  url:`https://api.mercadolibre.com/sites/MLB/categories`, host:null },
      { nome:'ML trends',      url:`https://api.mercadolibre.com/trends/MLB`, host:null },
    ];

    for (const api of apis) {
      try {
        const headers = api.host
          ? { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': api.host }
          : { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' };
        const r = await fetch(api.url, { headers });
        tests.push({ fonte: api.nome, status: r.status, body: (await r.text()).slice(0,300) });
      } catch(e) { tests.push({ fonte: api.nome, erro: e.message }); }
    }

    return { statusCode:200, headers:CORS, body: JSON.stringify({ testes:tests }, null, 2) };
  }

  if (!query) return { statusCode:400, headers:CORS, body: JSON.stringify({ erro:'Parâmetro q obrigatório.' }) };

  // Tenta mercado-libre8 primeiro, depois mercado-libre7
  const apis = [
    { url:`https://mercado-libre8.p.rapidapi.com/search?query=${encodeURIComponent(query)}&site=MLB&num=30`, host:'mercado-libre8.p.rapidapi.com' },
    { url:`https://mercado-libre7.p.rapidapi.com/search?query=${encodeURIComponent(query)}&site=MLB&num=30`, host:'mercado-libre7.p.rapidapi.com' },
  ];

  for (const api of apis) {
    try {
      const r = await fetch(api.url, {
        headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': api.host }
      });
      if (!r.ok) continue;

      const data    = await r.json();
      const results = extrairResultados(data);
      if (!Array.isArray(results) || !results.length) continue;

      const precos = results.map(extrairPreco).filter(p=>p>=50);
      const base   = mediaIQR(precos);
      if (!base) continue;

      return { statusCode:200, headers:CORS, body: JSON.stringify({
        encontrado: true,
        valorBase:  Math.round(base),
        totalResultados: results.length,
        anuncios: results.slice(0,6).map(r=>({
          titulo:    r.title||r.titulo||'',
          preco:     extrairPreco(r),
          condicao:  r.condition==='new'?'Novo':'Usado',
          link:      r.permalink||r.url||r.link||'#',
          thumbnail: r.thumbnail||r.image||r.img||'',
        }))
      })};
    } catch(e) { continue; }
  }

  return { statusCode:500, headers:CORS, body: JSON.stringify({ erro:'Não foi possível buscar preços. Informe o valor manualmente.' }) };
};
