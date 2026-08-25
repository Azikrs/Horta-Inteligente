"use strict";

(() => {
  const raiz = (window.HortaInteligente ??= {});
  const configuracoes = raiz.configuracoes;
  const ponte = window.ponteHorta?.biblioteca;
  const consultaMovimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

  const elementos = {
    pagina: document.querySelector("#pagina-estacao"),
    vazio: document.querySelector("#estado-vazio-estacao"),
    conteudo: document.querySelector("#conteudo-estacao"),
    audio: document.querySelector("#audio-estacao"),
    escolherPasta: document.querySelector("#botao-escolher-pasta-vazio"),
    abrirBiblioteca: document.querySelector("#botao-biblioteca-estacao"),
    progressoBiblioteca: document.querySelector("#progresso-biblioteca"),
    barraBiblioteca: document.querySelector("#barra-progresso-biblioteca"),
    textoBiblioteca: document.querySelector("#texto-progresso-biblioteca"),
    tituloVazio: document.querySelector("#titulo-estado-vazio"),
    descricaoVazio: document.querySelector("#descricao-estado-vazio"),
    listaBiblioteca: document.querySelector("#lista-biblioteca"),
    resumoBiblioteca: document.querySelector("#resumo-biblioteca-estacao"),
    busca: document.querySelector("#busca-biblioteca-estacao"),
    semResultados: document.querySelector("#sem-resultados-biblioteca"),
    titulo: document.querySelector("#titulo-musica-estacao"),
    artista: document.querySelector("#artista-musica-estacao"),
    album: document.querySelector("#album-musica-estacao"),
    estadoReproducao: document.querySelector("#estado-reproducao-estacao"),
    tempoTocando: document.querySelector("#tempo-tocando-estacao"),
    progressoMusica: document.querySelector("#controle-progresso-musica"),
    tempoAtual: document.querySelector("#tempo-atual-musica"),
    tempoRestante: document.querySelector("#tempo-restante-musica"),
    volume: document.querySelector("#controle-volume-musica"),
    valorVolume: document.querySelector("#valor-volume-musica"),
    mute: document.querySelector("#botao-mute-musica"),
    favorito: document.querySelector("#botao-favorito-estacao"),
    capa: document.querySelector("#capa-estacao"),
    imagemCapa: document.querySelector("#imagem-capa-estacao"),
    capaGenerativa: document.querySelector("#capa-generativa"),
    miniPlayer: document.querySelector("#mini-player"),
    miniTitulo: document.querySelector("#mini-player-titulo"),
    miniArtista: document.querySelector("#mini-player-artista"),
    miniCapa: document.querySelector("#mini-player-capa"),
    miniImagem: document.querySelector("#mini-player-imagem"),
    miniBarra: document.querySelector("#mini-player-barra"),
    listaFila: document.querySelector("#lista-fila-estacao"),
    filaVazia: document.querySelector("#fila-vazia-estacao"),
    quantidadeFila: document.querySelector("#quantidade-fila-estacao"),
    imersivo: document.querySelector("#botao-modo-imersivo"),
    visualizador: document.querySelector("#visualizador-estacao"),
    nivelEsquerdo: document.querySelector("#nivel-estereo-esquerdo"),
    nivelDireito: document.querySelector("#nivel-estereo-direito"),
    umidadeImersiva: document.querySelector("#umidade-imersiva"),
    bombaImersiva: document.querySelector("#bomba-imersiva"),
    luzImersiva: document.querySelector("#luz-imersiva"),
    arduinoImersivo: document.querySelector("#arduino-imersivo"),
  };

  if (!elementos.pagina || !elementos.audio) {
    return;
  }

  const estado = {
    biblioteca: [],
    faixasPorId: new Map(),
    musicaAtualId: null,
    fila: [],
    favoritas: new Set(),
    recentes: [],
    filtro: "todas",
    busca: "",
    aleatorio: false,
    repeticao: "biblioteca",
    iniciouFaixaAtual: false,
    segundoPersistido: -1,
    quadroVisualizador: 0,
    analisador: null,
    dadosFrequencia: null,
    ultimoQuadro: 0,
    arrasteFilaId: null,
    imersivo: false,
    historicoReproducao: [],
    tokenTroca: 0,
    versaoIntencaoReproducao: 0,
    duracaoAtual: 0,
    posicaoAtual: 0,
    ajustandoProgresso: false,
    proporcaoProgressoPendente: null,
    posicaoRestauracaoPendente: null,
    temporizadorErroAudio: 0,
    tokenModoImersivo: 0,
    carregandoAudio: false,
    ultimoErroAudioId: null,
    idsComErro: new Set(),
    paginaVisivel: false,
    removerProgressoBiblioteca: null,
  };

  const extensaoTexto = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

  function obterConfiguracao(caminho, padrao) {
    return configuracoes?.obter?.(caminho, padrao) ?? padrao;
  }

  function alterarConfiguracao(caminho, valor) {
    return configuracoes?.alterar?.(caminho, valor);
  }

  function notificar(titulo, descricao = "", tipo = "sucesso") {
    raiz.interfaceSistema?.notificar?.({ titulo, mensagem: descricao, tipo });
  }

  function normalizarTexto(valor) {
    return String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR");
  }

  function formatarTempo(segundos) {
    if (!Number.isFinite(segundos) || segundos < 0) return "0:00";
    const total = Math.floor(segundos);
    const minutos = Math.floor(total / 60);
    return `${minutos}:${String(total % 60).padStart(2, "0")}`;
  }

  function obterDuracaoNativa() {
    const duracao = elementos.audio.duration;
    return Number.isFinite(duracao) && duracao > 0 ? duracao : 0;
  }

  // A duracao lida pelo elemento de audio e a fonte principal. Enquanto os
  // metadados ainda carregam, a duracao indexada da musica mantem a interface util.
  function obterDuracaoEfetiva() {
    const duracaoNativa = obterDuracaoNativa();
    if (duracaoNativa) return duracaoNativa;
    if (Number.isFinite(estado.duracaoAtual) && estado.duracaoAtual > 0) return estado.duracaoAtual;
    const duracaoIndexada = Number(estado.faixasPorId.get(estado.musicaAtualId)?.duracao);
    return Number.isFinite(duracaoIndexada) && duracaoIndexada > 0 ? duracaoIndexada : 0;
  }

  function obterUrlAudio(faixa) {
    return faixa?.urlAudio ?? faixa?.url ?? faixa?.enderecoAudio ?? "";
  }

  function obterUrlCapa(faixa) {
    return faixa?.urlCapa ?? faixa?.capa ?? faixa?.enderecoCapa ?? "";
  }

  function adaptarFaixa(faixa, indice) {
    const tituloFallback = faixa?.nomeArquivo?.replace(/\.[^.]+$/, "") || `Faixa ${indice + 1}`;
    return {
      ...faixa,
      id: String(faixa?.id ?? `faixa-${indice}`),
      titulo: String(faixa?.titulo || tituloFallback),
      artista: String(faixa?.artista || "Artista desconhecido"),
      album: String(faixa?.album || "Sem álbum"),
      duracao: Number(faixa?.duracao) || 0,
      numeroFaixa: Number(faixa?.numeroFaixa ?? faixa?.faixa) || null,
      urlAudio: obterUrlAudio(faixa),
      urlCapa: obterUrlCapa(faixa),
    };
  }

  function extrairBiblioteca(resposta) {
    const faixas = Array.isArray(resposta) ? resposta : resposta?.faixas ?? resposta?.biblioteca ?? [];
    if (!Array.isArray(faixas)) return [];
    const idsEncontrados = new Set();
    return faixas
      .map(adaptarFaixa)
      .filter((faixa) => {
        if (!faixa.urlAudio || idsEncontrados.has(faixa.id)) return false;
        idsEncontrados.add(faixa.id);
        return true;
      });
  }

  function atualizarEstadoBiblioteca(resposta = {}, { publicarResumo = true } = {}) {
    const musicaAnteriorId = estado.musicaAtualId;
    const faixas = extrairBiblioteca(resposta);
    estado.biblioteca = faixas;
    estado.faixasPorId = new Map(faixas.map((faixa) => [faixa.id, faixa]));
    estado.favoritas = new Set(
      (obterConfiguracao("estacao.favoritas", []) ?? []).filter((id) => estado.faixasPorId.has(id)),
    );
    estado.recentes = (obterConfiguracao("estacao.recentes", []) ?? []).filter((id) => estado.faixasPorId.has(id));
    estado.fila = [...new Set((obterConfiguracao("estacao.fila", []) ?? []))]
      .filter((id) => estado.faixasPorId.has(id) && id !== estado.musicaAtualId);

    if (musicaAnteriorId && !estado.faixasPorId.has(musicaAnteriorId)) {
      limparMusicaAtual("A música atual não pertence mais à pasta selecionada.");
    } else if (musicaAnteriorId) {
      atualizarIdentificacao(estado.faixasPorId.get(musicaAnteriorId));
    }

    const possuiMusicas = faixas.length > 0;
    elementos.pagina.dataset.estadoBiblioteca = possuiMusicas ? "pronta" : "vazia";
    elementos.vazio.hidden = possuiMusicas;
    elementos.conteudo.hidden = !possuiMusicas;
    elementos.resumoBiblioteca.textContent = `${faixas.length} ${faixas.length === 1 ? "música encontrada" : "músicas encontradas"}`;

    if (publicarResumo) {
      raiz.interfaceSistema?.atualizarResumoBiblioteca?.({
        ...resposta,
        quantidade: faixas.length,
        faixas,
      });
    }

    renderizarBiblioteca();
    atualizarFila();
    atualizarDisponibilidadeControles();
    restaurarSessao();
  }

  async function carregarBiblioteca() {
    if (!ponte?.obter) {
      atualizarEstadoBiblioteca({ faixas: [] });
      elementos.descricaoVazio.textContent =
        "A seleção de pastas está disponível no aplicativo Electron. Execute npm start para usar a Estação local.";
      return;
    }

    try {
      const resposta = await ponte.obter();
      atualizarEstadoBiblioteca(resposta ?? {});
    } catch (erro) {
      console.error("Não foi possível carregar o índice musical.", erro);
      elementos.tituloVazio.textContent = "A biblioteca não pôde ser aberta.";
      elementos.descricaoVazio.textContent = "Tente selecionar a pasta novamente nas configurações da Estação.";
    }
  }

  async function escolherPasta() {
    if (!ponte?.escolherPasta) {
      notificar("Seleção indisponível", "Abra o projeto pelo Electron para escolher uma pasta.", "informacao");
      return;
    }

    definirLeituraBiblioteca(true, "Aguardando a escolha da pasta...");
    try {
      const resposta = await ponte.escolherPasta();
      if (resposta?.cancelado || resposta?.canceled) return;
      atualizarEstadoBiblioteca(resposta ?? {});
      if (estado.biblioteca.length) {
        notificar("Biblioteca conectada", `${estado.biblioteca.length} músicas prontas para a Estação.`);
      }
    } catch (erro) {
      console.error("Falha ao selecionar a biblioteca.", erro);
      notificar("Não foi possível ler a pasta", "Confira se os arquivos continuam acessíveis.", "erro");
    } finally {
      definirLeituraBiblioteca(false);
    }
  }

  function definirLeituraBiblioteca(ativo, texto = "Preparando a biblioteca...") {
    elementos.progressoBiblioteca.hidden = !ativo;
    elementos.textoBiblioteca.textContent = texto;
    elementos.pagina.dataset.estadoBiblioteca = ativo ? "lendo" : estado.biblioteca.length ? "pronta" : "vazia";
  }

  function receberProgressoBiblioteca(progresso = {}) {
    const total = Math.max(Number(progresso.total) || 0, 1);
    const atual = Math.min(Number(progresso.atual ?? progresso.processados) || 0, total);
    const porcentagem = Math.round((atual / total) * 100);
    const mensagensPorFase = {
      procurando: "Procurando arquivos de áudio...",
      lendo: `Indexando músicas — ${atual} de ${total}`,
      salvando: "Salvando o índice local...",
      concluido: "Biblioteca pronta.",
      erro: "Não foi possível concluir a leitura.",
    };
    definirLeituraBiblioteca(
      true,
      progresso.mensagem || mensagensPorFase[progresso.fase] || `Indexando músicas — ${atual} de ${total}`,
    );
    elementos.barraBiblioteca.style.width = `${porcentagem}%`;
    if (["concluido", "erro"].includes(progresso.fase) || progresso.concluido) {
      definirLeituraBiblioteca(false);
    }
  }

  function criarArteGenerativa(faixa, alvo = elementos.capaGenerativa) {
    const semente = [...`${faixa?.album ?? ""}${faixa?.artista ?? ""}${faixa?.titulo ?? "HI"}`]
      .reduce((total, caractere) => ((total * 31) + caractere.charCodeAt(0)) >>> 0, 2166136261);
    const matiz = 135 + (semente % 95);
    const iniciais = `${faixa?.artista?.[0] ?? "H"}${faixa?.titulo?.[0] ?? "I"}`.toLocaleUpperCase("pt-BR");
    alvo?.style.setProperty("--matiz-capa", String(matiz));
    const texto = alvo?.querySelector("span, i");
    if (texto) texto.textContent = iniciais;
    elementos.pagina.style.setProperty("--cor-capa-rgb", `${70 + (semente % 35)}, ${150 + (semente % 70)}, ${125 + (semente % 50)}`);
  }

  function aplicarCapa(faixa) {
    const url = faixa ? obterUrlCapa(faixa) : "";
    criarArteGenerativa(faixa);
    criarArteGenerativa(faixa, elementos.miniCapa);

    const aplicarImagem = (imagem, urlImagem) => {
      if (!imagem) return;
      imagem.hidden = !urlImagem;
      if (urlImagem) imagem.src = urlImagem;
      else imagem.removeAttribute("src");
    };

    aplicarImagem(elementos.imagemCapa, url);
    aplicarImagem(elementos.miniImagem, url);
    elementos.capa.dataset.temCapa = String(Boolean(url));
    elementos.miniCapa.dataset.temCapa = String(Boolean(url));

    if (url) {
      elementos.imagemCapa.onload = () => extrairCorDaCapa(elementos.imagemCapa, faixa);
      elementos.imagemCapa.onerror = () => {
        aplicarImagem(elementos.imagemCapa, "");
        aplicarImagem(elementos.miniImagem, "");
        elementos.capa.dataset.temCapa = "false";
      };
    }
  }

  function extrairCorDaCapa(imagem, faixa) {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 24;
      canvas.height = 24;
      const contexto = canvas.getContext("2d", { willReadFrequently: true });
      contexto.drawImage(imagem, 0, 0, 24, 24);
      const pixels = contexto.getImageData(0, 0, 24, 24).data;
      let vermelho = 0;
      let verde = 0;
      let azul = 0;
      let amostras = 0;
      for (let indice = 0; indice < pixels.length; indice += 20) {
        const brilho = pixels[indice] + pixels[indice + 1] + pixels[indice + 2];
        if (pixels[indice + 3] < 180 || brilho < 70 || brilho > 700) continue;
        vermelho += pixels[indice];
        verde += pixels[indice + 1];
        azul += pixels[indice + 2];
        amostras += 1;
      }
      if (!amostras) return criarArteGenerativa(faixa);
      elementos.pagina.style.setProperty(
        "--cor-capa-rgb",
        `${Math.round(vermelho / amostras)}, ${Math.round(verde / amostras)}, ${Math.round(azul / amostras)}`,
      );
    } catch {
      criarArteGenerativa(faixa);
    }
  }

  function criarBotaoIcone(rotulo, caminho, classe = "") {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.className = classe;
    botao.setAttribute("aria-label", rotulo);
    botao.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${caminho}"></path></svg>`;
    return botao;
  }

  function faixasFiltradas() {
    let faixas = [...estado.biblioteca];
    if (estado.filtro === "favoritas") {
      faixas = faixas.filter((faixa) => estado.favoritas.has(faixa.id));
    } else if (estado.filtro === "recentes") {
      faixas = estado.recentes.map((id) => estado.faixasPorId.get(id)).filter(Boolean);
    } else if (estado.filtro === "artistas") {
      faixas.sort((a, b) => extensaoTexto.compare(a.artista, b.artista) || extensaoTexto.compare(a.titulo, b.titulo));
    } else if (estado.filtro === "albuns") {
      faixas.sort((a, b) => extensaoTexto.compare(a.album, b.album) || (a.numeroFaixa ?? 999) - (b.numeroFaixa ?? 999));
    }

    if (estado.busca) {
      faixas = faixas.filter((faixa) => normalizarTexto(`${faixa.titulo} ${faixa.artista} ${faixa.album}`).includes(estado.busca));
    }
    return faixas;
  }

  function renderizarBiblioteca() {
    const faixas = faixasFiltradas();
    const fragmento = document.createDocumentFragment();
    elementos.listaBiblioteca.replaceChildren();
    let grupoAnterior = "";

    faixas.forEach((faixa, indice) => {
      if (estado.filtro === "artistas" || estado.filtro === "albuns") {
        const grupo = estado.filtro === "artistas" ? faixa.artista : faixa.album;
        if (grupo !== grupoAnterior) {
          const tituloGrupo = document.createElement("h4");
          tituloGrupo.className = "titulo-grupo-biblioteca";
          tituloGrupo.textContent = grupo;
          fragmento.append(tituloGrupo);
          grupoAnterior = grupo;
        }
      }

      const item = document.createElement("article");
      item.className = "faixa-biblioteca";
      item.dataset.idFaixa = faixa.id;
      item.dataset.atual = String(faixa.id === estado.musicaAtualId);
      item.setAttribute("role", "listitem");

      const numero = document.createElement("span");
      numero.className = "numero-faixa-biblioteca";
      numero.textContent = String(indice + 1).padStart(2, "0");

      const capa = document.createElement("span");
      capa.className = "miniatura-faixa-biblioteca";
      const urlCapa = obterUrlCapa(faixa);
      if (urlCapa) {
        const imagem = document.createElement("img");
        imagem.src = urlCapa;
        imagem.alt = "";
        capa.append(imagem);
      } else {
        capa.textContent = `${faixa.artista[0] ?? "H"}${faixa.titulo[0] ?? "I"}`.toLocaleUpperCase("pt-BR");
      }

      const identificacao = document.createElement("button");
      identificacao.type = "button";
      identificacao.className = "identificacao-faixa-biblioteca";
      identificacao.dataset.tocarFaixa = faixa.id;
      const titulo = document.createElement("strong");
      titulo.textContent = faixa.titulo;
      const detalhes = document.createElement("small");
      detalhes.textContent = `${faixa.artista} · ${faixa.album}`;
      identificacao.append(titulo, detalhes);

      const duracao = document.createElement("span");
      duracao.className = "duracao-faixa-biblioteca";
      duracao.textContent = formatarTempo(faixa.duracao);

      const favorito = criarBotaoIcone(
        estado.favoritas.has(faixa.id) ? "Remover das favoritas" : "Adicionar às favoritas",
        "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z",
        "acao-faixa-biblioteca acao-favoritar-biblioteca",
      );
      favorito.dataset.favoritarFaixa = faixa.id;
      favorito.setAttribute("aria-pressed", String(estado.favoritas.has(faixa.id)));

      const fila = criarBotaoIcone("Adicionar à fila", "M5 6h14M5 12h9M5 18h9M18 15v6M15 18h6", "acao-faixa-biblioteca");
      fila.dataset.adicionarFila = faixa.id;
      item.append(numero, capa, identificacao, duracao, favorito, fila);
      fragmento.append(item);
    });

    elementos.listaBiblioteca.append(fragmento);
    elementos.semResultados.hidden = faixas.length > 0;
  }

  function atualizarFila() {
    estado.fila = [...new Set(estado.fila)]
      .filter((id) => estado.faixasPorId.has(id) && id !== estado.musicaAtualId);
    elementos.listaFila.replaceChildren();
    const proximas = estado.fila.slice(0, 30);
    elementos.quantidadeFila.textContent = `${estado.fila.length} ${estado.fila.length === 1 ? "faixa" : "faixas"}`;
    elementos.filaVazia.hidden = proximas.length > 0;

    proximas.forEach((id, indice) => {
      const faixa = estado.faixasPorId.get(id);
      if (!faixa) return;
      const item = document.createElement("li");
      item.dataset.idFila = id;
      item.draggable = true;
      const ordem = document.createElement("span");
      ordem.textContent = String(indice + 1).padStart(2, "0");
      const tocar = document.createElement("button");
      tocar.type = "button";
      tocar.dataset.tocarFila = id;
      const titulo = document.createElement("strong");
      titulo.textContent = faixa.titulo;
      const artista = document.createElement("small");
      artista.textContent = faixa.artista;
      tocar.append(titulo, artista);
      const remover = criarBotaoIcone("Remover da fila", "M6 6l12 12M18 6 6 18", "remover-fila");
      remover.dataset.removerFila = String(indice);
      item.append(ordem, tocar, remover);
      elementos.listaFila.append(item);
    });

    alterarConfiguracao("estacao.fila", [...estado.fila]);
  }

  function adicionarAListaDeEspera(id) {
    const faixa = estado.faixasPorId.get(id);
    if (!faixa || id === estado.musicaAtualId || estado.fila.includes(id)) {
      notificar(
        "Fila mantida organizada",
        id === estado.musicaAtualId
          ? "Esta música já está tocando."
          : "A música já está na fila.",
        "informacao",
      );
      return false;
    }
    estado.fila.push(id);
    atualizarFila();
    notificar("Adicionada à fila", faixa.titulo);
    return true;
  }

  function criarFilaAPartirDaFaixa(idAtual) {
    let ids = estado.biblioteca.map((faixa) => faixa.id).filter((id) => id !== idAtual);
    if (estado.aleatorio) {
      for (let indice = ids.length - 1; indice > 0; indice -= 1) {
        const destino = Math.floor(Math.random() * (indice + 1));
        [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
      }
    } else {
      const indiceAtual = estado.biblioteca.findIndex((faixa) => faixa.id === idAtual);
      ids = [...estado.biblioteca.slice(indiceAtual + 1), ...estado.biblioteca.slice(0, indiceAtual)]
        .map((faixa) => faixa.id);
    }
    estado.fila = ids;
    atualizarFila();
  }

  function registrarRecente(id) {
    estado.recentes = [id, ...estado.recentes.filter((item) => item !== id)].slice(0, 40);
    alterarConfiguracao("estacao.recentes", [...estado.recentes]);
    document.dispatchEvent(new CustomEvent("faixatocada", { detail: { id } }));
  }

  function atualizarIdentificacao(faixa) {
    elementos.titulo.textContent = faixa?.titulo ?? "Escolha uma música";
    elementos.artista.textContent = faixa?.artista ?? "Sua biblioteca aparecerá abaixo";
    elementos.album.textContent = faixa?.album?.toLocaleUpperCase("pt-BR") ?? "ESTAÇÃO HORTA INTELIGENTE";
    elementos.miniTitulo.textContent = faixa?.titulo ?? "Nenhuma música";
    elementos.miniArtista.textContent = faixa?.artista ?? "Estação";
    aplicarCapa(faixa);
    atualizarFavorito();
    renderizarBiblioteca();
  }

  function limparVisualizador() {
    if (estado.quadroVisualizador) cancelAnimationFrame(estado.quadroVisualizador);
    estado.quadroVisualizador = 0;
    estado.ultimoQuadro = 0;
    const contexto = elementos.visualizador?.getContext?.("2d");
    contexto?.clearRect(0, 0, elementos.visualizador.width, elementos.visualizador.height);
    elementos.nivelEsquerdo.style.width = "0%";
    elementos.nivelDireito.style.width = "0%";
  }

  function limparMusicaAtual(mensagem = "Escolha uma música para começar.") {
    window.clearTimeout(estado.temporizadorErroAudio);
    estado.temporizadorErroAudio = 0;
    elementos.audio.pause();
    elementos.audio.removeAttribute("src");
    elementos.audio.load();
    estado.musicaAtualId = null;
    estado.iniciouFaixaAtual = false;
    estado.segundoPersistido = -1;
    estado.historicoReproducao = [];
    estado.duracaoAtual = 0;
    estado.posicaoAtual = 0;
    estado.ajustandoProgresso = false;
    estado.proporcaoProgressoPendente = null;
    estado.posicaoRestauracaoPendente = null;
    atualizarIdentificacao(null);
    elementos.estadoReproducao.textContent = mensagem;
    elementos.progressoMusica.value = "0";
    elementos.progressoMusica.style.setProperty("--progresso", "0%");
    elementos.tempoAtual.textContent = "0:00";
    elementos.tempoRestante.textContent = "−–:––";
    elementos.miniBarra.style.width = "0%";
    limparVisualizador();
    atualizarMiniPlayer();
    atualizarDisponibilidadeControles();
    configuracoes?.alterarLote?.({
      "estacao.ultimaFaixaId": null,
      "estacao.posicao": 0,
      "estacao.fila": [...estado.fila],
    });
    emitirEstadoMusica();
  }

  function atualizarFavorito() {
    const ativo = Boolean(estado.musicaAtualId && estado.favoritas.has(estado.musicaAtualId));
    elementos.favorito.setAttribute("aria-pressed", String(ativo));
    elementos.favorito.setAttribute("aria-label", ativo ? "Remover música das favoritas" : "Adicionar música às favoritas");
  }

  function atualizarBotoesReproducao() {
    const tocando = !elementos.audio.paused && !elementos.audio.ended;
    elementos.pagina.dataset.reproduzindo = String(tocando);
    elementos.miniPlayer.dataset.reproduzindo = String(tocando);
    document.querySelectorAll('[data-acao-player="alternar"]').forEach((botao) => {
      botao.setAttribute("aria-label", tocando ? "Pausar" : "Reproduzir");
    });
    elementos.estadoReproducao.textContent = tocando ? "Reproduzindo agora" : estado.musicaAtualId ? "Reprodução pausada" : "Pronta para reproduzir";
    raiz.sons?.informarEstadoMusica?.({ tocando, pausado: !tocando, id: estado.musicaAtualId });
    emitirEstadoMusica();
    if (tocando) iniciarVisualizador();
    else limparVisualizador();
  }

  function atualizarDisponibilidadeControles() {
    const possuiBiblioteca = estado.biblioteca.length > 0;
    document.querySelectorAll("[data-acao-player]").forEach((botao) => {
      botao.disabled = !possuiBiblioteca;
    });
    elementos.favorito.disabled = !estado.musicaAtualId;
    elementos.progressoMusica.disabled = !estado.musicaAtualId;
  }

  function emitirEstadoMusica() {
    const faixa = estado.faixasPorId.get(estado.musicaAtualId);
    document.dispatchEvent(new CustomEvent("estadomusicaatualizado", {
      detail: {
        tocando: !elementos.audio.paused && !elementos.audio.ended,
        titulo: faixa?.titulo ?? "Estação em repouso",
        artista: faixa?.artista ?? "Nenhuma música tocando",
        capa: faixa ? obterUrlCapa(faixa) : "",
        tempoAtual: elementos.audio.currentTime || 0,
        duracao: obterDuracaoEfetiva(),
        carregando: estado.carregandoAudio,
      },
    }));
  }

  function prepararFaixa(id, {
    reconstruirFila = false,
    registrarHistorico = true,
    posicaoInicial = null,
  } = {}) {
    const faixa = estado.faixasPorId.get(id);
    if (!faixa) return false;
    if (
      registrarHistorico
      && estado.musicaAtualId
      && estado.musicaAtualId !== id
      && estado.faixasPorId.has(estado.musicaAtualId)
    ) {
      estado.historicoReproducao.push(estado.musicaAtualId);
      estado.historicoReproducao = estado.historicoReproducao.slice(-100);
    }
    estado.musicaAtualId = id;
    estado.iniciouFaixaAtual = false;
    estado.segundoPersistido = -1;
    estado.ultimoErroAudioId = null;
    estado.duracaoAtual = Number.isFinite(faixa.duracao) && faixa.duracao > 0 ? faixa.duracao : 0;
    estado.posicaoAtual = 0;
    estado.ajustandoProgresso = false;
    estado.proporcaoProgressoPendente = null;
    estado.posicaoRestauracaoPendente = Number.isFinite(posicaoInicial) && posicaoInicial > 0
      ? posicaoInicial
      : null;
    window.clearTimeout(estado.temporizadorErroAudio);
    estado.temporizadorErroAudio = 0;
    elementos.audio.src = faixa.urlAudio;
    elementos.audio.load();
    atualizarIdentificacao(faixa);
    alterarConfiguracao("estacao.ultimaFaixaId", id);
    if (reconstruirFila || !estado.fila.length) criarFilaAPartirDaFaixa(id);
    atualizarFila();
    atualizarMiniPlayer();
    atualizarDisponibilidadeControles();
    atualizarProgresso();
    return true;
  }

  async function reproduzir(registrarIntencao = true, tokenEsperado = null) {
    if (registrarIntencao) estado.versaoIntencaoReproducao += 1;
    if (!estado.musicaAtualId) {
      const primeira = estado.aleatorio
        ? estado.biblioteca[Math.floor(Math.random() * estado.biblioteca.length)]
        : estado.biblioteca[0];
      if (!primeira) return;
      prepararFaixa(primeira.id, { reconstruirFila: true });
    }
    if (!obterConfiguracao("audio.musica.ativo", true) || obterConfiguracao("acessibilidade.silenciarTudo", false)) {
      notificar("Música está desativada", "Ative a música na Central de Configurações.", "informacao");
      return;
    }
    const idEsperado = estado.musicaAtualId;
    try {
      await raiz.sons?.conectarElementoMusica?.(elementos.audio);
      if (
        estado.musicaAtualId !== idEsperado
        || (tokenEsperado !== null && tokenEsperado !== estado.tokenTroca)
      ) return;
      await elementos.audio.play();
    } catch (erro) {
      const trocaFicouObsoleta = estado.musicaAtualId !== idEsperado
        || (tokenEsperado !== null && tokenEsperado !== estado.tokenTroca);
      if (trocaFicouObsoleta || erro?.name === "AbortError") return;
      console.error("A faixa não pôde ser reproduzida.", erro);
      notificar("Não foi possível reproduzir", "O arquivo pode ter sido movido ou não ser compatível.", "erro");
    }
  }

  function pausar(registrarIntencao = true) {
    if (registrarIntencao) estado.versaoIntencaoReproducao += 1;
    elementos.audio.pause();
    persistirSessao();
  }

  function alternarReproducao() {
    if (elementos.audio.paused) reproduzir();
    else pausar();
  }

  async function trocarComTransicao(id, opcoes = {}) {
    if (!id || !estado.faixasPorId.has(id)) return false;

    // Cada clique invalida imediatamente a troca anterior. Nenhuma operação fica
    // presa esperando carregamento, play() ou animação de volume da faixa antiga.
    const tokenTroca = ++estado.tokenTroca;
    const estavaTocando = !elementos.audio.paused;
    const deveReproduzir = opcoes.reproduzir ?? estavaTocando;
    if (opcoes.reproduzir === true && !estavaTocando) {
      estado.versaoIntencaoReproducao += 1;
    }
    const versaoIntencao = estado.versaoIntencaoReproducao;
    elementos.pagina.dataset.transicaoFaixa = "saindo";

    try {
      if (!consultaMovimentoReduzido.matches && document.visibilityState === "visible") {
        await new Promise((resolver) => window.setTimeout(resolver, 90));
      }
      if (tokenTroca !== estado.tokenTroca) return false;
      prepararFaixa(id, opcoes);
      elementos.pagina.dataset.transicaoFaixa = "entrando";

      // A reprodução ocorre em paralelo ao acabamento visual. Mesmo que o arquivo
      // demore a abrir, o usuário continua livre para escolher outra música.
      if (deveReproduzir && versaoIntencao === estado.versaoIntencaoReproducao) {
        void reproduzir(false, tokenTroca);
      }
      window.setTimeout(() => {
        if (tokenTroca === estado.tokenTroca) delete elementos.pagina.dataset.transicaoFaixa;
      }, consultaMovimentoReduzido.matches ? 0 : 360);
      return true;
    } catch (erro) {
      console.error("A troca de música não pôde ser concluída.", erro);
      if (tokenTroca === estado.tokenTroca) delete elementos.pagina.dataset.transicaoFaixa;
      return false;
    }
  }

  function proxima(forcarReproducao = false, fimNatural = false) {
    const deveReproduzir = forcarReproducao || !elementos.audio.paused;
    if (estado.repeticao === "faixa" && fimNatural) {
      elementos.audio.currentTime = 0;
      if (deveReproduzir) reproduzir();
      return;
    }
    let proximoId = estado.fila.shift();
    while (proximoId && estado.idsComErro.has(proximoId)) {
      proximoId = estado.fila.shift();
    }
    if (!proximoId && !fimNatural && estado.biblioteca.length > 1) {
      // O botão Próxima sempre representa uma intenção explícita. Mesmo em
      // “repetir faixa”, ele avança; a repetição vale somente para o fim natural.
      criarFilaAPartirDaFaixa(estado.musicaAtualId);
      proximoId = estado.fila.shift();
      while (proximoId && estado.idsComErro.has(proximoId)) {
        proximoId = estado.fila.shift();
      }
    }
    if (!proximoId && estado.repeticao === "biblioteca") {
      criarFilaAPartirDaFaixa(estado.musicaAtualId);
      proximoId = estado.fila.shift();
      while (proximoId && estado.idsComErro.has(proximoId)) {
        proximoId = estado.fila.shift();
      }
      if (!proximoId && estado.biblioteca.length === 1) {
        proximoId = estado.musicaAtualId;
      }
    }
    atualizarFila();
    if (proximoId) trocarComTransicao(proximoId, {
      reproduzir: deveReproduzir,
      registrarHistorico: proximoId !== estado.musicaAtualId,
    });
    else pausar();
  }

  function anterior() {
    if (elementos.audio.currentTime > 4) {
      elementos.audio.currentTime = 0;
      return;
    }
    let idAnterior = estado.historicoReproducao.pop();
    if (!idAnterior || !estado.faixasPorId.has(idAnterior)) {
      const indice = estado.biblioteca.findIndex((faixa) => faixa.id === estado.musicaAtualId);
      const destino = indice > 0 ? indice - 1 : estado.biblioteca.length - 1;
      idAnterior = estado.biblioteca[destino]?.id;
    }
    if (idAnterior) trocarComTransicao(idAnterior, {
      reconstruirFila: true,
      registrarHistorico: false,
      reproduzir: !elementos.audio.paused,
    });
  }

  function alternarFavorito(id = estado.musicaAtualId) {
    if (!id) return;
    if (estado.favoritas.has(id)) estado.favoritas.delete(id);
    else estado.favoritas.add(id);
    alterarConfiguracao("estacao.favoritas", [...estado.favoritas]);
    atualizarFavorito();
    renderizarBiblioteca();
  }

  function renderizarProgresso({ proporcaoForcada = null } = {}) {
    const duracao = obterDuracaoEfetiva();
    const atual = Math.max(Number(estado.posicaoAtual) || 0, 0);
    const proporcaoCalculada = duracao ? Math.min(atual / duracao, 1) : 0;
    const proporcao = Math.max(0, Math.min(
      Number.isFinite(proporcaoForcada) ? proporcaoForcada : proporcaoCalculada,
      1,
    ));
    const progresso = proporcao * 1000;

    elementos.progressoMusica.value = String(Math.round(progresso));
    elementos.progressoMusica.style.setProperty("--progresso", `${progresso / 10}%`);
    elementos.tempoAtual.textContent = formatarTempo(
      Number.isFinite(proporcaoForcada) && duracao ? proporcao * duracao : atual,
    );
    elementos.tempoRestante.textContent = duracao
      ? `−${formatarTempo(Math.max(duracao - (proporcao * duracao), 0))}`
      : "−–:––";
    elementos.miniBarra.style.width = `${progresso / 10}%`;
  }

  function atualizarProgresso() {
    const duracaoNativa = obterDuracaoNativa();
    if (duracaoNativa) estado.duracaoAtual = duracaoNativa;

    // Durante o arraste, ou enquanto a duração nativa ainda não chegou, o valor
    // escolhido pelo usuário não pode ser sobrescrito por um timeupdate atrasado.
    if (estado.ajustandoProgresso || (estado.proporcaoProgressoPendente !== null && !duracaoNativa)) {
      renderizarProgresso({ proporcaoForcada: estado.proporcaoProgressoPendente });
      return;
    }

    estado.posicaoAtual = Number.isFinite(elementos.audio.currentTime)
      ? elementos.audio.currentTime
      : estado.posicaoAtual;
    renderizarProgresso();
    const atual = estado.posicaoAtual;
    if (!elementos.audio.paused) {
      elementos.tempoTocando.textContent = `Tocando há ${formatarTempo(atual)}`;
      if (!estado.iniciouFaixaAtual && atual > 0.25) {
        estado.iniciouFaixaAtual = true;
        registrarRecente(estado.musicaAtualId);
      }
    }
    const segundo = Math.floor(atual);
    if (segundo > 0 && segundo % 12 === 0 && segundo !== estado.segundoPersistido) {
      estado.segundoPersistido = segundo;
      persistirSessao();
    }
    emitirEstadoMusica();
  }

  function previsualizarProgresso() {
    const proporcao = Math.max(0, Math.min(Number(elementos.progressoMusica.value) / 1000, 1));
    estado.ajustandoProgresso = true;
    estado.proporcaoProgressoPendente = proporcao;
    elementos.pagina.dataset.ajustandoProgresso = "true";
    renderizarProgresso({ proporcaoForcada: proporcao });
  }

  function confirmarProgresso() {
    if (estado.proporcaoProgressoPendente === null) {
      estado.ajustandoProgresso = false;
      delete elementos.pagina.dataset.ajustandoProgresso;
      return;
    }

    const proporcao = estado.proporcaoProgressoPendente;
    const duracaoNativa = obterDuracaoNativa();
    const duracaoVisual = obterDuracaoEfetiva();
    estado.ajustandoProgresso = false;
    delete elementos.pagina.dataset.ajustandoProgresso;

    if (duracaoNativa) {
      const destino = Math.min(proporcao * duracaoNativa, Math.max(duracaoNativa - 0.05, 0));
      try {
        elementos.audio.currentTime = destino;
        estado.posicaoAtual = destino;
        estado.proporcaoProgressoPendente = null;
      } catch {
        // O Chromium pode ainda estar montando as faixas buscáveis. O mesmo destino
        // será aplicado assim que loadedmetadata/durationchange confirmar a duração.
      }
    } else if (duracaoVisual) {
      estado.posicaoAtual = proporcao * duracaoVisual;
    }

    renderizarProgresso({
      proporcaoForcada: estado.proporcaoProgressoPendente === null ? null : proporcao,
    });
  }

  function aplicarPosicoesPendentes() {
    const duracaoNativa = obterDuracaoNativa();
    if (!duracaoNativa) {
      atualizarProgresso();
      return;
    }
    estado.duracaoAtual = duracaoNativa;

    if (estado.posicaoRestauracaoPendente !== null) {
      const destino = Math.min(estado.posicaoRestauracaoPendente, Math.max(duracaoNativa - 0.05, 0));
      try {
        elementos.audio.currentTime = destino;
        estado.posicaoRestauracaoPendente = null;
        estado.posicaoAtual = destino;
      } catch {
        atualizarProgresso();
        return;
      }
    }

    if (estado.proporcaoProgressoPendente !== null && !estado.ajustandoProgresso) {
      confirmarProgresso();
      return;
    }
    atualizarProgresso();
  }

  function atualizarMiniPlayer() {
    const mostrar = Boolean(estado.musicaAtualId && obterConfiguracao("estacao.mostrarMiniPlayer", true));
    elementos.miniPlayer.hidden = !mostrar;
    document.body.classList.toggle("tem-mini-player", mostrar);
  }

  function persistirSessao() {
    if (!obterConfiguracao("estacao.retomarSessao", true)) return Promise.resolve();
    return configuracoes?.alterarLote?.({
      "estacao.ultimaFaixaId": estado.musicaAtualId,
      "estacao.posicao": Math.round((elementos.audio.currentTime || 0) * 10) / 10,
      "estacao.fila": [...estado.fila],
      "estacao.aleatorio": estado.aleatorio,
      "estacao.repeticao": estado.repeticao,
      "estacao.musicaSilenciada": elementos.audio.muted,
      "estacao.modoImersivo": estado.imersivo,
    }) ?? Promise.resolve();
  }

  function restaurarSessao() {
    if (!estado.biblioteca.length || estado.musicaAtualId) return;
    estado.aleatorio = Boolean(obterConfiguracao("estacao.aleatorio", false));
    estado.repeticao = obterConfiguracao("estacao.repeticao", "biblioteca");
    atualizarBotoesModos();
    if (!obterConfiguracao("estacao.retomarSessao", true)) return;
    const id = obterConfiguracao("estacao.ultimaFaixaId", null);
    if (!id || !estado.faixasPorId.has(id)) return;
    const deveRetomarPosicao = obterConfiguracao("estacao.retomarPosicao", true);
    const posicao = deveRetomarPosicao
      ? Number(obterConfiguracao("estacao.posicao", 0)) || 0
      : 0;
    prepararFaixa(id, { posicaoInicial: posicao });
    queueMicrotask(() => {
      if (estado.musicaAtualId === id) aplicarPosicoesPendentes();
    });
  }

  function atualizarBotoesModos() {
    document.querySelectorAll('[data-acao-player="aleatorio"]').forEach((botao) => botao.setAttribute("aria-pressed", String(estado.aleatorio)));
    document.querySelectorAll('[data-acao-player="repeticao"]').forEach((botao) => {
      botao.dataset.modo = estado.repeticao;
      botao.setAttribute("aria-label", estado.repeticao === "faixa" ? "Repetir uma música" : estado.repeticao === "biblioteca" ? "Repetir biblioteca" : "Repetição desativada");
      botao.setAttribute("aria-pressed", String(estado.repeticao !== "desativada"));
    });
  }

  function alternarAleatorio() {
    estado.aleatorio = !estado.aleatorio;
    alterarConfiguracao("estacao.aleatorio", estado.aleatorio);
    criarFilaAPartirDaFaixa(estado.musicaAtualId);
    atualizarBotoesModos();
  }

  function alternarRepeticao() {
    const modos = ["desativada", "biblioteca", "faixa"];
    estado.repeticao = modos[(modos.indexOf(estado.repeticao) + 1) % modos.length];
    alterarConfiguracao("estacao.repeticao", estado.repeticao);
    atualizarBotoesModos();
  }

  function atualizarVolume(valor = obterConfiguracao("audio.musica.volume", 0.62)) {
    const volume = Math.max(0, Math.min(Number(valor) || 0, 1));
    elementos.volume.value = String(Math.round(volume * 100));
    elementos.valorVolume.textContent = `${Math.round(volume * 100)}%`;
    elementos.volume.style.setProperty("--progresso", `${volume * 100}%`);
    raiz.sons?.definirVolumeMusica?.(volume);
  }

  function alternarMute() {
    elementos.audio.muted = !elementos.audio.muted;
    elementos.mute.setAttribute("aria-pressed", String(elementos.audio.muted));
    alterarConfiguracao("estacao.musicaSilenciada", elementos.audio.muted);
    emitirEstadoMusica();
  }

  function alternarImersivo(forcar, { imediato = false } = {}) {
    const destino = typeof forcar === "boolean" ? forcar : !estado.imersivo;
    const token = ++estado.tokenModoImersivo;
    estado.imersivo = destino;
    elementos.imersivo.setAttribute("aria-pressed", String(destino));
    elementos.imersivo.lastChild.textContent = destino ? " Sair do imersivo" : " Modo imersivo";
    alterarConfiguracao("estacao.modoImersivo", destino);

    if (destino) {
      document.body.classList.remove("estacao-imersiva-saindo");
      document.body.classList.add("estacao-imersiva");
      elementos.pagina.dataset.imersiva = "true";
      elementos.imersivo.focus();
      return;
    }

    const finalizarSaida = () => {
      if (token !== estado.tokenModoImersivo) return;
      document.body.classList.remove("estacao-imersiva", "estacao-imersiva-saindo");
      elementos.pagina.dataset.imersiva = "false";
    };
    const estaRenderizado = document.body.classList.contains("estacao-imersiva");
    if (imediato || !estaRenderizado || consultaMovimentoReduzido.matches) {
      finalizarSaida();
      return;
    }

    // A classe principal permanece durante alguns milissegundos para que a saída
    // tenha imagem final; somente depois a página volta ao fluxo normal do painel.
    document.body.classList.add("estacao-imersiva-saindo");
    window.setTimeout(finalizarSaida, 270);
  }

  function atualizarResumoHorta(dados = {}) {
    elementos.umidadeImersiva.textContent = Number.isFinite(dados.umidadeSolo) ? `${Math.round(dados.umidadeSolo)}%` : "--%";
    elementos.bombaImersiva.textContent = dados.bombaLigada == null ? "--" : dados.bombaLigada ? "ON" : "OFF";
    elementos.luzImersiva.textContent = dados.iluminacaoLigada == null ? "--" : dados.iluminacaoLigada ? "ON" : "OFF";
    elementos.arduinoImersivo.textContent = dados.estadoArduino?.conexao === "conectado" ? "ONLINE" : "OFFLINE";
  }

  function obterAnalisador() {
    if (estado.analisador) return estado.analisador;
    estado.analisador = raiz.sons?.obterAnalisadorMusica?.() ?? raiz.sons?.obterDadosVisualizador?.()?.analisador ?? null;
    if (estado.analisador) estado.dadosFrequencia = new Uint8Array(estado.analisador.frequencyBinCount);
    return estado.analisador;
  }

  function iniciarVisualizador() {
    if (estado.quadroVisualizador || elementos.audio.paused) return;
    const permitido = estado.paginaVisivel
      && document.visibilityState === "visible"
      && !consultaMovimentoReduzido.matches
      && obterConfiguracao("estacao.mostrarVisualizador", true)
      && obterConfiguracao("interface.visualizadorMusicaAtivo", true)
      && !obterConfiguracao("acessibilidade.semVisualizador", false);
    if (!permitido) {
      limparVisualizador();
      return;
    }
    estado.quadroVisualizador = requestAnimationFrame(desenharVisualizador);
  }

  function desenharVisualizador(agora) {
    estado.quadroVisualizador = 0;
    const visivel = estado.paginaVisivel
      && !elementos.pagina.hidden
      && document.visibilityState === "visible";
    const permitido = obterConfiguracao("estacao.mostrarVisualizador", true)
      && obterConfiguracao("interface.visualizadorMusicaAtivo", true)
      && !obterConfiguracao("acessibilidade.semVisualizador", false)
      && !consultaMovimentoReduzido.matches;
    if (!visivel || !permitido || elementos.audio.paused) {
      limparVisualizador();
      return;
    }
    if (agora - estado.ultimoQuadro < 33) {
      estado.quadroVisualizador = requestAnimationFrame(desenharVisualizador);
      return;
    }
    estado.ultimoQuadro = agora;
    const canvas = elementos.visualizador;
    const largura = Math.max(canvas.clientWidth, 1);
    const altura = Math.max(canvas.clientHeight, 1);
    const escala = Math.min(window.devicePixelRatio || 1, 1.5);
    if (canvas.width !== Math.floor(largura * escala) || canvas.height !== Math.floor(altura * escala)) {
      canvas.width = Math.floor(largura * escala);
      canvas.height = Math.floor(altura * escala);
    }
    const contexto = canvas.getContext("2d");
    contexto.setTransform(escala, 0, 0, escala, 0, 0);
    contexto.clearRect(0, 0, largura, altura);

    const analisador = obterAnalisador();
    if (analisador && estado.dadosFrequencia) analisador.getByteFrequencyData(estado.dadosFrequencia);
    const dados = estado.dadosFrequencia;
    const pontos = 54;
    const centro = altura * 0.54;
    const estilo = getComputedStyle(elementos.pagina).getPropertyValue("--cor-capa-rgb").trim() || "110, 231, 168";
    contexto.beginPath();
    contexto.moveTo(0, centro);
    let somaEsquerda = 0;
    let somaDireita = 0;
    for (let indice = 0; indice <= pontos; indice += 1) {
      const amostra = dados?.[Math.min(Math.floor((indice / pontos) * Math.min(dados.length * 0.35, 180)), (dados?.length ?? 1) - 1)] ?? 18;
      const energia = amostra / 255;
      const onda = Math.sin((indice * 0.7) + (agora * 0.002)) * 3;
      const y = centro - (energia * altura * 0.31) - onda;
      const x = (indice / pontos) * largura;
      contexto.lineTo(x, y);
      if (indice < pontos / 2) somaEsquerda += energia;
      else somaDireita += energia;
    }
    contexto.strokeStyle = `rgba(${estilo}, .82)`;
    contexto.lineWidth = 1.4;
    contexto.shadowColor = `rgba(${estilo}, .5)`;
    contexto.shadowBlur = 12;
    contexto.stroke();
    const mediaEsquerda = Math.min((somaEsquerda / (pontos / 2)) * 180, 100);
    const mediaDireita = Math.min((somaDireita / (pontos / 2)) * 180, 100);
    elementos.nivelEsquerdo.style.width = `${mediaEsquerda}%`;
    elementos.nivelDireito.style.width = `${mediaDireita}%`;
    estado.quadroVisualizador = requestAnimationFrame(desenharVisualizador);
  }

  function tratarAcaoPlayer(acao) {
    if (acao === "alternar") alternarReproducao();
    if (acao === "anterior") anterior();
    if (acao === "proxima") proxima();
    if (acao === "aleatorio") alternarAleatorio();
    if (acao === "repeticao") alternarRepeticao();
  }

  function configurarEventos() {
    elementos.escolherPasta?.addEventListener("click", escolherPasta);
    elementos.abrirBiblioteca?.addEventListener("click", () => {
      if (!estado.biblioteca.length) {
        escolherPasta();
        return;
      }
      elementos.pagina.querySelector(".biblioteca-estacao")?.scrollIntoView({
        behavior: document.documentElement.dataset.movimentoReduzido === "true" ? "auto" : "smooth",
        block: "start",
      });
    });
    elementos.imersivo?.addEventListener("click", () => alternarImersivo());
    elementos.favorito?.addEventListener("click", () => alternarFavorito());
    elementos.mute?.addEventListener("click", alternarMute);

    document.addEventListener("click", (evento) => {
      const alvo = evento.target.closest("button");
      if (!alvo) return;
      if (alvo.hasAttribute("data-ocultar-mini-player")) {
        alterarConfiguracao("estacao.mostrarMiniPlayer", false);
        atualizarMiniPlayer();
        notificar(
          "Mini-player ocultado",
          "Você pode reativá-lo nas Configurações da Estação.",
          "informacao",
        );
        return;
      }
      const acao = alvo.dataset.acaoPlayer;
      if (acao) tratarAcaoPlayer(acao);
      if (alvo.hasAttribute("data-abrir-estacao")) raiz.interfaceSistema?.navegar?.("estacao");
    });

    elementos.listaBiblioteca.addEventListener("click", (evento) => {
      const tocar = evento.target.closest("[data-tocar-faixa]");
      const favoritar = evento.target.closest("[data-favoritar-faixa]");
      const fila = evento.target.closest("[data-adicionar-fila]");
      const item = evento.target.closest("[data-id-faixa]");
      if (favoritar) {
        alternarFavorito(favoritar.dataset.favoritarFaixa);
        return;
      }
      if (fila) {
        adicionarAListaDeEspera(fila.dataset.adicionarFila);
        return;
      }
      const id = tocar?.dataset.tocarFaixa ?? item?.dataset.idFaixa;
      if (id) trocarComTransicao(id, { reconstruirFila: true, reproduzir: true });
    });

    elementos.listaFila.addEventListener("click", (evento) => {
      const tocar = evento.target.closest("[data-tocar-fila]");
      const remover = evento.target.closest("[data-remover-fila]");
      if (tocar) {
        trocarComTransicao(tocar.dataset.tocarFila, { reproduzir: true });
      }
      if (remover) {
        estado.fila.splice(Number(remover.dataset.removerFila), 1);
        atualizarFila();
      }
    });

    elementos.listaFila.addEventListener("dragstart", (evento) => {
      estado.arrasteFilaId = evento.target.closest("[data-id-fila]")?.dataset.idFila ?? null;
    });
    elementos.listaFila.addEventListener("dragover", (evento) => evento.preventDefault());
    elementos.listaFila.addEventListener("drop", (evento) => {
      evento.preventDefault();
      const destinoId = evento.target.closest("[data-id-fila]")?.dataset.idFila;
      const origem = estado.fila.indexOf(estado.arrasteFilaId);
      const destino = estado.fila.indexOf(destinoId);
      if (origem < 0 || destino < 0 || origem === destino) return;
      const [movida] = estado.fila.splice(origem, 1);
      estado.fila.splice(destino, 0, movida);
      atualizarFila();
    });

    elementos.busca.addEventListener("input", () => {
      estado.busca = normalizarTexto(elementos.busca.value.trim());
      renderizarBiblioteca();
    });
    document.querySelectorAll("[data-filtro-biblioteca]").forEach((botao) => {
      botao.addEventListener("click", () => {
        estado.filtro = botao.dataset.filtroBiblioteca;
        document.querySelectorAll("[data-filtro-biblioteca]").forEach((item) => item.setAttribute("aria-selected", String(item === botao)));
        renderizarBiblioteca();
      });
    });

    elementos.progressoMusica.addEventListener("pointerdown", () => {
      estado.ajustandoProgresso = true;
      elementos.pagina.dataset.ajustandoProgresso = "true";
    });
    elementos.progressoMusica.addEventListener("input", previsualizarProgresso);
    elementos.progressoMusica.addEventListener("change", confirmarProgresso);
    elementos.progressoMusica.addEventListener("pointerup", confirmarProgresso);
    elementos.progressoMusica.addEventListener("pointercancel", confirmarProgresso);
    elementos.volume.addEventListener("input", () => {
      const volume = Number(elementos.volume.value) / 100;
      alterarConfiguracao("audio.musica.volume", volume);
      atualizarVolume(volume);
    });

    elementos.audio.addEventListener("loadstart", () => {
      estado.carregandoAudio = Boolean(estado.musicaAtualId);
      elementos.pagina.dataset.carregandoAudio = String(estado.carregandoAudio);
      if (estado.carregandoAudio) elementos.estadoReproducao.textContent = "Preparando faixa";
      emitirEstadoMusica();
    });
    elementos.audio.addEventListener("play", atualizarBotoesReproducao);
    elementos.audio.addEventListener("playing", () => {
      estado.carregandoAudio = false;
      elementos.pagina.dataset.carregandoAudio = "false";
      atualizarBotoesReproducao();
    });
    elementos.audio.addEventListener("waiting", () => {
      if (!elementos.audio.paused) {
        estado.carregandoAudio = true;
        elementos.pagina.dataset.carregandoAudio = "true";
        elementos.estadoReproducao.textContent = "Carregando áudio";
      }
    });
    elementos.audio.addEventListener("pause", atualizarBotoesReproducao);
    elementos.audio.addEventListener("ended", () => proxima(true, true));
    elementos.audio.addEventListener("canplay", () => {
      if (estado.musicaAtualId) estado.idsComErro.delete(estado.musicaAtualId);
      estado.ultimoErroAudioId = null;
      estado.carregandoAudio = false;
      elementos.pagina.dataset.carregandoAudio = "false";
      window.clearTimeout(estado.temporizadorErroAudio);
      estado.temporizadorErroAudio = 0;
      atualizarBotoesReproducao();
    });
    elementos.audio.addEventListener("timeupdate", atualizarProgresso);
    elementos.audio.addEventListener("loadedmetadata", aplicarPosicoesPendentes);
    elementos.audio.addEventListener("durationchange", aplicarPosicoesPendentes);
    elementos.audio.addEventListener("seeked", atualizarProgresso);
    elementos.audio.addEventListener("error", () => {
      if (!elementos.audio.src) return;
      estado.carregandoAudio = false;
      elementos.pagina.dataset.carregandoAudio = "false";
      elementos.estadoReproducao.textContent = "Arquivo indisponível";
      const idComErro = estado.musicaAtualId;
      if (!idComErro || estado.ultimoErroAudioId === idComErro) return;
      estado.ultimoErroAudioId = idComErro;
      estado.idsComErro.add(idComErro);
      notificar(
        "Arquivo de música indisponível",
        "A Estação tentará a próxima faixa válida da biblioteca.",
        "erro",
      );
      const possuiAlternativa = estado.biblioteca.some(
        (faixa) => faixa.id !== idComErro && !estado.idsComErro.has(faixa.id),
      );
      window.clearTimeout(estado.temporizadorErroAudio);
      if (possuiAlternativa) {
        const tokenErro = estado.tokenTroca;
        estado.temporizadorErroAudio = window.setTimeout(() => {
          estado.temporizadorErroAudio = 0;
          if (estado.musicaAtualId === idComErro && estado.tokenTroca === tokenErro) proxima(true);
        }, 420);
      }
      else pausar(false);
    });

    document.addEventListener("dadoshortaatualizados", (evento) => atualizarResumoHorta(evento.detail));
    document.addEventListener("mudancapaginaaplicacao", (evento) => {
      estado.paginaVisivel = evento.detail?.pagina === "estacao";
      if (!estado.paginaVisivel && estado.imersivo) alternarImersivo(false, { imediato: true });
      if (estado.paginaVisivel) iniciarVisualizador();
      else limparVisualizador();
    });
    document.addEventListener("bibliotecaatualizada", (evento) => {
      atualizarEstadoBiblioteca(evento.detail?.biblioteca ?? evento.detail ?? {}, { publicarResumo: false });
    });
    document.addEventListener("configuracoesalteradas", () => {
      estado.aleatorio = Boolean(obterConfiguracao("estacao.aleatorio", estado.aleatorio));
      estado.repeticao = obterConfiguracao("estacao.repeticao", estado.repeticao);
      atualizarVolume();
      atualizarMiniPlayer();
      atualizarBotoesModos();
      atualizarDisponibilidadeControles();
      elementos.audio.muted = Boolean(
        obterConfiguracao("estacao.musicaSilenciada", elementos.audio.muted),
      );
      elementos.mute.setAttribute("aria-pressed", String(elementos.audio.muted));
      if (!obterConfiguracao("audio.musica.ativo", true)) pausar();
      if (estado.paginaVisivel) iniciarVisualizador();
      else limparVisualizador();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") iniciarVisualizador();
      else limparVisualizador();
    });
    consultaMovimentoReduzido.addEventListener?.("change", () => {
      if (consultaMovimentoReduzido.matches) limparVisualizador();
      else iniciarVisualizador();
    });

    document.addEventListener("keydown", (evento) => {
      if (evento.defaultPrevented || evento.repeat) return;
      const alvo = evento.target;
      const introducaoAtiva = document.body.classList.contains("inicializacao-ativa");
      const alvoInterativo = alvo instanceof HTMLElement && (
        alvo.matches("input, textarea, select, button, a[href], [contenteditable='true']")
        || alvo.isContentEditable
      );
      if (evento.key === "Escape" && estado.imersivo) {
        evento.preventDefault();
        alternarImersivo(false);
        return;
      }
      if (introducaoAtiva || alvoInterativo || document.querySelector("dialog[open]")) return;
      if (evento.code === "Space") {
        evento.preventDefault();
        alternarReproducao();
      } else if (evento.ctrlKey && evento.key === "ArrowRight") {
        evento.preventDefault();
        proxima();
      } else if (evento.ctrlKey && evento.key === "ArrowLeft") {
        evento.preventDefault();
        anterior();
      } else if (!evento.ctrlKey && !evento.altKey && !evento.metaKey && evento.key.toLocaleLowerCase("pt-BR") === "m") {
        evento.preventDefault();
        alternarMute();
      }
    });

    window.addEventListener("beforeunload", persistirSessao);
    window.addEventListener("pagehide", () => {
      limparVisualizador();
      estado.removerProgressoBiblioteca?.();
    }, { once: true });
    estado.removerProgressoBiblioteca = ponte?.aoProgresso?.(receberProgressoBiblioteca) ?? null;
  }

  async function iniciar() {
    configurarEventos();
    try {
      await configuracoes?.pronto;
    } catch {
      // Os valores padrão em memória continuam permitindo usar a interface.
    }
    estado.aleatorio = Boolean(obterConfiguracao("estacao.aleatorio", false));
    estado.repeticao = obterConfiguracao("estacao.repeticao", "biblioteca");
    estado.paginaVisivel = document.body.dataset.paginaAtiva === "estacao";
    elementos.audio.muted = Boolean(obterConfiguracao("estacao.musicaSilenciada", false));
    elementos.mute.setAttribute("aria-pressed", String(elementos.audio.muted));
    alternarImersivo(Boolean(obterConfiguracao("estacao.modoImersivo", false)));
    atualizarVolume();
    atualizarBotoesModos();
    atualizarDisponibilidadeControles();
    raiz.sons?.conectarElementoMusica?.(elementos.audio);
    await carregarBiblioteca();
  }

  raiz.estacao = Object.freeze({
    carregarBiblioteca,
    escolherPasta,
    reproduzir,
    pausar,
    alternarReproducao,
    proxima,
    anterior,
    obterEstado: () => ({
      musicaAtual: estado.faixasPorId.get(estado.musicaAtualId) ?? null,
      tocando: !elementos.audio.paused && !elementos.audio.ended,
      quantidade: estado.biblioteca.length,
      fila: [...estado.fila],
      aleatorio: estado.aleatorio,
      repeticao: estado.repeticao,
      silenciada: elementos.audio.muted,
      posicao: elementos.audio.currentTime || 0,
      duracao: obterDuracaoEfetiva(),
      carregando: estado.carregandoAudio,
      ajustandoProgresso: estado.ajustandoProgresso,
    }),
    persistirSessao,
  });

  iniciar();
})();
