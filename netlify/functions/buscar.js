exports.handler = async (event) => {
  const query = event.queryStringParameters?.q || '';

  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Content-Type': 'application/json',
  };

  function mediaIQR(arr) {
    if (!arr.length) return null;
    const s  = [...arr].sort((a,b) => a-b);
    const q1 = s[Math.floor(s.length*.25)];
    const q3 = s[Math.floor(s.length*.75)];
    const f  = s.filter(v => v >= q1-1.5*(q3-q1) && v <= q3+1.5*(q3-q1));
    return f.reduce((a,v)=>a+v,0)/f.length;
  }

  const KEY = '3d2e6e143emsh45f8d9dfda9a045p14a51ajsnf5a0691b1e9d';

  // Debug endpoint
  if (event.queryStringParameters?.debug === '1') {
    const tests = [];

    // Teste 1: mercado-libre7
    try {
      const r = await fetch(
        `https://mercado-libre7.p.rapidapi.com/search?query=RTX+3060&site=MLB&num=5`,
        { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercado-libre7.p.rapidapi.com' } }
      );
      tests.push({ fonte: 'mercado-libre7', status: r.status, body: (await r.text()).slice(0,400) });
    } catch(e) { tests.push({ fonte: 'mercado-libre7', erro: e.message }); }

    // Teste 2: mercadolibre-search
    try {
      const r = await fetch(
        `https://mercadolibre-search.p.rapidapi.com/search?q=RTX+3060&site=MLB`,
        { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercadolibre-search.p.rapidapi.com' } }
      );
      tests.push({ fonte: 'mercadolibre-search', status: r.status, body: (await r.text()).slice(0,400) });
    } catch(e) { tests.push({ fonte: 'mercadolibre-search', erro: e.message }); }

    // Teste 3: ML direto com header Accept diferente
    try {
      const r = await fetch(
        `https://api.mercadolibre.com/sites/MLB/search?q=RTX+3060&limit=3`,
        { headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        }}
      );
      tests.push({ fonte: 'ML direto v2', status: r.status, body: (await r.text()).slice(0,200) });
    } catch(e) { tests.push({ fonte: 'ML direto v2', erro: e.message }); }

    // Teste 4: ML via endpoint de categorias (não requer auth)
    try {
      const r = await fetch(`https://api.mercadolibre.com/sites/MLB/categories`);
      tests.push({ fonte: 'ML categorias (sem auth)', status: r.status, body: (await r.text()).slice(0,100) });
    } catch(e) { tests.push({ fonte: 'ML categorias', erro: e.message }); }

    return { statusCode:200, headers:CORS, body: JSON.stringify({ testes: tests }, null, 2) };
  }

  // Busca normal
  if (!query) return { statusCode:400, headers:CORS, body: JSON.stringify({ erro:'Parâmetro q obrigatório.' }) };

  try {
    // Tenta mercado-libre7
    const r = await fetch(
      `https://mercado-libre7.p.rapidapi.com/search?query=${encodeURIComponent(query)}&site=MLB&num=20`,
      { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercado-libre7.p.rapidapi.com' } }
    );

    if (!r.ok) throw new Error(`mercado-libre7 retornou ${r.status}`);

    const data    = await r.json();
    const results = data.results || data.items || data || [];
    if (!Array.isArray(results) || !results.length)
      return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:false, mensagem:`Sem resultados para "${query}".` }) };

    const precos = results.map(r => r.price||r.preco||0).filter(p=>p>=50);
    const base   = mediaIQR(precos);
    if (!base) return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:false, mensagem:'Sem dados de preço.' }) };

    return { statusCode:200, headers:CORS, body: JSON.stringify({
      encontrado: true,
      valorBase: Math.round(base),
      totalResultados: results.length,
      anuncios: results.slice(0,6).map(r=>({
        titulo: r.title||r.titulo||'',
        preco: r.price||r.preco||0,
        condicao: r.condition==='new'?'Novo':'Usado',
        link: r.permalink||r.url||'#',
        thumbnail: r.thumbnail||r.image||'',
      }))
    })};

  } catch(e) {
    return { statusCode:500, headers:CORS, body: JSON.stringify({ erro: e.message }) };
  }
};
