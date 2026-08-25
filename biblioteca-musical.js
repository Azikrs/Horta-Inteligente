const arquivos = require("node:fs/promises");
const caminho = require("node:path");
const criptografia = require("node:crypto");
const { dialog, nativeImage } = require("electron");

const VERSAO_CACHE = 1;
const PROFUNDIDADE_MAXIMA = 20;
const QUANTIDADE_MAXIMA_FAIXAS = 10000;
const TAMANHO_MAXIMO_ARQUIVO = 8 * 1024 * 1024 * 1024;
const TAMANHO_MAXIMO_CAPA = 12 * 1024 * 1024;
const DIMENSAO_MAXIMA_CAPA = 1200;

const formatosCompativeis = new Map([
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".ogg", "audio/ogg"],
  [".opus", "audio/ogg"],
  [".flac", "audio/flac"],
  [".m4a", "audio/mp4"],
  [".aac", "audio/aac"],
]);

let promessaModuloMetadados = null;

function carregarModuloMetadados() {
  if (!promessaModuloMetadados) {
    // music-metadata é ESM. O import dinâmico mantém o restante do Electron em CommonJS.
    promessaModuloMetadados = import("music-metadata");
  }

  return promessaModuloMetadados;
}

function clonar(valor) {
  return JSON.parse(JSON.stringify(valor));
}

function normalizarCaminhoParaId(caminhoArquivo) {
  const normalizado = caminho.normalize(caminho.resolve(caminhoArquivo));
  return process.platform === "win32" ? normalizado.toLocaleLowerCase("pt-BR") : normalizado;
}

function criarIdentificador(caminhoArquivo) {
  return criptografia.createHash("sha256").update(normalizarCaminhoParaId(caminhoArquivo)).digest("hex");
}

function caminhoEstaDentro(diretorioRaiz, caminhoCandidato) {
  const relativo = caminho.relative(diretorioRaiz, caminhoCandidato);
  return (
    relativo === "" ||
    (relativo !== ".." && !relativo.startsWith(`..${caminho.sep}`) && !caminho.isAbsolute(relativo))
  );
}

function limparTexto(valor, limite = 240) {
  if (typeof valor !== "string") {
    return "";
  }

  return valor.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function obterFallbackDoNome(caminhoArquivo) {
  const nomeBase = caminho.basename(caminhoArquivo, caminho.extname(caminhoArquivo));
  const partes = nomeBase.split(/\s+[-–—]\s+/).map((parte) => limparTexto(parte)).filter(Boolean);

  if (partes.length >= 2) {
    return {
      artista: partes.slice(0, -1).join(" — "),
      titulo: partes.at(-1),
    };
  }

  return {
    artista: "Artista desconhecido",
    titulo: limparTexto(nomeBase) || "Faixa sem título",
  };
}

async function escreverJsonAtomico(caminhoArquivo, conteudo) {
  const caminhoTemporario = `${caminhoArquivo}.${process.pid}.${Date.now()}.temporario`;
  await arquivos.mkdir(caminho.dirname(caminhoArquivo), { recursive: true });
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

function criarCacheVazio(pasta = null) {
  return {
    versaoEsquema: VERSAO_CACHE,
    pasta,
    ultimaAtualizacao: null,
    erros: 0,
    faixas: [],
  };
}

function validarFaixaDoCache(faixa, pasta) {
  if (!faixa || typeof faixa !== "object") {
    return null;
  }

  const caminhoArquivo = typeof faixa.caminhoArquivo === "string" ? caminho.resolve(faixa.caminhoArquivo) : "";
  const extensao = caminho.extname(caminhoArquivo).toLowerCase();

  if (
    !/^[\da-f]{64}$/i.test(faixa.id ?? "") ||
    !caminhoArquivo ||
    !formatosCompativeis.has(extensao) ||
    !caminhoEstaDentro(pasta, caminhoArquivo) ||
    faixa.id.toLowerCase() !== criarIdentificador(caminhoArquivo)
  ) {
    return null;
  }

  return {
    id: faixa.id.toLowerCase(),
    caminhoArquivo,
    tamanho: Number.isFinite(faixa.tamanho) ? faixa.tamanho : 0,
    modificacaoMs: Number.isFinite(faixa.modificacaoMs) ? faixa.modificacaoMs : 0,
    extensao,
    titulo: limparTexto(faixa.titulo) || obterFallbackDoNome(caminhoArquivo).titulo,
    artista: limparTexto(faixa.artista) || "Artista desconhecido",
    album: limparTexto(faixa.album) || "Sem álbum",
    duracao: Number.isFinite(faixa.duracao) && faixa.duracao >= 0 ? faixa.duracao : null,
    numeroFaixa: Number.isInteger(faixa.numeroFaixa) && faixa.numeroFaixa > 0 ? faixa.numeroFaixa : null,
    numeroDisco: Number.isInteger(faixa.numeroDisco) && faixa.numeroDisco > 0 ? faixa.numeroDisco : null,
    ano: Number.isInteger(faixa.ano) && faixa.ano >= 1000 && faixa.ano <= 9999 ? faixa.ano : null,
    capaId: /^[\da-f]{64}$/i.test(faixa.capaId ?? "") ? faixa.capaId.toLowerCase() : null,
  };
}

function criarServicoBiblioteca({
  diretorioDados,
  servicoConfiguracoes,
  notificarProgresso = () => {},
}) {
  const caminhoCache = caminho.join(diretorioDados, "biblioteca-musical.json");
  const diretorioCapas = caminho.join(diretorioDados, "capas");
  let cache = criarCacheVazio();
  let inicializado = false;
  let promessaVarredura = null;
  let filaEscritas = Promise.resolve();
  const faixasPorId = new Map();
  const capasPorId = new Map();

  function emitirProgresso(dados) {
    notificarProgresso({
      fase: dados.fase,
      processados: Number.isInteger(dados.processados) ? dados.processados : 0,
      total: Number.isInteger(dados.total) ? dados.total : 0,
      encontrados: Number.isInteger(dados.encontrados) ? dados.encontrados : 0,
      erros: Number.isInteger(dados.erros) ? dados.erros : 0,
      ...(dados.nomeArquivo ? { nomeArquivo: limparTexto(dados.nomeArquivo, 180) } : {}),
      ...(dados.mensagem ? { mensagem: limparTexto(dados.mensagem, 300) } : {}),
    });
  }

  function reconstruirMapas() {
    faixasPorId.clear();
    capasPorId.clear();

    for (const faixa of cache.faixas) {
      faixasPorId.set(faixa.id, faixa);

      if (faixa.capaId) {
        capasPorId.set(faixa.capaId, caminho.join(diretorioCapas, `${faixa.capaId}.png`));
      }
    }
  }

  function enfileirarCache() {
    const instantaneo = clonar(cache);
    filaEscritas = filaEscritas
      .catch(() => {})
      .then(() => escreverJsonAtomico(caminhoCache, instantaneo));
    return filaEscritas;
  }

  async function inicializar() {
    if (inicializado) {
      return obterBibliotecaPublica();
    }

    await arquivos.mkdir(diretorioCapas, { recursive: true });
    const configuracoes = await servicoConfiguracoes.carregar();
    const pastaConfigurada = configuracoes.estacao.pastaBiblioteca;

    try {
      const conteudo = JSON.parse(await arquivos.readFile(caminhoCache, "utf8"));
      const pastaLida = typeof conteudo.pasta === "string" ? caminho.resolve(conteudo.pasta) : null;
      const pasta = pastaConfigurada ? caminho.resolve(pastaConfigurada) : pastaLida;

      if (pasta) {
        const faixas = Array.isArray(conteudo.faixas)
          ? conteudo.faixas.map((faixa) => validarFaixaDoCache(faixa, pasta)).filter(Boolean)
          : [];

        cache = {
          versaoEsquema: VERSAO_CACHE,
          pasta,
          ultimaAtualizacao:
            typeof conteudo.ultimaAtualizacao === "string" ? conteudo.ultimaAtualizacao : null,
          erros: Number.isInteger(conteudo.erros) && conteudo.erros >= 0 ? conteudo.erros : 0,
          faixas,
        };
      }
    } catch (erro) {
      if (erro.code !== "ENOENT") {
        await arquivos.rename(caminhoCache, `${caminhoCache}.corrompido-${Date.now()}`).catch(() => {});
      }
    }

    // A configuração pode sobreviver mesmo que o índice tenha sido apagado. Nesse caso,
    // preservamos a pasta e aguardamos um reescaneamento, sem apagar a escolha do usuário.
    if (!cache.pasta && pastaConfigurada) {
      cache.pasta = caminho.resolve(pastaConfigurada);
    }

    if (cache.pasta !== pastaConfigurada) {
      await servicoConfiguracoes.atualizarPastaBiblioteca(cache.pasta);
    }

    reconstruirMapas();
    inicializado = true;
    return obterBibliotecaPublica();
  }

  async function listarArquivosDeAudio(diretorioRaiz) {
    const encontrados = [];
    const diretoriosVisitados = new Set();
    const raizReal = await arquivos.realpath(diretorioRaiz);

    async function visitar(diretorioAtual, profundidade) {
      if (profundidade > PROFUNDIDADE_MAXIMA || encontrados.length >= QUANTIDADE_MAXIMA_FAIXAS) {
        return;
      }

      const informacaoDiretorio = await arquivos.lstat(diretorioAtual);
      if (!informacaoDiretorio.isDirectory() || informacaoDiretorio.isSymbolicLink()) {
        return;
      }

      const diretorioReal = await arquivos.realpath(diretorioAtual);
      if (!caminhoEstaDentro(raizReal, diretorioReal)) {
        return;
      }

      const chaveDiretorio = normalizarCaminhoParaId(diretorioReal);
      if (diretoriosVisitados.has(chaveDiretorio)) {
        return;
      }
      diretoriosVisitados.add(chaveDiretorio);

      const entradas = await arquivos.readdir(diretorioReal, { withFileTypes: true });
      entradas.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

      for (const entrada of entradas) {
        if (encontrados.length >= QUANTIDADE_MAXIMA_FAIXAS) {
          break;
        }

        const caminhoEntrada = caminho.join(diretorioReal, entrada.name);

        if (entrada.isSymbolicLink()) {
          continue;
        }

        if (entrada.isDirectory()) {
          await visitar(caminhoEntrada, profundidade + 1).catch(() => {});
          continue;
        }

        const extensao = caminho.extname(entrada.name).toLowerCase();
        if (!entrada.isFile() || !formatosCompativeis.has(extensao)) {
          continue;
        }

        const informacaoArquivo = await arquivos.lstat(caminhoEntrada).catch(() => null);
        if (
          !informacaoArquivo?.isFile() ||
          informacaoArquivo.isSymbolicLink() ||
          informacaoArquivo.size <= 0 ||
          informacaoArquivo.size > TAMANHO_MAXIMO_ARQUIVO
        ) {
          continue;
        }

        encontrados.push({
          caminhoArquivo: caminhoEntrada,
          extensao,
          tamanho: informacaoArquivo.size,
          modificacaoMs: informacaoArquivo.mtimeMs,
        });
      }
    }

    await visitar(raizReal, 0);
    return { raizReal, encontrados };
  }

  async function armazenarCapa(imagemAnexada) {
    if (!imagemAnexada?.data || imagemAnexada.data.byteLength > TAMANHO_MAXIMO_CAPA) {
      return null;
    }

    const dadosOriginais = Buffer.from(imagemAnexada.data);
    const capaId = criptografia.createHash("sha256").update(dadosOriginais).digest("hex");
    const caminhoCapa = caminho.join(diretorioCapas, `${capaId}.png`);

    try {
      await arquivos.access(caminhoCapa);
      capasPorId.set(capaId, caminhoCapa);
      return capaId;
    } catch {
      // A capa ainda não foi processada.
    }

    let imagem = nativeImage.createFromBuffer(dadosOriginais);
    if (imagem.isEmpty()) {
      return null;
    }

    const { width: largura, height: altura } = imagem.getSize();
    if (largura <= 0 || altura <= 0 || largura > 12000 || altura > 12000) {
      return null;
    }

    if (largura > DIMENSAO_MAXIMA_CAPA || altura > DIMENSAO_MAXIMA_CAPA) {
      const escala = Math.min(DIMENSAO_MAXIMA_CAPA / largura, DIMENSAO_MAXIMA_CAPA / altura);
      imagem = imagem.resize({
        width: Math.max(1, Math.round(largura * escala)),
        height: Math.max(1, Math.round(altura * escala)),
        quality: "good",
      });
    }

    const dadosPng = imagem.toPNG();
    if (!dadosPng.length || dadosPng.length > TAMANHO_MAXIMO_CAPA * 2) {
      return null;
    }

    await arquivos.writeFile(caminhoCapa, dadosPng, { flag: "wx", mode: 0o600 }).catch((erro) => {
      if (erro.code !== "EEXIST") {
        throw erro;
      }
    });
    capasPorId.set(capaId, caminhoCapa);
    return capaId;
  }

  async function lerFaixa(itemArquivo, moduloMetadados) {
    const fallback = obterFallbackDoNome(itemArquivo.caminhoArquivo);
    const base = {
      id: criarIdentificador(itemArquivo.caminhoArquivo),
      caminhoArquivo: itemArquivo.caminhoArquivo,
      tamanho: itemArquivo.tamanho,
      modificacaoMs: itemArquivo.modificacaoMs,
      extensao: itemArquivo.extensao,
      titulo: fallback.titulo,
      artista: fallback.artista,
      album: "Sem álbum",
      duracao: null,
      numeroFaixa: null,
      numeroDisco: null,
      ano: null,
      capaId: null,
    };

    if (!moduloMetadados) {
      return base;
    }

    const metadados = await moduloMetadados.parseFile(itemArquivo.caminhoArquivo, { duration: true });
    const comuns = metadados.common ?? {};
    const capa = moduloMetadados.selectCover(comuns.picture);

    return {
      ...base,
      titulo: limparTexto(comuns.title) || fallback.titulo,
      artista: limparTexto(comuns.artist) || fallback.artista,
      album: limparTexto(comuns.album) || "Sem álbum",
      duracao:
        Number.isFinite(metadados.format?.duration) && metadados.format.duration >= 0
          ? metadados.format.duration
          : null,
      numeroFaixa: Number.isInteger(comuns.track?.no) && comuns.track.no > 0 ? comuns.track.no : null,
      numeroDisco: Number.isInteger(comuns.disk?.no) && comuns.disk.no > 0 ? comuns.disk.no : null,
      ano: Number.isInteger(comuns.year) && comuns.year >= 1000 && comuns.year <= 9999 ? comuns.year : null,
      capaId: await armazenarCapa(capa).catch(() => null),
    };
  }

  async function executarVarredura(pastaSelecionada) {
    emitirProgresso({ fase: "procurando" });
    const { raizReal, encontrados } = await listarArquivosDeAudio(pastaSelecionada);
    const faixasAntigas = new Map(
      cache.faixas.map((faixa) => [normalizarCaminhoParaId(faixa.caminhoArquivo), faixa]),
    );
    const novasFaixas = [];
    let erros = 0;
    let moduloMetadados = null;

    try {
      moduloMetadados = await carregarModuloMetadados();
    } catch {
      erros += 1;
    }

    for (let indice = 0; indice < encontrados.length; indice += 1) {
      const itemArquivo = encontrados[indice];
      const anterior = faixasAntigas.get(normalizarCaminhoParaId(itemArquivo.caminhoArquivo));
      let faixa = null;

      if (
        anterior &&
        anterior.tamanho === itemArquivo.tamanho &&
        Math.abs(anterior.modificacaoMs - itemArquivo.modificacaoMs) < 1
      ) {
        faixa = anterior;
      } else {
        try {
          faixa = await lerFaixa(itemArquivo, moduloMetadados);
        } catch {
          erros += 1;
          faixa = await lerFaixa(itemArquivo, null);
        }
      }

      novasFaixas.push(faixa);
      emitirProgresso({
        fase: "lendo",
        processados: indice + 1,
        total: encontrados.length,
        encontrados: novasFaixas.length,
        erros,
        nomeArquivo: caminho.basename(itemArquivo.caminhoArquivo),
      });
    }

    novasFaixas.sort((faixaA, faixaB) => {
      const porArtista = faixaA.artista.localeCompare(faixaB.artista, "pt-BR", { sensitivity: "base" });
      if (porArtista !== 0) return porArtista;
      const porAlbum = faixaA.album.localeCompare(faixaB.album, "pt-BR", { sensitivity: "base" });
      if (porAlbum !== 0) return porAlbum;
      if (faixaA.numeroFaixa && faixaB.numeroFaixa && faixaA.numeroFaixa !== faixaB.numeroFaixa) {
        return faixaA.numeroFaixa - faixaB.numeroFaixa;
      }
      return faixaA.titulo.localeCompare(faixaB.titulo, "pt-BR", { sensitivity: "base" });
    });

    cache = {
      versaoEsquema: VERSAO_CACHE,
      pasta: raizReal,
      ultimaAtualizacao: new Date().toISOString(),
      erros,
      faixas: novasFaixas,
    };
    reconstruirMapas();

    emitirProgresso({
      fase: "salvando",
      processados: novasFaixas.length,
      total: novasFaixas.length,
      encontrados: novasFaixas.length,
      erros,
    });

    await Promise.all([
      enfileirarCache(),
      servicoConfiguracoes.atualizarPastaBiblioteca(raizReal),
    ]);

    emitirProgresso({
      fase: "concluido",
      processados: novasFaixas.length,
      total: novasFaixas.length,
      encontrados: novasFaixas.length,
      erros,
    });
    return obterBibliotecaPublica();
  }

  function varrer(pastaSelecionada) {
    if (promessaVarredura) {
      return promessaVarredura;
    }

    promessaVarredura = executarVarredura(pastaSelecionada)
      .catch((erro) => {
        emitirProgresso({
          fase: "erro",
          erros: 1,
          mensagem: "Não foi possível ler a pasta de músicas.",
        });
        throw erro;
      })
      .finally(() => {
        promessaVarredura = null;
      });

    return promessaVarredura;
  }

  async function escolherPasta(janelaPrincipal) {
    await inicializar();
    const resultado = await dialog.showOpenDialog(janelaPrincipal, {
      title: "Escolher biblioteca de músicas",
      buttonLabel: "Usar esta pasta",
      defaultPath: cache.pasta ?? undefined,
      properties: ["openDirectory"],
    });

    if (resultado.canceled || !resultado.filePaths[0]) {
      return { ...obterBibliotecaPublica(), cancelado: true };
    }

    return varrer(resultado.filePaths[0]);
  }

  async function reescanear() {
    await inicializar();
    if (!cache.pasta) {
      return obterBibliotecaPublica();
    }
    return varrer(cache.pasta);
  }

  function obterBibliotecaPublica() {
    const pasta = cache.pasta;
    return {
      disponivel: Boolean(pasta),
      pasta,
      nomePasta: pasta ? caminho.basename(pasta) : null,
      quantidade: cache.faixas.length,
      ultimaAtualizacao: cache.ultimaAtualizacao,
      erros: cache.erros,
      faixas: cache.faixas.map((faixa) => {
        const urlAudio = `horta://aplicativo/midia/faixa/${faixa.id}`;
        const urlCapa = faixa.capaId
          ? `horta://aplicativo/midia/capa/${faixa.capaId}`
          : null;

        return {
          id: faixa.id,
          titulo: faixa.titulo,
          artista: faixa.artista,
          album: faixa.album,
          duracao: faixa.duracao,
          numeroFaixa: faixa.numeroFaixa,
          numeroDisco: faixa.numeroDisco,
          ano: faixa.ano,
          extensao: faixa.extensao.slice(1),
          // Os dois pares mantêm compatibilidade entre a Central e o player sem
          // revelar o caminho real que originou a URL opaca.
          urlAudio,
          urlCapa,
          audioUrl: urlAudio,
          capaUrl: urlCapa,
        };
      }),
    };
  }

  async function obter() {
    await inicializar();
    return obterBibliotecaPublica();
  }

  /**
   * O protocolo recebe apenas IDs opacos. Antes de servir qualquer arquivo, o caminho
   * salvo é revalidado para impedir troca por link simbólico ou fuga da pasta escolhida.
   */
  async function resolverMidia(tipo, identificador) {
    await inicializar();
    if (!/^[\da-f]{64}$/i.test(identificador ?? "")) {
      return null;
    }

    const id = identificador.toLowerCase();

    if (tipo === "capa") {
      const caminhoCapa = capasPorId.get(id);
      if (!caminhoCapa || !caminhoEstaDentro(diretorioCapas, caminhoCapa)) {
        return null;
      }

      const informacao = await arquivos.lstat(caminhoCapa).catch(() => null);
      return informacao?.isFile() && !informacao.isSymbolicLink()
        ? { caminhoArquivo: caminhoCapa, tipoMime: "image/png" }
        : null;
    }

    if (tipo !== "faixa" || !cache.pasta) {
      return null;
    }

    const faixa = faixasPorId.get(id);
    if (!faixa || !formatosCompativeis.has(faixa.extensao)) {
      return null;
    }

    const informacao = await arquivos.lstat(faixa.caminhoArquivo).catch(() => null);
    if (!informacao?.isFile() || informacao.isSymbolicLink()) {
      return null;
    }

    const [raizReal, arquivoReal] = await Promise.all([
      arquivos.realpath(cache.pasta).catch(() => null),
      arquivos.realpath(faixa.caminhoArquivo).catch(() => null),
    ]);

    if (!raizReal || !arquivoReal || !caminhoEstaDentro(raizReal, arquivoReal)) {
      return null;
    }

    return {
      caminhoArquivo: arquivoReal,
      tipoMime: formatosCompativeis.get(faixa.extensao),
    };
  }

  async function finalizar() {
    await promessaVarredura?.catch(() => {});
    await filaEscritas.catch(() => {});
  }

  return {
    inicializar,
    escolherPasta,
    reescanear,
    obter,
    resolverMidia,
    finalizar,
  };
}

module.exports = {
  criarServicoBiblioteca,
  formatosCompativeis,
};
