exports.handler = async (event) => {
  const q = event.queryStringParameters ? event.queryStringParameters.q || '' : '';
  const C = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

  if (!q) return { statusCode: 400, headers: C, body: JSON.stringify({ erro: 'Parametro q obrigatorio.' }) };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         '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',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `Você é especialista em preços de hardware no mercado brasileiro.
Retorne SOMENTE um JSON válido (sem markdown, sem texto extra) com o preço médio atual de: "${q}"

Formato exato:
{"valorBase":2500,"totalResultados":6,"anuncios":[{"titulo":"Produto A","preco":2400,"condicao":"Novo","link":"#","thumbnail":""},{"titulo":"Produto B usado","preco":1800,"condicao":"Usado","link":"#","thumbnail":""}]}`
        }],
      }),
    });

    const raw = await resp.text();

    if (!resp.ok) {
      return { statusCode: 200, headers: C, body: JSON.stringify({ erro: 'Anthropic erro ' + resp.status + ': ' + raw.slice(0,200) }) };
    }

    let data;
    try { data = JSON.parse(raw); } catch(e) {
      return { statusCode: 200, headers: C, body: JSON.stringify({ erro: 'Parse erro resposta Anthropic: ' + raw.slice(0,200) }) };
    }

    const text = data.content && data.content[0] && data.content[0].text || '';
    const clean = text.replace(/```json|```/g, '').trim();

    let result;
    try { result = JSON.parse(clean); } catch(e) {
      return { statusCode: 200, headers: C, body: JSON.stringify({ erro: 'IA retornou JSON invalido: ' + clean.slice(0,200) }) };
    }

    if (!result.valorBase) {
      return { statusCode: 200, headers: C, body: JSON.stringify({ erro: 'IA nao retornou valorBase. Resposta: ' + clean.slice(0,200) }) };
    }

    return { statusCode: 200, headers: C, body: JSON.stringify({
      encontrado:      true,
      valorBase:       Math.round(result.valorBase),
      totalResultados: result.totalResultados || (result.anuncios || []).length,
      anuncios:        result.anuncios || [],
    })};

  } catch(err) {
    return { statusCode: 200, headers: C, body: JSON.stringify({ erro: 'Excecao: ' + err.message }) };
  }
};
