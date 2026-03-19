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

  function extrairPreco(r) {
    return r.price || r.preco || r.sale_price || r.original_price || 0;
  }

  // Debug
  if (event.queryStringParameters?.debug === '1') {
    const tests = [];

    // mercado-libre8 com parâmetros corretos
    try {
      const r = await fetch(
        `https://mercado-libre8.p.rapidapi.com/search?keyword=RTX+3060&country=BR&num=5`,
        { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
      );
      tests.push({ fonte:'mercado-libre8 (keyword+country)', status:r.status, body:(await r.text()).slice(0,500) });
    } catch(e) { tests.push({ fonte:'mercado-libre8', erro:e.message }); }

    // mercado-libre8 com country=BR via MLB
    try {
      const r = await fetch(
        `https://mercado-libre8.p.rapidapi.com/search?keyword=RTX+3060&country=MLB`,
        { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
      );
      tests.push({ fonte:'mercado-libre8 (MLB)', status:r.status, body:(await r.text()).slice(0,500) });
    } catch(e) { tests.push({ fonte:'mercado-libre8 MLB', erro:e.message }); }

    // Listar endpoints disponíveis
    try {
      const r = await fetch(
        `https://mercado-libre8.p.rapidapi.com/`,
        { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
      );
      tests.push({ fonte:'mercado-libre8 root', status:r.status, body:(await r.text()).slice(0,500) });
    } catch(e) { tests.push({ fonte:'mercado-libre8 root', erro:e.message }); }

    return { statusCode:200, headers:CORS, body: JSON.stringify({ testes:tests }, null, 2) };
  }

  if (!query) return { statusCode:400, headers:CORS, body: JSON.stringify({ erro:'Parâmetro q obrigatório.' }) };

  try {
    const r = await fetch(
      `https://mercado-libre8.p.rapidapi.com/search?keyword=${encodeURIComponent(query)}&country=BR`,
      { headers: { 'X-RapidAPI-Key': KEY, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
    );

    if (!r.ok) throw new Error(`mercado-libre8 retornou ${r.status}`);

    const data    = await r.json();
    const results = data.results || data.items || data.data || (Array.isArray(data) ? data : []);
    if (!results.length) return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:false, mensagem:`Sem resultados para "${query}".` }) };

    const precos = results.map(extrairPreco).filter(p=>p>=50);
    const base   = mediaIQR(precos);
    if (!base) return { statusCode:200, headers:CORS, body: JSON.stringify({ encontrado:false, mensagem:'Sem dados de preço.' }) };

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

  } catch(e) {
    return { statusCode:500, headers:CORS, body: JSON.stringify({ erro: e.message }) };
  }
};
