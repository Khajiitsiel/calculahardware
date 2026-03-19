exports.handler = async (event) => {
  const q = event.queryStringParameters ? event.queryStringParameters.q || '' : '';
  const C = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };
  const K = '3d2e6e143emsh45f8d9dfda9a045p14a51ajsnf5a0691b1e9d';

  function iqr(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort(function(a,b){return a-b;});
    const q1 = s[Math.floor(s.length*0.25)];
    const q3 = s[Math.floor(s.length*0.75)];
    const iv = q3 - q1;
    const f = s.filter(function(v){return v >= q1-1.5*iv && v <= q3+1.5*iv;});
    return f.reduce(function(a,v){return a+v;},0) / f.length;
  }

  if (!q) return { statusCode: 400, headers: C, body: JSON.stringify({ erro: 'Parametro q obrigatorio.' }) };

  try {
    const resp = await fetch(
      'https://mercado-libre8.p.rapidapi.com/search?keyword=' + encodeURIComponent(q) + '&country=BR',
      { headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
    );
    if (!resp.ok) throw new Error('API retornou ' + resp.status);

    const data    = await resp.json();
    const results = (data.Data && data.Data.products) || [];

    if (!results.length) return { statusCode: 200, headers: C, body: JSON.stringify({ encontrado: false, mensagem: 'Sem resultados para "' + q + '".' }) };

    const precos = results
      .map(function(r){ return parseFloat(r.price) || 0; })
      .filter(function(p){ return p >= 50; });

    const base = iqr(precos);
    if (!base) return { statusCode: 200, headers: C, body: JSON.stringify({ encontrado: false, mensagem: 'Sem dados de preco suficientes.' }) };

    return { statusCode: 200, headers: C, body: JSON.stringify({
      encontrado: true,
      valorBase: Math.round(base),
      totalResultados: results.length,
      anuncios: results.slice(0,6).map(function(r) {
        return {
          titulo:    r.title      || '',
          preco:     parseFloat(r.price) || 0,
          condicao:  'Novo',
          vendedor:  r.seller     || '',
          avaliacao: r.reviewText || '',
          frete:     r.shippingText || '',
          link:      r.productUrl || '#',
          thumbnail: r.imageUrl   || ''
        };
      })
    })};

  } catch(err) {
    return { statusCode: 500, headers: C, body: JSON.stringify({ erro: err.message }) };
  }
};
