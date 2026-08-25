const arquivos = require("node:fs/promises");
const caminho = require("node:path");

const VERSAO_ESQUEMA = 2;

/**
 * O esquema funciona como uma lista de permissões para o arquivo de configuração.
 * Além de fornecer os valores iniciais, ele impede que objetos ou chaves arbitrárias
 * enviados pela interface sejam gravados no computador.
 */
const esquemaConfiguracoes = {
  versaoEsquema: { tipo: "inteiro", padrao: VERSAO_ESQUEMA, minimo: 1, maximo: VERSAO_ESQUEMA },
  audio: {
    somGeralAtivo: { tipo: "booleano", padrao: true },
    efeitos: {
      ativo: { tipo: "booleano", padrao: true },
      volume: { tipo: "numero", padrao: 1, minimo: 0, maximo: 1 },
    },
    ambiente: {
      ativo: { tipo: "booleano", padrao: true },
      volume: { tipo: "numero", padrao: 1, minimo: 0, maximo: 1 },
    },
    musica: {
      ativo: { tipo: "booleano", padrao: true },
      volume: { tipo: "numero", padrao: 0.72, minimo: 0, maximo: 1 },
    },
    perfil: {
      tipo: "enum",
      padrao: "imersivo",
      valores: ["silencioso", "discreto", "imersivo", "personalizado"],
    },
    ducking: {
      ativo: { tipo: "booleano", padrao: true },
      nivel: { tipo: "numero", padrao: 0.8, minimo: 0.1, maximo: 1 },
      retornoMs: { tipo: "inteiro", padrao: 380, minimo: 80, maximo: 3000 },
    },
  },
  geral: {
    nomeSistema: { tipo: "texto", padrao: "Horta Inteligente", maximo: 80 },
    perfilSistema: {
      tipo: "enum",
      padrao: "padrao",
      valores: ["padrao", "apresentacao", "noturno", "foco", "musica"],
    },
  },
  aparencia: {
    modoCor: {
      tipo: "enum",
      padrao: "cultivo",
      valores: ["sistema", "cultivo", "escuro", "claro"],
    },
    atmosfera: {
      tipo: "enum",
      padrao: "natural",
      valores: ["natural", "noturno", "tecno", "neutro", "personalizado"],
    },
    corDestaque: {
      tipo: "enum",
      padrao: "cultivo",
      valores: ["cultivo", "azul", "roxo", "ambar", "ciano", "rosa", "personalizada"],
    },
    corPersonalizada: { tipo: "cor", padrao: "#65d99a" },
    intensidadeVisual: {
      tipo: "enum",
      padrao: "normal",
      valores: ["sutil", "normal", "vibrante"],
    },
    temaAutomatico: {
      ativo: { tipo: "booleano", padrao: false },
      inicio: { tipo: "horario", padrao: "20:00" },
      fim: { tipo: "horario", padrao: "07:00" },
    },
  },
  estacao: {
    // O caminho só pode ser modificado internamente após o diálogo nativo de pasta.
    pastaBiblioteca: { tipo: "textoNulo", padrao: null, maximo: 4096 },
    aleatorio: { tipo: "booleano", padrao: false },
    repeticao: {
      tipo: "enum",
      padrao: "biblioteca",
      valores: ["desativada", "biblioteca", "faixa"],
    },
    retomarSessao: { tipo: "booleano", padrao: true },
    retomarPosicao: { tipo: "booleano", padrao: true },
    mostrarMiniPlayer: { tipo: "booleano", padrao: true },
    mostrarVisualizador: { tipo: "booleano", padrao: true },
    modoImersivo: { tipo: "booleano", padrao: false },
    musicaSilenciada: { tipo: "booleano", padrao: false },
    favoritas: { tipo: "listaTextos", padrao: [], maximo: 10000 },
    recentes: { tipo: "listaTextos", padrao: [], maximo: 50 },
    fila: { tipo: "listaTextos", padrao: [], maximo: 2000 },
    ultimaFaixaId: { tipo: "identificadorNulo", padrao: null },
    posicao: { tipo: "numero", padrao: 0, minimo: 0, maximo: 60 * 60 * 24 * 30 },
  },
  interface: {
    animacoesAtivas: { tipo: "booleano", padrao: true },
    intensidadeAnimacoes: {
      tipo: "enum",
      padrao: "normal",
      valores: ["reduzida", "normal", "alta"],
    },
    efeitosFundoAtivos: { tipo: "booleano", padrao: true },
    microinteracoesAtivas: { tipo: "booleano", padrao: true },
    visualizadorMusicaAtivo: { tipo: "booleano", padrao: true },
    indicadorNovaLeituraAtivo: { tipo: "booleano", padrao: true },
    modoFoco: { tipo: "booleano", padrao: false },
    modoApresentacao: { tipo: "booleano", padrao: false },
    modoAmbienteMinutos: {
      tipo: "enumNumero",
      padrao: 0,
      valores: [0, 2, 5, 10, 20],
    },
  },
  horta: {
    nomePlanta: { tipo: "texto", padrao: "", maximo: 80 },
    limiteUmidadeMinima: { tipo: "numero", padrao: 45, minimo: 0, maximo: 100 },
    limiteUmidadeMaxima: { tipo: "numero", padrao: 72, minimo: 0, maximo: 100 },
    horarioIluminacaoInicio: { tipo: "horario", padrao: "08:00" },
    horarioIluminacaoFim: { tipo: "horario", padrao: "20:00" },
    modoAutomatico: { tipo: "booleano", padrao: true },
  },
  acessibilidade: {
    reduzirMovimentos: { tipo: "booleano", padrao: false },
    altoContraste: { tipo: "booleano", padrao: false },
    aumentarTextos: { tipo: "booleano", padrao: false },
    desativarTransparencias: { tipo: "booleano", padrao: false },
    semVisualizador: { tipo: "booleano", padrao: false },
    silenciarTudo: { tipo: "booleano", padrao: false },
  },
};

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function limitarNumero(valor, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, valor));
}

function normalizarTexto(valor, padrao, maximo) {
  if (typeof valor !== "string") {
    return padrao;
  }

  return valor.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maximo);
}

function normalizarFolha(descricao, valor, valorBase) {
  const padrao = valorBase === undefined ? descricao.padrao : valorBase;

  switch (descricao.tipo) {
    case "booleano":
      return typeof valor === "boolean" ? valor : padrao;
    case "numero":
      return Number.isFinite(valor)
        ? limitarNumero(valor, descricao.minimo, descricao.maximo)
        : padrao;
    case "inteiro":
      return Number.isInteger(valor)
        ? limitarNumero(valor, descricao.minimo, descricao.maximo)
        : padrao;
    case "enum":
    case "enumNumero":
      return descricao.valores.includes(valor) ? valor : padrao;
    case "texto":
      return normalizarTexto(valor, padrao, descricao.maximo);
    case "textoNulo":
      return valor === null ? null : normalizarTexto(valor, padrao, descricao.maximo);
    case "horario":
      return typeof valor === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(valor)
        ? valor
        : padrao;
    case "cor":
      return typeof valor === "string" && /^#[\da-f]{6}$/i.test(valor) ? valor.toLowerCase() : padrao;
    case "identificadorNulo":
      return valor === null || (typeof valor === "string" && /^[\da-f]{64}$/i.test(valor))
        ? valor
        : padrao;
    case "listaTextos": {
      if (!Array.isArray(valor)) {
        return clonar(padrao);
      }

      const itens = valor
        .filter((item) => typeof item === "string" && /^[\da-f]{64}$/i.test(item))
        .map((item) => item.toLowerCase());

      return [...new Set(itens)].slice(0, descricao.maximo);
    }
    default:
      return clonar(descricao.padrao);
  }
}

/**
 * Percorre somente as propriedades declaradas no esquema. Chaves desconhecidas
 * são descartadas, inclusive quando aparecem dentro de objetos conhecidos.
 */
function normalizarObjeto(esquema, entrada, base = {}) {
  const origem = entrada && typeof entrada === "object" && !Array.isArray(entrada) ? entrada : {};
  const resultado = {};

  for (const [chave, descricao] of Object.entries(esquema)) {
    if (descricao && typeof descricao === "object" && Object.hasOwn(descricao, "tipo")) {
      resultado[chave] = normalizarFolha(descricao, origem[chave], base?.[chave]);
      continue;
    }

    resultado[chave] = normalizarObjeto(descricao, origem[chave], base?.[chave]);
  }

  return resultado;
}

const configuracoesPadrao = normalizarObjeto(esquemaConfiguracoes, {});

function ajustarCoerencia(estado) {
  const ajustado = clonar(estado);

  if (ajustado.horta.limiteUmidadeMinima > ajustado.horta.limiteUmidadeMaxima) {
    const limiteTemporario = ajustado.horta.limiteUmidadeMinima;
    ajustado.horta.limiteUmidadeMinima = ajustado.horta.limiteUmidadeMaxima;
    ajustado.horta.limiteUmidadeMaxima = limiteTemporario;
  }

  ajustado.versaoEsquema = VERSAO_ESQUEMA;
  return ajustado;
}

async function escreverJsonAtomico(caminhoArquivo, conteudo) {
  const diretorio = caminho.dirname(caminhoArquivo);
  const caminhoTemporario = `${caminhoArquivo}.${process.pid}.${Date.now()}.temporario`;

  await arquivos.mkdir(diretorio, { recursive: true });
  await arquivos.writeFile(caminhoTemporario, `${JSON.stringify(conteudo, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    await arquivos.rename(caminhoTemporario, caminhoArquivo);
  } catch (erro) {
    await arquivos.rm(caminhoTemporario, { force: true }).catch(() => {});
    throw erro;
  }
}

function criarServicoConfiguracoes(diretorioDados) {
  const caminhoConfiguracoes = caminho.join(diretorioDados, "configuracoes.json");
  let estadoAtual = clonar(configuracoesPadrao);
  let inicializado = false;
  let filaEscritas = Promise.resolve();

  function enfileirarEscrita(estado) {
    const instantaneo = clonar(estado);
    filaEscritas = filaEscritas
      .catch(() => {})
      .then(() => escreverJsonAtomico(caminhoConfiguracoes, instantaneo));
    return filaEscritas;
  }

  async function inicializar() {
    if (inicializado) {
      return clonar(estadoAtual);
    }

    await arquivos.mkdir(diretorioDados, { recursive: true });

    try {
      const conteudo = await arquivos.readFile(caminhoConfiguracoes, "utf8");
      const configuracoesLidas = JSON.parse(conteudo);
      estadoAtual = ajustarCoerencia(
        normalizarObjeto(esquemaConfiguracoes, configuracoesLidas, configuracoesPadrao),
      );
    } catch (erro) {
      if (erro.code !== "ENOENT") {
        const caminhoCorrompido = `${caminhoConfiguracoes}.corrompido-${Date.now()}`;
        await arquivos.rename(caminhoConfiguracoes, caminhoCorrompido).catch(() => {});
      }

      estadoAtual = clonar(configuracoesPadrao);
      await enfileirarEscrita(estadoAtual);
    }

    inicializado = true;
    return clonar(estadoAtual);
  }

  async function carregar() {
    await inicializar();
    return clonar(estadoAtual);
  }

  /**
   * O renderer pode atualizar o estado completo, mas não pode escolher um caminho
   * no disco: `pastaBiblioteca` só muda pelo diálogo nativo da biblioteca.
   */
  async function salvarDoRenderer(novoEstado) {
    await inicializar();
    const normalizado = normalizarObjeto(esquemaConfiguracoes, novoEstado, estadoAtual);
    normalizado.estacao.pastaBiblioteca = estadoAtual.estacao.pastaBiblioteca;
    estadoAtual = ajustarCoerencia(normalizado);
    await enfileirarEscrita(estadoAtual);
    return clonar(estadoAtual);
  }

  async function atualizarPastaBiblioteca(pastaBiblioteca) {
    await inicializar();
    const entrada = clonar(estadoAtual);
    entrada.estacao.pastaBiblioteca = pastaBiblioteca;
    estadoAtual = ajustarCoerencia(
      normalizarObjeto(esquemaConfiguracoes, entrada, estadoAtual),
    );
    await enfileirarEscrita(estadoAtual);
    return clonar(estadoAtual);
  }

  async function finalizar() {
    await filaEscritas.catch(() => {});
  }

  return {
    inicializar,
    carregar,
    salvarDoRenderer,
    atualizarPastaBiblioteca,
    finalizar,
    obterDiretorioDados: () => diretorioDados,
  };
}

module.exports = {
  criarServicoConfiguracoes,
  configuracoesPadrao,
};
