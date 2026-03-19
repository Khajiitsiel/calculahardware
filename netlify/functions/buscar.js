exports.handler = async (event) => {
  const query = event.queryStringParameters?.q || '';

  const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };

  function mediaIQR(arr) {
    if (!arr.length) return null;
    const s  = [...arr].sort((a, b) => a - b);
    const q1 = s[Math.floor(s.length * 0.25)];
    const q3 = s[Math.floor(s.length * 0.75)];
    const f  = s.filter(v => v >= q1 - 1.5*(q3-q1) && v <= q3+1.5*(q3-q1));
    return f.reduce((a,v) => a+v, 0) / f.length;
  }

  const RAPIDAPI_KEY = '3d2e6e143emsh45f8d9dfda9a045p14a51ajsnf5a0691b1e9d';

  // Endpoint de diagnóstico: /api/buscar?debug=1
  if (event.queryStringParameters?.debug === '1') {
    const tests = [];

    // Teste 1: ML direto
    try {
      const r = await fetch(
        `https://api.mercadolibre.com/sites/MLB/search?q=RTX+3060&limit=3`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' } }
      );
      const txt = await r.text();
      tests.push({ fonte: 'ML direto', status: r.status, body: txt.slice(0,200) });
    } catch(e) { tests.push({ fonte: 'ML direto', erro: e.message }); }

    // Teste 2: RapidAPI mercado-libre-scraper
    try {
      const r = await fetch(
        `https://mercado-libre-scraper.p.rapidapi.com/search?query=RTX+3060&site=MLB`,
        { headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'mercado-libre-scraper.p.rapidapi.com' } }
      );
      const txt = await r.text();
      tests.push({ fonte: 'RapidAPI scraper', status: r.status, body: txt.slice(0,300) });
    } catch(e) { tests.push({ fonte: 'RapidAPI scraper', erro: e.message }); }

    // Teste 3: RapidAPI mercadolibre2
    try {
      const r = await fetch(
        `https://mercadolibre2.p.rapidapi.com/search?query=RTX+3060&countryCode=BR`,
        { headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'mercadolibre2.p.rapidapi.com' } }
      );
      const txt = await r.text();
      tests.push({ fonte: 'RapidAPI mercadolibre2', status: r.status, body: txt.slice(0,300) });
    } catch(e) { tests.push({ fonte: 'RapidAPI mercadolibre2', erro: e.message }); }

    // Teste 4: RapidAPI mercado-libre1
    try {
      const r = await fetch(
        `https://mercado-libre1.p.rapidapi.com/search/search?q=RTX+3060&site=MLB&num=5`,
        { headers: { 'X-RapidAPI-Key': RAPIDAPI_KEY, 'X-RapidAPI-Host': 'mercado-libre1.p.rapidapi.com' } }
      );
      const txt = await r.text();
      tests.push({ fonte: 'RapidAPI mercado-libre1', status: r.status, body: txt.slice(0,300) });
    } catch(e) { tests.push({ fonte: 'RapidAPI mercado-libre1', erro: e.message }); }

    return { statusCode: 200, headers: CORS, body: JSON.stringify({ testes: tests }, null, 2) };
  }

  // Busca normal
  if (!query) return { statusCode: 400, headers: CORS, body: JSON.stringify({ erro: 'Parâmetro q obrigatório.' }) };

  try {
    const r = await fetch(
      `https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=30`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json', 'Accept-Language': 'pt-BR,pt;q=0.9' } }
    );
    if (!r.ok) throw new Error(`ML ${r.status}`);
    const data = await r.json();
    const res  = data.results || [];
    if (!res.length) return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:false, mensagem:`Sem resultados para "${query}".` }) };
    const novos  = res.filter(x=>x.condition==='new'  && x.price>=50).map(x=>x.price);
    const usados = res.filter(x=>x.condition==='used' && x.price>=50).map(x=>x.price);
    const base   = mediaIQR(novos)||mediaIQR(usados);
    if (!base) return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:false, mensagem:'Sem dados de preço.' }) };
    return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:true, valorBase:Math.round(base), totalResultados:res.length, anuncios:res.slice(0,6).map(r=>({ titulo:r.title, preco:r.price, condicao:r.condition==='new'?'Novo':'Usado', link:r.permalink, thumbnail:r.thumbnail })) }) };
  } catch(e) {
    return { statusCode:500, headers:CORS, body: JSON.stringify({ erro: e.message }) };
  }
};
