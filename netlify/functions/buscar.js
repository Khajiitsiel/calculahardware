exports.handler = async (event) => {
  const q = event.queryStringParameters ? event.queryStringParameters.q || '' : '';
  const C = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (!q) return { statusCode: 400, headers: C, body: JSON.stringify({ erro: 'Parametro q obrigatorio.' }) };

  try {
    const prompt = `Você é um especialista em preços de hardware usado no mercado brasileiro.

O usuário quer saber o preço médio de mercado atual de: "${q}"

Responda APENAS com um JSON válido, sem texto antes ou depois, neste formato exato:
{
  "valorBase": 2500,
  "totalResultados": 12,
  "anuncios": [
    { "titulo": "Nome do produto variação 1", "preco": 2400, "condicao": "Novo", "link": "#", "thumbnail": "" },
    { "titulo": "Nome do produto variação 2", "preco": 2600, "condicao": "Novo", "link": "#", "thumbnail": "" },
    { "titulo": "Nome do produto usado", "preco": 1800, "condicao": "Usado", "link": "#", "thumbnail": "" }
  ]
}

Regras:
- valorBase deve ser o preço médio realista em reais no mercado brasileiro HOJE
- Liste de 3 a 6 variações realistas do produto com preços diferentes
- Inclua versões novas e usadas quando aplicável
- Se não reconhecer o produto, estime com base em produtos similares
- Preços devem refletir o mercado BR atual (Mercado Livre, Kabum, Terabyte)
- Responda SOMENTE o JSON, sem explicações`;

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':            'application/json',
        'x-api-key':               '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',
        'anthropic-version':       '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error('Anthropic API retornou ' + resp.status + ': ' + txt);
    }

    const data    = await resp.json();
    const content = data.content && data.content[0] && data.content[0].text;
    if (!content) throw new Error('Resposta vazia da IA');

    // Limpa possível markdown e faz parse do JSON
    const clean  = content.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);

    if (!result.valorBase) throw new Error('IA nao retornou valorBase');

    return {
      statusCode: 200,
      headers: C,
      body: JSON.stringify({
        encontrado:      true,
        valorBase:       Math.round(result.valorBase),
        totalResultados: result.totalResultados || result.anuncios.length,
        anuncios:        result.anuncios || [],
        fonte:           'IA'
      })
    };

  } catch(err) {
    return { statusCode: 500, headers: C, body: JSON.stringify({ erro: err.message }) };
  }
};
