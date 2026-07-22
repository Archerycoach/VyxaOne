/**
 * Descobre o indicador do INE com o valor mediano de venda por m² de
 * alojamentos familiares, e o código geográfico do teu município.
 *
 * Uso:
 *   node scripts/ine-descobrir-indicador.js
 *   node scripts/ine-descobrir-indicador.js Cascais
 *
 * A API do INE é pública e gratuita, mas limita pedidos por IP. O script vai
 * devagar de propósito (1 pedido por segundo) — demora, mas não é bloqueado.
 */

const MUNICIPIO = process.argv[2] || "Mafra";

// Candidatos conhecidos para "Valor mediano das vendas por m² de alojamentos
// familiares". O INE mudou de metodologia em 2018 e 2022, e cada versão tem
// código próprio; por isso se testam vários.
const CANDIDATOS = [
  "0012234", "0012235", "0012236", "0012237", "0012238",
  "0011654", "0011655", "0011656", "0011657",
  "0009836", "0009837", "0010047", "0010048",
];

const UA = "VyxaOne/1.0 (CRM imobiliario; uso pontual)";
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function pedir(url, tentativa = 1) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
    if (res.status === 429 && tentativa < 3) {
      console.log(`   (limite de pedidos — a esperar 20s)`);
      await pausa(20000);
      return pedir(url, tentativa + 1);
    }
    if (res.status !== 200) return { erro: `HTTP ${res.status}` };
    return { texto: await res.text() };
  } catch (error) {
    return { erro: error.message };
  }
}

(async () => {
  console.log(`A procurar o indicador do INE (município: ${MUNICIPIO})...\n`);

  const encontrados = [];

  for (const cod of CANDIDATOS) {
    const { texto, erro } = await pedir(
      `https://www.ine.pt/ine/json_indicador/pindicaMeta.jsp?varcd=${cod}&lang=PT`
    );
    await pausa(1000);

    if (erro) {
      console.log(`${cod}  ->  ${erro}`);
      continue;
    }

    let meta;
    try {
      meta = JSON.parse(texto)[0];
    } catch {
      console.log(`${cod}  ->  resposta não é JSON`);
      continue;
    }

    const nome = String(meta?.IndicadorNome || "");
    if (!nome) {
      console.log(`${cod}  ->  (sem nome)`);
      continue;
    }

    const relevante = /mediano|mediana/i.test(nome) && /m2|m²|metro/i.test(nome);
    const marca = relevante ? "***" : "   ";
    console.log(`${marca} ${cod}  ->  ${nome.slice(0, 105)}`);

    if (!relevante) continue;

    const categorias = meta?.Dimensoes?.Categoria_Dim || [];
    const periodos = (categorias[0]?.categoria || []).slice(-2).map((c) => c.categ_cod);
    const geo = categorias[1]?.categoria || [];
    const encontrado = geo.filter((c) => new RegExp(MUNICIPIO, "i").test(c.categ_dsg));

    console.log(`      periodicidade: ${meta.Periodic} · períodos recentes: ${periodos.join(", ")}`);
    console.log(`      localidades disponíveis: ${geo.length}`);
    if (encontrado.length) {
      for (const c of encontrado.slice(0, 6)) {
        console.log(`      ${MUNICIPIO}: ${c.categ_cod} = ${c.categ_dsg}`);
      }
      encontrados.push({ cod, nome, periodo: periodos[periodos.length - 1], geo: encontrado[0] });
    } else {
      console.log(`      ${MUNICIPIO}: não encontrado neste indicador`);
    }
  }

  console.log("\n================ RESUMO ================");
  if (encontrados.length === 0) {
    console.log("Nenhum candidato serviu. Envia este output — procuro outros códigos.");
    return;
  }

  for (const e of encontrados) {
    console.log(`\nIndicador: ${e.cod}`);
    console.log(`  ${e.nome.slice(0, 110)}`);
    console.log(`  Código de ${MUNICIPIO}: ${e.geo.categ_cod} (${e.geo.categ_dsg})`);
    console.log(`  Último período: ${e.periodo}`);

    // Valor real, para confirmar que os dados fazem sentido.
    const { texto, erro } = await pedir(
      `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=2&varcd=${e.cod}` +
        `&Dim1=${e.periodo}&Dim2=${e.geo.categ_cod}&lang=PT`
    );
    await pausa(1000);

    if (erro) {
      console.log(`  Valor: erro (${erro})`);
      continue;
    }

    try {
      const dados = JSON.parse(texto)[0];
      const bloco = dados?.Dados?.[e.periodo];
      const valor = bloco?.[0]?.valor;
      console.log(`  >>> VALOR: ${valor} €/m²`);
    } catch {
      console.log(`  Valor: resposta inesperada -> ${texto.slice(0, 160)}`);
    }
  }

  console.log("\nEnvia este resumo e ligo a avaliação a estes dados.");
})();
