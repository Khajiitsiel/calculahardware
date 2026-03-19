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

  // Debug: mostra estrutura real de um item
  if (event.queryStringParameters && event.queryStringParameters.debug === '1') {
    const r = await fetch(
      'https://mercado-libre8.p.rapidapi.com/search?keyword=RTX+3060&country=BR',
      { headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
    );
    const data = await r.json();
    const products = (data.Data && data.Data.products) || [];
    // Mostra as chaves do primeiro item para sabermos os nomes corretos
    const primeiro = products[0] || {};
    return { statusCode: 200, headers: C, body: JSON.stringify({
      chaves_do_item: Object.keys(primeiro),
      primeiro_item_completo: primeiro,
      total: products.length
    }, null, 2)};
  }

  if (!q) return { statusCode: 400, headers: C, body: JSON.stringify({ erro: 'Parametro q obrigatorio.' }) };

  try {
    const resp = await fetch(
      'https://mercado-libre8.p.rapidapi.com/search?keyword=' + encodeURIComponent(q) + '&country=BR',
      { headers: { 'X-RapidAPI-Key': K, 'X-RapidAPI-Host': 'mercado-libre8.p.rapidapi.com' } }
    );
    if (!resp.ok) throw new Error('API retornou ' + resp.status);

    const data    = await resp.json();
    const results = (data.Data && data.Data.products) || data.results || data.items || (Array.isArray(data) ? data : []);

    if (!results.length) return { statusCode: 200, headers: C, body: JSON.stringify({ encontrado: false, mensagem: 'Sem resultados para "' + q + '".' }) };

    const precos = results.map(function(r){
      return parseFloat(r.price || r.preco || r.sale_price || r.Price || 0);
    }).filter(function(p){ return p >= 50; });

    const base = iqr(precos);
    if (!base) return { statusCode: 200, headers: C, body: JSON.stringify({ encontrado: false, mensagem: 'Sem dados de preco suficientes.' }) };

    return { statusCode: 200, headers: C, body: JSON.stringify({
      encontrado: true,
      valorBase: Math.round(base),
      totalResultados: results.length,
      anuncios: results.slice(0,6).map(function(r) {
        // Tenta todas as variações de nome de campo possíveis
        var titulo    = r.title      || r.titulo    || r.Title    || r.name      || r.Name      || '';
        var preco     = parseFloat(r.price || r.preco || r.sale_price || r.Price || r.Preco || 0);
        var condicao  = (r.condition || r.condicao  || r.Condition || '') === 'new' ? 'Novo' : 'Usado';
        var link      = r.productUrl || r.permalink || r.url      || r.link     || r.Link      || '#';
        var thumbnail = r.imageUrl   || r.thumbnail || r.image    || r.img      || r.Image     || '';
        return { titulo: titulo, preco: preco, condicao: condicao, link: link, thumbnail: thumbnail };
      })
    })};

  } catch(err) {
    return { statusCode: 500, headers: C, body: JSON.stringify({ erro: err.message }) };
  }
};
