/*
 * Coordena a navegação e os estados globais da experiência sem conhecer a
 * origem dos dados da horta. O dashboard continua sob responsabilidade do
 * principal.js; este arquivo apenas conecta páginas, preferências e overlays.
 */
(function iniciarModuloInterfaceSistema(escopoAplicacao) {
  "use strict";

  const documento = escopoAplicacao.document;
  const raizDocumento = documento.documentElement;
  const corpoDocumento = documento.body;
  const formatadorInteiro = new Intl.NumberFormat("pt-BR");
  const formatadorHorario = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatadorDataCurta = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const formatadorDataAmbiente = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
  const consultaTemaEscuro = escopoAplicacao.matchMedia("(prefers-color-scheme: dark)");
  const consultaMovimentoReduzido = escopoAplicacao.matchMedia("(prefers-reduced-motion: reduce)");
  const consultaJanelaCompacta = escopoAplicacao.matchMedia("(max-width: 820px)");
  const instanteInicial = Date.now();
  const DURACAO_SAIDA_ESTRUTURAL = 240;
  const DURACAO_TROCA_TEMA = 280;

  const CORES_DESTAQUE = Object.freeze({
    cultivo: "#65d99a",
    verde: "#65d99a",
    tecnologico: "#61bde3",
    azul: "#619ee8",
    roxo: "#a98ae8",
    ambar: "#dcae4f",
    ciano: "#4fc7ca",
    rosa: "#dc7faf",
  });

  const COMANDOS_PADRAO = Object.freeze([
    { id: "abrir-dashboard", titulo: "Abrir Painel", palavras: "painel monitoramento horta" },
    { id: "abrir-estacao", titulo: "Abrir Estação", palavras: "musica player biblioteca" },
    { id: "abrir-configuracoes", titulo: "Abrir Configurações", palavras: "preferencias ajustes" },
    { id: "alternar-som", titulo: "Ligar ou desligar todos os sons", palavras: "audio mute silenciar" },
    { id: "tema-cultivo", titulo: "Aplicar Tema Cultivo", palavras: "tema oficial verde aparencia" },
    { id: "modo-foco", titulo: "Alternar Modo Foco", palavras: "interface essencial" },
    { id: "modo-apresentacao", titulo: "Alternar Modo Apresentação", palavras: "projeto tela" },
    { id: "modo-ambiente", titulo: "Entrar no Modo Ambiente", palavras: "relogio descanso" },
    { id: "alternar-musica", titulo: "Reproduzir ou pausar música", palavras: "estacao player" },
  ]);

  const elementos = {
    paginas: [],
    botoesPagina: [],
    centralConfiguracoes: null,
    buscaConfiguracoes: null,
    categoriasConfiguracoes: [],
    paineisConfiguracoes: [],
    controlesConfiguracoes: [],
    modoAmbiente: null,
    paletaComandos: null,
    buscaComandos: null,
    listaComandos: null,
    regiaoNotificacoes: null,
    botaoAlterarPasta: null,
    botaoReescanearBiblioteca: null,
    caminhoBiblioteca: null,
    quantidadeMusicas: null,
    dataBiblioteca: null,
    confirmacaoRedefinir: null,
    amostraCorPersonalizada: null,
  };

  const estado = {
    iniciado: false,
    paginaAtiva: "dashboard",
    categoriaConfiguracoesAtiva: "experiencia",
    origemCentralConfiguracoes: null,
    origemPaletaComandos: null,
    elementoAnteriorModoAmbiente: null,
    modoAmbienteAtivo: false,
    minutosModoAmbienteConfigurados: null,
    temporizadorModoAmbiente: null,
    relogioModoAmbiente: null,
    intervaloInformacoesSistema: null,
    ultimaAtividadePonteiro: 0,
    dadosHorta: null,
    resumoBiblioteca: {
      disponivel: false,
      pasta: null,
      quantidade: 0,
      ultimaAtualizacao: null,
      erros: 0,
    },
    informacoesAplicacao: {},
    indiceComandoAtivo: -1,
    leiturasSessao: 0,
    faixasSessao: 0,
    ultimaLeituraContada: null,
    remocaoProgressoBiblioteca: null,
    remocaoAssinaturaConfiguracoes: null,
    configuracoesTemporarias: new Map(),
    temporizadoresNotificacoes: new WeakMap(),
    navegacaoEmAndamento: false,
    navegacaoPendente: null,
    temporizadorTema: null,
    assinaturaTema: null,
    origemConfirmacaoRedefinir: null,
    encerramentoEmAndamento: false,
    remocaoSolicitacaoEncerramento: null,
  };

  function obterEspacoHorta() {
    return escopoAplicacao.HortaInteligente ?? {};
  }

  function obterGerenciadorConfiguracoes() {
    return obterEspacoHorta().configuracoes ?? null;
  }

  function coletarElementos() {
    elementos.paginas = [...documento.querySelectorAll("[data-pagina]")];
    elementos.botoesPagina = [...documento.querySelectorAll("[data-abrir-pagina]")];
    elementos.centralConfiguracoes = documento.querySelector("#central-configuracoes");
    elementos.buscaConfiguracoes = documento.querySelector("#busca-configuracoes");
    elementos.categoriasConfiguracoes = [
      ...documento.querySelectorAll("[data-categoria-configuracao]"),
    ];
    elementos.paineisConfiguracoes = [
      ...documento.querySelectorAll("[data-painel-configuracao]"),
    ];
    elementos.controlesConfiguracoes = [...documento.querySelectorAll("[data-configuracao]")];
    elementos.modoAmbiente = documento.querySelector("#modo-ambiente");
    elementos.paletaComandos = documento.querySelector("#paleta-comandos");
    elementos.buscaComandos = documento.querySelector("#busca-comandos");
    elementos.listaComandos = documento.querySelector("#lista-comandos");
    elementos.regiaoNotificacoes = documento.querySelector("#regiao-notificacoes");
    elementos.botaoAlterarPasta = documento.querySelector("#botao-alterar-pasta");
    elementos.botaoReescanearBiblioteca = documento.querySelector(
      "#botao-reescanear-biblioteca",
    );
    elementos.caminhoBiblioteca = documento.querySelector("#caminho-biblioteca");
    elementos.quantidadeMusicas = documento.querySelector(
      "#quantidade-musicas-configuracao",
    );
    elementos.dataBiblioteca = documento.querySelector("#data-biblioteca");
    elementos.confirmacaoRedefinir = documento.querySelector("#confirmacao-redefinir-ajustes");
    elementos.amostraCorPersonalizada = documento.querySelector("#amostra-cor-personalizada");
  }

  function normalizarTexto(texto) {
    return String(texto ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("pt-BR")
      .trim();
  }

  function normalizarIdentificador(valor, fallback = "padrao") {
    const identificador = normalizarTexto(valor)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return identificador || fallback;
  }

  function elementoPodeReceberFoco(elemento) {
    if (!(elemento instanceof HTMLElement) || !elemento.isConnected || elemento.hidden) return false;
    if (elemento.closest("[hidden], [inert]")) return false;
    const estilo = escopoAplicacao.getComputedStyle(elemento);
    return estilo.display !== "none" && estilo.visibility !== "hidden";
  }

  function focarComSeguranca(elemento) {
    if (!elementoPodeReceberFoco(elemento)) return false;
    elemento.focus({ preventScroll: true });
    return true;
  }

  function emitirEvento(nome, detalhes = {}) {
    documento.dispatchEvent(new CustomEvent(nome, { detail: detalhes }));
  }

  function aguardarMovimento(elemento, duracaoMaxima = DURACAO_SAIDA_ESTRUTURAL) {
    if (!elemento || raizDocumento.dataset.movimentoReduzido === "true") {
      return Promise.resolve();
    }
    return new Promise((resolver) => {
      let concluiu = false;
      const finalizar = () => {
        if (concluiu) return;
        concluiu = true;
        escopoAplicacao.clearTimeout(temporizador);
        elemento.removeEventListener("animationend", finalizar);
        elemento.removeEventListener("transitionend", finalizar);
        resolver();
      };
      const temporizador = escopoAplicacao.setTimeout(finalizar, duracaoMaxima + 80);
      elemento.addEventListener("animationend", finalizar, { once: true });
      elemento.addEventListener("transitionend", finalizar, { once: true });
    });
  }

  function atualizarBotoesNavegacao(nomePagina) {
    elementos.botoesPagina.forEach((botao) => {
      const botaoEstaAtivo = normalizarIdentificador(botao.dataset.abrirPagina) === nomePagina;
      if (botaoEstaAtivo) botao.setAttribute("aria-current", "page");
      else botao.removeAttribute("aria-current");
      botao.setAttribute("aria-pressed", String(botaoEstaAtivo));
    });
  }

  /**
   * Troca páginas em duas fases: a área atual conclui sua saída e só então a
   * próxima entra. Cliques rápidos são serializados para nunca deixar duas
   * páginas parcialmente visíveis ou com estados ARIA conflitantes.
   */
  async function executarNavegacao(nomeNormalizado, paginaAlvo, opcoes) {
    const paginaAnteriorNome = estado.paginaAtiva;
    const paginaAnterior = elementos.paginas.find((pagina) => !pagina.hidden);
    const deveAnimar = paginaAnterior
      && paginaAnterior !== paginaAlvo
      && corpoDocumento.classList.contains("painel-visivel")
      && raizDocumento.dataset.animacoesAtivas !== "false";

    estado.navegacaoEmAndamento = true;
    atualizarBotoesNavegacao(nomeNormalizado);

    if (deveAnimar) {
      paginaAnterior.classList.add("pagina-saindo");
      paginaAnterior.toggleAttribute("inert", true);
      await aguardarMovimento(paginaAnterior);
      paginaAnterior.classList.remove("pagina-saindo");
    }

    elementos.paginas.forEach((pagina) => {
      const paginaEstaAtiva = pagina === paginaAlvo;
      pagina.hidden = !paginaEstaAtiva;
      pagina.toggleAttribute("inert", !paginaEstaAtiva);
      pagina.setAttribute("aria-hidden", String(!paginaEstaAtiva));
    });
    estado.paginaAtiva = nomeNormalizado;
    corpoDocumento.dataset.paginaAtiva = nomeNormalizado;

    if (deveAnimar) {
      paginaAlvo.classList.add("pagina-entrando");
      await aguardarMovimento(paginaAlvo, DURACAO_SAIDA_ESTRUTURAL + 100);
      paginaAlvo.classList.remove("pagina-entrando");
    }

    if (opcoes.rolar !== false && corpoDocumento.classList.contains("painel-visivel")) {
      escopoAplicacao.scrollTo({ top: 0, behavior: "auto" });
    }
    if (opcoes.focar === true) {
      const destinoFoco = paginaAlvo.querySelector("[data-foco-pagina], h2, h1");
      if (destinoFoco) {
        if (!destinoFoco.hasAttribute("tabindex")) destinoFoco.setAttribute("tabindex", "-1");
        focarComSeguranca(destinoFoco);
      }
    }

    if (paginaAnteriorNome !== nomeNormalizado && opcoes.emitir !== false) {
      emitirEvento("mudancapaginaaplicacao", {
        pagina: nomeNormalizado,
        paginaAnterior: paginaAnteriorNome,
      });
      emitirEvento("eventohorta", { tipo: "pagina", acao: "navegou", alvo: nomeNormalizado });
    }

    estado.navegacaoEmAndamento = false;
    const pendente = estado.navegacaoPendente;
    estado.navegacaoPendente = null;
    if (pendente && pendente.nome !== estado.paginaAtiva) {
      navegar(pendente.nome, pendente.opcoes);
    }
  }

  /** Alterna apenas as regiões de conteúdo; a coleta dos sensores não é pausada. */
  function navegar(nomePagina, opcoes = {}) {
    const nomeNormalizado = normalizarIdentificador(nomePagina, "dashboard");
    const paginaAlvo = elementos.paginas.find(
      (pagina) => normalizarIdentificador(pagina.dataset.pagina) === nomeNormalizado,
    );
    if (!paginaAlvo) return false;
    if (estado.navegacaoEmAndamento) {
      estado.navegacaoPendente = { nome: nomeNormalizado, opcoes };
      return true;
    }
    if (nomeNormalizado === estado.paginaAtiva && !paginaAlvo.hidden) {
      atualizarBotoesNavegacao(nomeNormalizado);
      return true;
    }
    void executarNavegacao(nomeNormalizado, paginaAlvo, opcoes);
    return true;
  }

  function ativarCategoriaConfiguracoes(nomeCategoria, deveFocar = false) {
    const nomeNormalizado = normalizarIdentificador(
      nomeCategoria,
      estado.categoriaConfiguracoesAtiva,
    );
    const categoriaAlvo = elementos.categoriasConfiguracoes.find(
      (categoria) => normalizarIdentificador(categoria.dataset.categoriaConfiguracao) === nomeNormalizado,
    );
    const painelAlvo = elementos.paineisConfiguracoes.find(
      (painel) => normalizarIdentificador(painel.dataset.painelConfiguracao) === nomeNormalizado,
    );
    if (!categoriaAlvo || !painelAlvo) return false;

    estado.categoriaConfiguracoesAtiva = nomeNormalizado;
    elementos.categoriasConfiguracoes.forEach((categoria) => {
      const estaAtiva = categoria === categoriaAlvo;
      categoria.setAttribute("aria-selected", String(estaAtiva));
      categoria.setAttribute("aria-pressed", String(estaAtiva));
      categoria.tabIndex = estaAtiva ? 0 : -1;
    });
    elementos.paineisConfiguracoes.forEach((painel) => {
      const estaAtivo = painel === painelAlvo;
      painel.hidden = !estaAtivo;
      painel.toggleAttribute("inert", !estaAtivo);
      painel.setAttribute("aria-hidden", String(!estaAtivo));
    });
    elementos.centralConfiguracoes?.classList.remove("pesquisa-ativa");
    if (deveFocar) focarComSeguranca(categoriaAlvo);
    return true;
  }

  function filtrarConfiguracoes(consulta) {
    const termo = normalizarTexto(consulta);
    const itens = [...documento.querySelectorAll(".item-configuracao")];
    const indicadorResultado = documento.querySelector("#resultado-busca-configuracoes");
    const estadoVazio = documento.querySelector("#nenhuma-configuracao");

    if (!termo) {
      itens.forEach((item) => { item.hidden = false; });
      if (estadoVazio) estadoVazio.hidden = true;
      ativarCategoriaConfiguracoes(estado.categoriaConfiguracoesAtiva);
      if (indicadorResultado) indicadorResultado.textContent = "";
      return;
    }

    elementos.centralConfiguracoes?.classList.add("pesquisa-ativa");
    let quantidadeResultados = 0;
    itens.forEach((item) => {
      const conteudoPesquisavel = normalizarTexto(
        `${item.textContent} ${item.dataset.palavrasChave ?? ""} ${item.dataset.termos ?? ""}`,
      );
      const corresponde = conteudoPesquisavel.includes(termo);
      item.hidden = !corresponde;
      if (corresponde) quantidadeResultados += 1;
    });

    elementos.paineisConfiguracoes.forEach((painel) => {
      const possuiResultado = [...painel.querySelectorAll(".item-configuracao")]
        .some((item) => !item.hidden);
      painel.hidden = !possuiResultado;
      painel.toggleAttribute("inert", !possuiResultado);
      painel.setAttribute("aria-hidden", String(!possuiResultado));
    });
    elementos.categoriasConfiguracoes.forEach((categoria) => {
      categoria.setAttribute("aria-selected", "false");
      categoria.setAttribute("aria-pressed", "false");
      categoria.tabIndex = -1;
    });

    if (indicadorResultado) {
      indicadorResultado.textContent = quantidadeResultados === 1
        ? "1 configuração encontrada"
        : `${quantidadeResultados} configurações encontradas`;
    }
    if (estadoVazio) estadoVazio.hidden = quantidadeResultados > 0;
  }

  async function fecharDialogoComTransicao(dialogo) {
    if (!dialogo?.open || dialogo.dataset.fechando === "true") return false;
    if (raizDocumento.dataset.movimentoReduzido !== "true") {
      dialogo.dataset.fechando = "true";
      dialogo.toggleAttribute("inert", true);
      await aguardarMovimento(dialogo);
    }
    if (typeof dialogo.close === "function") dialogo.close();
    else {
      dialogo.removeAttribute("open");
      dialogo.hidden = true;
    }
    dialogo.removeAttribute("data-fechando");
    dialogo.removeAttribute("inert");
    return true;
  }

  function abrirConfiguracoes(categoria = null, origem = null) {
    const dialogo = elementos.centralConfiguracoes;
    if (!dialogo) return false;
    if (estado.modoAmbienteAtivo) sairModoAmbiente({ restaurarFoco: false });

    estado.origemCentralConfiguracoes = origem instanceof HTMLElement
      ? origem
      : documento.activeElement;

    if (elementos.buscaConfiguracoes) {
      elementos.buscaConfiguracoes.value = "";
      filtrarConfiguracoes("");
    }
    ativarCategoriaConfiguracoes(categoria ?? estado.categoriaConfiguracoesAtiva);

    if (!dialogo.open) {
      raizDocumento.classList.add("configuracoes-abertas");
      if (typeof dialogo.showModal === "function") dialogo.showModal();
      else {
        dialogo.hidden = false;
        dialogo.setAttribute("open", "");
      }
      emitirEvento("eventohorta", { tipo: "configuracoes", acao: "abriu" });
    }

    escopoAplicacao.requestAnimationFrame(() => {
      focarComSeguranca(elementos.buscaConfiguracoes)
        || focarComSeguranca(
          elementos.categoriasConfiguracoes.find(
            (item) => item.getAttribute("aria-selected") === "true",
          ),
        );
    });
    return true;
  }

  function encontrarAcessoConfiguracoesVisivel() {
    return [...documento.querySelectorAll("[data-abrir-configuracoes]")]
      .find((botao) => elementoPodeReceberFoco(botao));
  }

  function fecharConfiguracoes() {
    const dialogo = elementos.centralConfiguracoes;
    if (!dialogo?.open) return false;
    void fecharDialogoComTransicao(dialogo).then(() => {
      if (typeof dialogo.close !== "function") concluirFechamentoConfiguracoes();
    });
    return true;
  }

  function concluirFechamentoConfiguracoes() {
    elementos.centralConfiguracoes?.removeAttribute("data-fechando");
    elementos.centralConfiguracoes?.removeAttribute("inert");
    raizDocumento.classList.remove("configuracoes-abertas");
    const origem = estado.origemCentralConfiguracoes;
    estado.origemCentralConfiguracoes = null;
    escopoAplicacao.requestAnimationFrame(() => {
      focarComSeguranca(origem) || focarComSeguranca(encontrarAcessoConfiguracoesVisivel());
    });
    emitirEvento("eventohorta", { tipo: "configuracoes", acao: "fechou" });
    agendarModoAmbiente();
  }

  function abrirConfirmacaoRedefinir(origem = null) {
    const dialogo = elementos.confirmacaoRedefinir;
    if (!dialogo) return false;
    estado.origemConfirmacaoRedefinir = origem instanceof HTMLElement
      ? origem
      : documento.activeElement;
    if (!dialogo.open) dialogo.showModal?.();
    escopoAplicacao.requestAnimationFrame(() => {
      focarComSeguranca(dialogo.querySelector("[data-cancelar-redefinicao]"));
    });
    return true;
  }

  function fecharConfirmacaoRedefinir() {
    if (!elementos.confirmacaoRedefinir?.open) return false;
    void fecharDialogoComTransicao(elementos.confirmacaoRedefinir);
    return true;
  }

  function concluirFechamentoConfirmacao() {
    elementos.confirmacaoRedefinir?.removeAttribute("data-fechando");
    elementos.confirmacaoRedefinir?.removeAttribute("inert");
    const origem = estado.origemConfirmacaoRedefinir;
    estado.origemConfirmacaoRedefinir = null;
    escopoAplicacao.requestAnimationFrame(() => focarComSeguranca(origem));
  }

  async function confirmarRedefinicao() {
    const gerenciador = obterGerenciadorConfiguracoes();
    const botao = elementos.confirmacaoRedefinir?.querySelector(
      "[data-confirmar-redefinicao]",
    );
    if (!gerenciador || typeof gerenciador.redefinirAjustes !== "function") return;
    botao?.setAttribute("aria-busy", "true");
    if (botao) botao.disabled = true;
    try {
      await gerenciador.redefinirAjustes();
      aplicarConfiguracoesVisuais();
      sincronizarControlesConfiguracoes();
      fecharConfirmacaoRedefinir();
      notificar({
        titulo: "Ajustes redefinidos",
        mensagem: "A identidade Cultivo foi restaurada sem apagar sua biblioteca ou a horta.",
        tipo: "sucesso",
      });
    } catch (erro) {
      console.error("Não foi possível redefinir as preferências.", erro);
      notificar({
        titulo: "Ajustes não redefinidos",
        mensagem: "As preferências atuais foram mantidas. Tente novamente.",
        tipo: "erro",
      });
    } finally {
      botao?.removeAttribute("aria-busy");
      if (botao) botao.disabled = false;
    }
  }

  function obterConfiguracao(caminho, valorPadrao = undefined) {
    const gerenciador = obterGerenciadorConfiguracoes();
    if (gerenciador && typeof gerenciador.obter === "function") {
      return gerenciador.obter(caminho, valorPadrao);
    }
    return estado.configuracoesTemporarias.has(caminho)
      ? estado.configuracoesTemporarias.get(caminho)
      : valorPadrao;
  }

  async function alterarConfiguracao(caminho, valor) {
    const gerenciador = obterGerenciadorConfiguracoes();
    if (gerenciador && typeof gerenciador.alterar === "function") {
      return gerenciador.alterar(caminho, valor);
    }
    estado.configuracoesTemporarias.set(caminho, valor);
    aplicarConfiguracoesVisuais();
    sincronizarControlesConfiguracoes();
    return null;
  }

  async function alterarConfiguracoesEmLote(alteracoes) {
    const gerenciador = obterGerenciadorConfiguracoes();
    if (gerenciador && typeof gerenciador.alterarLote === "function") {
      return gerenciador.alterarLote(alteracoes);
    }
    await Promise.all(
      Object.entries(alteracoes).map(([caminho, valor]) => alterarConfiguracao(caminho, valor)),
    );
    return null;
  }

  function converterValorControle(controle) {
    if (controle instanceof HTMLInputElement) {
      if (controle.type === "checkbox") return controle.checked;
      if (controle.type === "radio") return controle.checked ? controle.value : undefined;
      if (["range", "number"].includes(controle.type)) {
        const numero = Number(controle.value);
        if (!Number.isFinite(numero)) return 0;
        return controle.dataset.tipoConfiguracao === "percentual" ? numero / 100 : numero;
      }
      return controle.value;
    }
    if (controle instanceof HTMLSelectElement || controle instanceof HTMLTextAreaElement) {
      return controle.value;
    }
    if (controle instanceof HTMLButtonElement) {
      if (controle.dataset.valorConfiguracao !== undefined) {
        const valor = controle.dataset.valorConfiguracao;
        if (valor === "true") return true;
        if (valor === "false") return false;
        if (valor !== "" && Number.isFinite(Number(valor))) return Number(valor);
        return valor;
      }
      if (controle.hasAttribute("aria-pressed")) {
        return controle.getAttribute("aria-pressed") !== "true";
      }
    }
    return undefined;
  }

  function formatarValorControle(caminho, valor, controle = null) {
    const formato = controle?.dataset.formatoConfiguracao;
    if (formato === "porcentagem" || caminho.endsWith(".volume")) {
      const numero = Number(valor);
      return Number.isFinite(numero) ? `${Math.round(numero * 100)}%` : "--";
    }
    if (formato === "segundos") return `${valor} s`;
    if (typeof valor === "boolean") return valor ? "Ligado" : "Desligado";
    return String(valor ?? "");
  }

  function atualizarSaidaControle(controle, caminho, valor) {
    const seletores = [`[data-saida-configuracao="${caminho}"]`];
    if (controle.id) seletores.push(`output[for="${controle.id}"]`);
    const saidas = new Set(documento.querySelectorAll(seletores.join(",")));
    const saidaVizinha = controle.closest(".item-configuracao")?.querySelector("output");
    if (saidaVizinha) saidas.add(saidaVizinha);
    saidas.forEach((saida) => {
      saida.textContent = formatarValorControle(caminho, valor, controle);
    });
  }

  function sincronizarControle(controle) {
    const caminho = controle.dataset.configuracao;
    if (!caminho) return;
    const valor = obterConfiguracao(caminho);
    if (valor === undefined) return;

    if (controle instanceof HTMLInputElement) {
      if (controle.type === "checkbox") controle.checked = Boolean(valor);
      else if (controle.type === "radio") controle.checked = String(controle.value) === String(valor);
      else if (documento.activeElement !== controle) {
        const valorControle = controle.dataset.tipoConfiguracao === "percentual"
          ? Number(valor) * 100
          : valor;
        controle.value = String(valorControle);
      }
    } else if (controle instanceof HTMLSelectElement || controle instanceof HTMLTextAreaElement) {
      if (documento.activeElement !== controle) controle.value = String(valor);
    } else if (controle instanceof HTMLButtonElement) {
      const possuiValorProprio = controle.dataset.valorConfiguracao !== undefined;
      const estaAtivo = possuiValorProprio
        ? String(controle.dataset.valorConfiguracao) === String(valor)
        : Boolean(valor);
      controle.setAttribute("aria-pressed", String(estaAtivo));
    } else if (["OUTPUT", "SPAN", "STRONG"].includes(controle.tagName)) {
      controle.textContent = formatarValorControle(caminho, valor, controle);
    }
    atualizarSaidaControle(controle, caminho, valor);
  }

  function sincronizarControlesConfiguracoes() {
    elementos.controlesConfiguracoes = [...documento.querySelectorAll("[data-configuracao]")];
    elementos.controlesConfiguracoes.forEach(sincronizarControle);

    const perfilSistemaAtual = obterConfiguracao("geral.perfilSistema", "padrao");
    documento.querySelectorAll("[data-perfil-sistema]").forEach((botao) => {
      botao.setAttribute(
        "aria-pressed",
        String(botao.dataset.perfilSistema === perfilSistemaAtual),
      );
    });
    const perfilAudioAtual = obterConfiguracao("audio.perfil", "imersivo");
    documento.querySelectorAll("[data-perfil-audio]").forEach((botao) => {
      botao.setAttribute(
        "aria-pressed",
        String(botao.dataset.perfilAudio === perfilAudioAtual),
      );
    });
  }

  async function registrarValorControle(controle) {
    const caminho = controle.dataset.configuracao;
    if (!caminho || ["OUTPUT", "SPAN", "STRONG"].includes(controle.tagName)) return;
    const valor = converterValorControle(controle);
    if (valor === undefined) return;
    if (caminho === "aparencia.corPersonalizada") {
      // Escolher a amostra personalizada também a torna a cor principal ativa.
      await alterarConfiguracoesEmLote({
        "aparencia.corPersonalizada": valor,
        "aparencia.corDestaque": "personalizada",
      });
    } else if (caminho === "interface.modoFoco" && valor === true) {
      await alterarConfiguracoesEmLote({
        "interface.modoFoco": true,
        "interface.modoApresentacao": false,
      });
    } else if (caminho === "interface.modoApresentacao" && valor === true) {
      await alterarConfiguracoesEmLote({
        "interface.modoFoco": false,
        "interface.modoApresentacao": true,
      });
    } else {
      await alterarConfiguracao(caminho, valor);
    }
    atualizarSaidaControle(controle, caminho, valor);
  }

  function converterHexadecimalParaRgb(cor) {
    const valor = String(cor ?? "").trim();
    const correspondencia = valor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (!correspondencia) return null;
    const hexadecimal = correspondencia[1].length === 3
      ? correspondencia[1].split("").map((caractere) => caractere.repeat(2)).join("")
      : correspondencia[1];
    return [0, 2, 4].map((indice) => Number.parseInt(hexadecimal.slice(indice, indice + 2), 16));
  }

  function converterRgbParaHexadecimal(rgb) {
    return `#${rgb.map((canal) => Math.round(canal)
      .toString(16)
      .padStart(2, "0")).join("")}`;
  }

  function misturarCores(rgbOrigem, rgbDestino, proporcao) {
    const peso = Math.max(0, Math.min(Number(proporcao) || 0, 1));
    return rgbOrigem.map((canal, indice) => (
      canal + ((rgbDestino[indice] - canal) * peso)
    ));
  }

  function luminanciaRelativa(rgb) {
    const canais = rgb.map((canal) => {
      const valor = canal / 255;
      return valor <= 0.03928 ? valor / 12.92 : ((valor + 0.055) / 1.055) ** 2.4;
    });
    return (0.2126 * canais[0]) + (0.7152 * canais[1]) + (0.0722 * canais[2]);
  }

  function calcularContraste(rgbA, rgbB) {
    const clara = Math.max(luminanciaRelativa(rgbA), luminanciaRelativa(rgbB));
    const escura = Math.min(luminanciaRelativa(rgbA), luminanciaRelativa(rgbB));
    return (clara + 0.05) / (escura + 0.05);
  }

  /**
   * A cor escolhida continua reconhecível, mas sua versão operacional é
   * aproximada do claro ou do escuro até alcançar contraste de interface.
   * Cores de estado (erro, atenção e conectado) permanecem semânticas no CSS.
   */
  function derivarCorPrincipal(corOriginal, modoCor) {
    const rgbOriginal = converterHexadecimalParaRgb(corOriginal) ?? [101, 217, 154];
    const fundoReferencia = modoCor === "claro" ? [244, 249, 246] : [7, 18, 15];
    const destinoContraste = modoCor === "claro" ? [18, 58, 42] : [224, 255, 240];
    let rgbOperacional = [...rgbOriginal];
    let passo = 0;
    while (calcularContraste(rgbOperacional, fundoReferencia) < 4.5 && passo < 18) {
      rgbOperacional = misturarCores(rgbOperacional, destinoContraste, 0.12);
      passo += 1;
    }

    const textoEscuro = [4, 18, 13];
    const textoClaro = [251, 255, 253];
    const corSobreDestaque = calcularContraste(rgbOperacional, textoEscuro)
      >= calcularContraste(rgbOperacional, textoClaro)
      ? textoEscuro
      : textoClaro;
    const rgbHover = misturarCores(
      rgbOperacional,
      modoCor === "claro" ? [0, 25, 16] : [255, 255, 255],
      0.12,
    );
    const rgbAtiva = misturarCores(
      rgbOperacional,
      modoCor === "claro" ? [0, 18, 12] : [255, 255, 255],
      0.22,
    );

    return {
      cor: converterRgbParaHexadecimal(rgbOperacional),
      rgb: rgbOperacional.map(Math.round),
      hover: converterRgbParaHexadecimal(rgbHover),
      ativa: converterRgbParaHexadecimal(rgbAtiva),
      sobre: converterRgbParaHexadecimal(corSobreDestaque),
    };
  }

  function horarioEstaNoIntervalo(horarioAtual, inicio, fim) {
    const converterMinutos = (horario) => {
      const [horas, minutos] = String(horario ?? "").split(":").map(Number);
      if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return null;
      return horas * 60 + minutos;
    };
    const atual = horarioAtual.getHours() * 60 + horarioAtual.getMinutes();
    const minutoInicio = converterMinutos(inicio);
    const minutoFim = converterMinutos(fim);
    if (minutoInicio === null || minutoFim === null || minutoInicio === minutoFim) return false;
    return minutoInicio < minutoFim
      ? atual >= minutoInicio && atual < minutoFim
      : atual >= minutoInicio || atual < minutoFim;
  }

  /** Aplica somente atributos e variáveis. O CSS decide a aparência de cada modo. */
  function aplicarConfiguracoesVisuais() {
    const modoCorPreferido = normalizarIdentificador(
      obterConfiguracao("aparencia.modoCor", "cultivo"),
      "cultivo",
    );
    let modoCorAplicado = modoCorPreferido === "sistema"
      ? (consultaTemaEscuro.matches ? "escuro" : "claro")
      : modoCorPreferido;
    const temaAutomaticoAtivo = Boolean(
      obterConfiguracao("aparencia.temaAutomatico.ativo", false),
    );
    const periodoNoturno = temaAutomaticoAtivo && horarioEstaNoIntervalo(
      new Date(),
      obterConfiguracao("aparencia.temaAutomatico.inicio", "20:00"),
      obterConfiguracao("aparencia.temaAutomatico.fim", "07:00"),
    );
    if (periodoNoturno && modoCorAplicado === "claro") modoCorAplicado = "escuro";
    const nomeCor = normalizarIdentificador(
      obterConfiguracao("aparencia.corDestaque", "cultivo"),
      "cultivo",
    );
    const corPersonalizada = obterConfiguracao("aparencia.corPersonalizada", "#65d99a");
    const corDestaqueOriginal = nomeCor === "personalizada"
      ? (converterHexadecimalParaRgb(corPersonalizada) ? corPersonalizada : CORES_DESTAQUE.cultivo)
      : (CORES_DESTAQUE[nomeCor] ?? CORES_DESTAQUE.cultivo);
    const modoParaContraste = modoCorAplicado === "claro" ? "claro" : "escuro";
    const corDerivada = derivarCorPrincipal(corDestaqueOriginal, modoParaContraste);
    const rgbDestaque = corDerivada.rgb;

    const assinaturaTema = `${modoCorAplicado}:${nomeCor}:${corDestaqueOriginal}:${periodoNoturno}`;
    if (estado.assinaturaTema && estado.assinaturaTema !== assinaturaTema) {
      raizDocumento.classList.remove("tema-em-transicao");
      // Uma leitura de layout reinicia a transição sem empilhar animações antigas.
      void raizDocumento.offsetWidth;
      raizDocumento.classList.add("tema-em-transicao");
      escopoAplicacao.clearTimeout(estado.temporizadorTema);
      estado.temporizadorTema = escopoAplicacao.setTimeout(() => {
        raizDocumento.classList.remove("tema-em-transicao");
      }, DURACAO_TROCA_TEMA);
    }
    estado.assinaturaTema = assinaturaTema;

    raizDocumento.dataset.modoCor = modoCorAplicado;
    raizDocumento.dataset.atmosfera = periodoNoturno ? "noturno" : "natural";
    raizDocumento.dataset.periodoNoturno = String(periodoNoturno);
    raizDocumento.dataset.corDestaque = nomeCor;
    raizDocumento.dataset.intensidadeVisual = normalizarIdentificador(
      obterConfiguracao("aparencia.intensidadeVisual", "normal"),
      "normal",
    );
    raizDocumento.style.colorScheme = modoParaContraste === "claro" ? "light" : "dark";
    raizDocumento.style.setProperty("--cor-destaque-original", corDestaqueOriginal);
    raizDocumento.style.setProperty("--cor-destaque", corDerivada.cor);
    raizDocumento.style.setProperty("--cor-destaque-hover", corDerivada.hover);
    raizDocumento.style.setProperty("--cor-destaque-ativa", corDerivada.ativa);
    raizDocumento.style.setProperty("--cor-sobre-destaque", corDerivada.sobre);
    raizDocumento.style.setProperty("--cor-destaque-rgb", rgbDestaque.join(", "));
    raizDocumento.style.setProperty(
      "--cor-destaque-suave",
      `rgba(${rgbDestaque.join(", ")}, 0.14)`,
    );
    raizDocumento.style.setProperty(
      "--cor-destaque-brilho",
      `rgba(${rgbDestaque.join(", ")}, 0.34)`,
    );
    elementos.amostraCorPersonalizada?.style.setProperty(
      "--cor-amostra-personalizada",
      corPersonalizada,
    );

    const movimentoReduzido = consultaMovimentoReduzido.matches
      || Boolean(obterConfiguracao("acessibilidade.reduzirMovimentos", false));
    raizDocumento.dataset.movimentoReduzido = String(movimentoReduzido);
    raizDocumento.dataset.animacoesAtivas = String(
      Boolean(obterConfiguracao("interface.animacoesAtivas", true)) && !movimentoReduzido,
    );
    raizDocumento.dataset.intensidadeAnimacoes = normalizarIdentificador(
      obterConfiguracao("interface.intensidadeAnimacoes", "normal"),
      "normal",
    );
    raizDocumento.dataset.efeitosFundoAtivos = String(
      Boolean(obterConfiguracao("interface.efeitosFundoAtivos", true)),
    );
    raizDocumento.dataset.microinteracoesAtivas = String(
      Boolean(obterConfiguracao("interface.microinteracoesAtivas", true)),
    );
    raizDocumento.dataset.indicadorNovaLeituraAtivo = String(
      Boolean(obterConfiguracao("interface.indicadorNovaLeituraAtivo", true)),
    );
    raizDocumento.dataset.altoContraste = String(
      Boolean(obterConfiguracao("acessibilidade.altoContraste", false)),
    );
    raizDocumento.dataset.textosAumentados = String(
      Boolean(obterConfiguracao("acessibilidade.aumentarTextos", false)),
    );
    raizDocumento.dataset.transparenciasAtivas = String(
      !Boolean(obterConfiguracao("acessibilidade.desativarTransparencias", false)),
    );
    raizDocumento.dataset.visualizadorAtivo = String(
      Boolean(obterConfiguracao("interface.visualizadorMusicaAtivo", true))
        && Boolean(obterConfiguracao("estacao.mostrarVisualizador", true))
        && !Boolean(obterConfiguracao("acessibilidade.semVisualizador", false)),
    );

    const modoApresentacao = Boolean(obterConfiguracao("interface.modoApresentacao", false));
    const modoFoco = Boolean(obterConfiguracao("interface.modoFoco", false));
    corpoDocumento.dataset.modoExperiencia = modoApresentacao
      ? "apresentacao"
      : (modoFoco ? "foco" : "padrao");

    const nomeSistema = String(
      obterConfiguracao("geral.nomeSistema", "Horta Inteligente"),
    ).trim() || "Horta Inteligente";
    documento.querySelectorAll("[data-nome-sistema]").forEach((elemento) => {
      elemento.textContent = nomeSistema;
    });

    const minutosModoAmbiente = obterMinutosModoAmbiente();
    if (estado.minutosModoAmbienteConfigurados !== minutosModoAmbiente) {
      estado.minutosModoAmbienteConfigurados = minutosModoAmbiente;
      agendarModoAmbiente();
    }
    atualizarInformacoesSistema();
  }

  async function aplicarPerfil(tipo, nomePerfil, botaoOrigem = null) {
    const gerenciador = obterGerenciadorConfiguracoes();
    const metodo = tipo === "audio" ? "aplicarPerfilAudio" : "aplicarPerfilSistema";
    if (!gerenciador || typeof gerenciador[metodo] !== "function") return false;
    botaoOrigem?.setAttribute("aria-busy", "true");
    if (botaoOrigem) botaoOrigem.disabled = true;
    try {
      await gerenciador[metodo](nomePerfil);
      notificar({
        titulo: "Perfil aplicado",
        mensagem: `${String(nomePerfil).replace(/-/g, " ")} está ativo.`,
        tipo: "sucesso",
      });
      return true;
    } catch (erro) {
      console.error("Não foi possível aplicar o perfil.", erro);
      notificar({
        titulo: "Perfil não aplicado",
        mensagem: "Tente novamente em alguns instantes.",
        tipo: "erro",
      });
      return false;
    } finally {
      botaoOrigem?.removeAttribute("aria-busy");
      if (botaoOrigem) botaoOrigem.disabled = false;
    }
  }

  async function executarAcaoConfiguracao(acao) {
    if (acao === "testar-sfx") {
      obterEspacoHorta().sons?.testarEfeito?.();
      return;
    }
    if (acao === "alternar-foco") {
      await alterarConfiguracoesEmLote({
        "interface.modoFoco": !Boolean(obterConfiguracao("interface.modoFoco", false)),
        "interface.modoApresentacao": false,
      });
      return;
    }
    if (acao === "alternar-apresentacao") {
      await alterarConfiguracoesEmLote({
        "interface.modoFoco": false,
        "interface.modoApresentacao": !Boolean(
          obterConfiguracao("interface.modoApresentacao", false),
        ),
      });
    }
  }

  function obterMinutosModoAmbiente() {
    const valor = obterConfiguracao("interface.modoAmbienteMinutos", 0);
    if (["nunca", "desativado", "off"].includes(normalizarTexto(valor))) return 0;
    const numero = Number(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : 0;
  }

  function ambientePodeAbrir() {
    return Boolean(
      elementos.modoAmbiente
      && corpoDocumento.classList.contains("painel-visivel")
      && !documento.hidden
      && !documento.querySelector("dialog[open]")
      && !raizDocumento.classList.contains("estacao-imersiva"),
    );
  }

  function agendarModoAmbiente(atrasoPersonalizado = null) {
    escopoAplicacao.clearTimeout(estado.temporizadorModoAmbiente);
    estado.temporizadorModoAmbiente = null;
    if (estado.modoAmbienteAtivo) return;
    const minutos = obterMinutosModoAmbiente();
    if (minutos <= 0) return;

    estado.temporizadorModoAmbiente = escopoAplicacao.setTimeout(() => {
      if (ambientePodeAbrir()) entrarModoAmbiente();
      else agendarModoAmbiente(30000);
    }, atrasoPersonalizado ?? minutos * 60000);
  }

  function atualizarRelogioAmbiente() {
    const agora = new Date();
    atualizarDadosAmbiente("hora", formatadorHorario.format(agora));
    atualizarDadosAmbiente("data", formatadorDataAmbiente.format(agora));
  }

  function entrarModoAmbiente() {
    if (!ambientePodeAbrir()) return false;
    escopoAplicacao.clearTimeout(estado.temporizadorModoAmbiente);
    estado.temporizadorModoAmbiente = null;
    estado.elementoAnteriorModoAmbiente = documento.activeElement;
    estado.modoAmbienteAtivo = true;
    elementos.modoAmbiente.hidden = false;
    elementos.modoAmbiente.removeAttribute("inert");
    elementos.modoAmbiente.setAttribute("aria-hidden", "false");
    corpoDocumento.classList.add("modo-ambiente-ativo");
    atualizarModoAmbiente(estado.dadosHorta);
    atualizarRelogioAmbiente();
    escopoAplicacao.clearInterval(estado.relogioModoAmbiente);
    estado.relogioModoAmbiente = escopoAplicacao.setInterval(atualizarRelogioAmbiente, 1000);
    escopoAplicacao.requestAnimationFrame(() => elementos.modoAmbiente.classList.add("esta-visivel"));
    emitirEvento("mudancamodoambiente", { ativo: true });
    return true;
  }

  function sairModoAmbiente({ restaurarFoco = true } = {}) {
    if (!estado.modoAmbienteAtivo) return false;
    estado.modoAmbienteAtivo = false;
    elementos.modoAmbiente?.classList.remove("esta-visivel");
    corpoDocumento.classList.remove("modo-ambiente-ativo");
    escopoAplicacao.clearInterval(estado.relogioModoAmbiente);
    estado.relogioModoAmbiente = null;

    const finalizar = () => {
      if (estado.modoAmbienteAtivo || !elementos.modoAmbiente) return;
      elementos.modoAmbiente.hidden = true;
      elementos.modoAmbiente.setAttribute("inert", "");
      elementos.modoAmbiente.setAttribute("aria-hidden", "true");
    };
    if (raizDocumento.dataset.movimentoReduzido === "true") finalizar();
    else escopoAplicacao.setTimeout(finalizar, 360);

    if (restaurarFoco) focarComSeguranca(estado.elementoAnteriorModoAmbiente);
    estado.elementoAnteriorModoAmbiente = null;
    emitirEvento("mudancamodoambiente", { ativo: false });
    agendarModoAmbiente();
    return true;
  }

  function registrarAtividadeUsuario(evento) {
    if (estado.modoAmbienteAtivo) {
      sairModoAmbiente();
      return;
    }
    if (evento.type === "pointermove") {
      const agora = Date.now();
      if (agora - estado.ultimaAtividadePonteiro < 5000) return;
      estado.ultimaAtividadePonteiro = agora;
    }
    agendarModoAmbiente();
  }

  function atualizarDadosAmbiente(nome, valor) {
    const identificador = normalizarIdentificador(nome);
    const seletores = [
      `[data-dado-ambiente="${identificador}"]`,
      `#${identificador}-ambiente`,
      `#${identificador}-modo-ambiente`,
    ];
    documento.querySelectorAll(seletores.join(",")).forEach((elemento) => {
      elemento.textContent = String(valor ?? "--");
    });
  }

  function atualizarModoAmbiente(dadosRecebidos) {
    if (!dadosRecebidos || typeof dadosRecebidos !== "object") return;
    estado.dadosHorta = dadosRecebidos;
    const umidade = Number(dadosRecebidos.umidadeSolo);
    atualizarDadosAmbiente("umidade", Number.isFinite(umidade) ? `${Math.round(umidade)}%` : "--");
    atualizarDadosAmbiente(
      "bomba",
      dadosRecebidos.bombaLigada === true ? "Ligada" : (dadosRecebidos.bombaLigada === false ? "Desligada" : "--"),
    );
    atualizarDadosAmbiente(
      "iluminacao",
      dadosRecebidos.iluminacaoLigada === true
        ? "Ligada"
        : (dadosRecebidos.iluminacaoLigada === false ? "Desligada" : "--"),
    );
    const conexao = dadosRecebidos.estadoArduino?.conexao
      ?? dadosRecebidos.estadoArduino
      ?? dadosRecebidos.conexaoArduino;
    atualizarDadosAmbiente("arduino", conexao ? String(conexao) : "Aguardando");
    atualizarInformacoesSistema();
  }

  function criarComandosPadraoSeNecessario() {
    if (!elementos.listaComandos || elementos.listaComandos.querySelector("[data-comando]")) return;
    const fragmento = documento.createDocumentFragment();
    COMANDOS_PADRAO.forEach((comando) => {
      const botao = documento.createElement("button");
      botao.type = "button";
      botao.className = "item-comando";
      botao.dataset.comando = comando.id;
      botao.dataset.palavrasChave = comando.palavras;
      botao.setAttribute("role", "option");
      botao.textContent = comando.titulo;
      fragmento.append(botao);
    });
    elementos.listaComandos.append(fragmento);
  }

  function obterComandosVisiveis() {
    if (!elementos.listaComandos) return [];
    return [...elementos.listaComandos.querySelectorAll("[data-comando]")]
      .filter((comando) => !comando.hidden);
  }

  function selecionarComando(indice) {
    const comandos = obterComandosVisiveis();
    if (comandos.length === 0) {
      estado.indiceComandoAtivo = -1;
      return;
    }
    estado.indiceComandoAtivo = (indice + comandos.length) % comandos.length;
    comandos.forEach((comando, posicao) => {
      const estaAtivo = posicao === estado.indiceComandoAtivo;
      comando.setAttribute("aria-selected", String(estaAtivo));
      comando.classList.toggle("esta-ativo", estaAtivo);
    });
    comandos[estado.indiceComandoAtivo].scrollIntoView({ block: "nearest" });
  }

  function filtrarComandos(consulta) {
    if (!elementos.listaComandos) return;
    const termo = normalizarTexto(consulta);
    elementos.listaComandos.querySelectorAll("[data-comando]").forEach((comando) => {
      const conteudo = normalizarTexto(
        `${comando.textContent} ${comando.dataset.palavrasChave ?? ""}`,
      );
      comando.hidden = termo !== "" && !conteudo.includes(termo);
    });
    selecionarComando(0);
  }

  function abrirPaletaComandos(origem = null) {
    const dialogo = elementos.paletaComandos;
    if (!dialogo || elementos.centralConfiguracoes?.open) return false;
    if (estado.modoAmbienteAtivo) sairModoAmbiente({ restaurarFoco: false });
    estado.origemPaletaComandos = origem instanceof HTMLElement ? origem : documento.activeElement;
    if (elementos.buscaComandos) elementos.buscaComandos.value = "";
    filtrarComandos("");
    if (!dialogo.open) dialogo.showModal?.();
    escopoAplicacao.requestAnimationFrame(() => focarComSeguranca(elementos.buscaComandos));
    return true;
  }

  function concluirFechamentoPaleta() {
    elementos.paletaComandos?.removeAttribute("data-fechando");
    elementos.paletaComandos?.removeAttribute("inert");
    const origem = estado.origemPaletaComandos;
    estado.origemPaletaComandos = null;
    focarComSeguranca(origem);
    agendarModoAmbiente();
  }

  async function fecharPaletaComandos() {
    if (!elementos.paletaComandos?.open) return false;
    return fecharDialogoComTransicao(elementos.paletaComandos);
  }

  async function executarComando(nomeComando) {
    const comando = normalizarIdentificador(nomeComando);
    await fecharPaletaComandos();
    switch (comando) {
      case "abrir-dashboard":
      case "dashboard":
        navegar("dashboard", { focar: true });
        break;
      case "abrir-estacao":
      case "estacao":
        navegar("estacao", { focar: true });
        break;
      case "abrir-configuracoes":
      case "configuracoes":
        abrirConfiguracoes();
        break;
      case "alternar-som":
        await alterarConfiguracao(
          "audio.somGeralAtivo",
          !Boolean(obterConfiguracao("audio.somGeralAtivo", true)),
        );
        notificar("Estado geral do som atualizado.");
        break;
      case "tema-cultivo":
        await alterarConfiguracao("aparencia.modoCor", "cultivo");
        notificar("Tema Cultivo aplicado.");
        break;
      case "modo-foco":
        await alterarConfiguracoesEmLote({
          "interface.modoFoco": !Boolean(obterConfiguracao("interface.modoFoco", false)),
          "interface.modoApresentacao": false,
        });
        break;
      case "modo-apresentacao":
        await alterarConfiguracoesEmLote({
          "interface.modoFoco": false,
          "interface.modoApresentacao": !Boolean(
            obterConfiguracao("interface.modoApresentacao", false),
          ),
        });
        break;
      case "modo-ambiente":
        escopoAplicacao.setTimeout(entrarModoAmbiente, 0);
        break;
      case "alternar-musica": {
        const estacao = obterEspacoHorta().estacao;
        const alternar = estacao?.alternarReproducao ?? estacao?.player?.alternarReproducao;
        if (typeof alternar === "function") alternar.call(estacao.player ?? estacao);
        else navegar("estacao", { focar: true });
        break;
      }
      default:
        emitirEvento("comandointerface", { comando });
    }
  }

  function removerNotificacao(notificacao) {
    if (!(notificacao instanceof HTMLElement) || !notificacao.isConnected) return;
    escopoAplicacao.clearTimeout(estado.temporizadoresNotificacoes.get(notificacao));
    notificacao.classList.add("esta-saindo");
    const remover = () => {
      notificacao.remove();
      if (!elementos.regiaoNotificacoes?.querySelector(".notificacao-sistema")) {
        try { elementos.regiaoNotificacoes?.hidePopover?.(); } catch { /* já estava fechada */ }
      }
    };
    if (raizDocumento.dataset.movimentoReduzido === "true") remover();
    else escopoAplicacao.setTimeout(remover, 220);
  }

  function limitarNotificacoesVisiveis() {
    const limite = consultaJanelaCompacta.matches ? 1 : 4;
    [...(elementos.regiaoNotificacoes?.querySelectorAll(".notificacao-sistema") ?? [])]
      .slice(limite)
      .forEach(removerNotificacao);
  }

  function notificar(opcoes, mensagemAlternativa = "") {
    const regiao = elementos.regiaoNotificacoes;
    if (!regiao) return false;
    const configuracao = typeof opcoes === "string"
      ? { titulo: opcoes, mensagem: mensagemAlternativa }
      : (opcoes ?? {});
    const notificacao = documento.createElement("article");
    const conteudo = documento.createElement("div");
    const titulo = documento.createElement("strong");
    const mensagem = documento.createElement("p");
    const fechar = documento.createElement("button");

    notificacao.className = `notificacao-sistema notificacao--${normalizarIdentificador(configuracao.tipo, "informacao")}`;
    notificacao.setAttribute("role", configuracao.tipo === "erro" ? "alert" : "status");
    titulo.textContent = configuracao.titulo || "Horta Inteligente";
    mensagem.textContent = configuracao.mensagem || "";
    mensagem.hidden = !mensagem.textContent;
    fechar.type = "button";
    fechar.className = "botao-fechar-notificacao";
    fechar.setAttribute("aria-label", "Fechar notificação");
    fechar.textContent = "×";
    fechar.addEventListener("click", () => removerNotificacao(notificacao));
    conteudo.append(titulo, mensagem);
    notificacao.append(conteudo, fechar);
    regiao.prepend(notificacao);
    try {
      if (!regiao.matches(":popover-open")) regiao.showPopover?.();
    } catch {
      // Navegadores sem Popover continuam exibindo a região fixa normalmente.
    }

    // Em janelas compactas uma pilha de avisos cobriria o conteúdo principal.
    // O desktop conserva o histórico visual curto; telas menores mostram somente
    // o aviso mais recente, enquanto a região aria-live ainda anuncia cada ação.
    limitarNotificacoesVisiveis();
    escopoAplicacao.requestAnimationFrame(() => notificacao.classList.add("esta-visivel"));
    const duracao = Number(configuracao.duracao)
      || (configuracao.tipo === "erro" ? 6500 : 4400);
    const temporizador = escopoAplicacao.setTimeout(
      () => removerNotificacao(notificacao),
      duracao,
    );
    estado.temporizadoresNotificacoes.set(notificacao, temporizador);
    return true;
  }

  function formatarDataBiblioteca(valor) {
    if (!valor) return "Ainda não atualizada";
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? "Data indisponível" : formatadorDataCurta.format(data);
  }

  function atualizarResumoBiblioteca(biblioteca = {}) {
    estado.resumoBiblioteca = {
      disponivel: Boolean(biblioteca.disponivel),
      pasta: typeof biblioteca.pasta === "string" ? biblioteca.pasta : null,
      nomePasta: typeof biblioteca.nomePasta === "string" ? biblioteca.nomePasta : null,
      quantidade: Number.isFinite(Number(biblioteca.quantidade))
        ? Number(biblioteca.quantidade)
        : (Array.isArray(biblioteca.faixas) ? biblioteca.faixas.length : 0),
      ultimaAtualizacao: biblioteca.ultimaAtualizacao ?? null,
      erros: Number(biblioteca.erros) || 0,
    };

    if (elementos.caminhoBiblioteca) {
      elementos.caminhoBiblioteca.textContent = estado.resumoBiblioteca.pasta
        ?? "Nenhuma pasta selecionada";
      elementos.caminhoBiblioteca.title = estado.resumoBiblioteca.pasta ?? "";
    }
    if (elementos.quantidadeMusicas) {
      elementos.quantidadeMusicas.textContent = formatadorInteiro.format(
        estado.resumoBiblioteca.quantidade,
      );
    }
    if (elementos.dataBiblioteca) {
      elementos.dataBiblioteca.textContent = formatarDataBiblioteca(
        estado.resumoBiblioteca.ultimaAtualizacao,
      );
    }
    atualizarInformacoesSistema();
    // O canal `sistema:obter-informacoes` entrega somente pasta e quantidade.
    // Apenas uma resposta que realmente contém faixas pode substituir a biblioteca
    // do player; isso evita que um resumo assíncrono pare a música já restaurada.
    if (Array.isArray(biblioteca.faixas)) {
      emitirEvento("bibliotecaatualizada", { biblioteca });
    }
    return estado.resumoBiblioteca;
  }

  function atualizarProgressoBiblioteca(progresso = {}) {
    const fase = normalizarIdentificador(progresso.fase, "procurando");
    const rotulos = {
      procurando: "Procurando arquivos de áudio",
      lendo: "Lendo metadados",
      salvando: "Organizando biblioteca",
      concluido: "Biblioteca atualizada",
      erro: "Falha durante a leitura",
    };
    const processados = Number(progresso.processados) || 0;
    const total = Number(progresso.total) || 0;
    const complemento = total > 0 ? ` · ${processados} de ${total}` : "";
    const mensagem = progresso.mensagem || `${rotulos[fase] ?? "Atualizando biblioteca"}${complemento}`;
    documento.querySelectorAll("[data-progresso-biblioteca]").forEach((elemento) => {
      elemento.textContent = mensagem;
      elemento.dataset.fase = fase;
      if (elemento instanceof HTMLProgressElement) {
        elemento.max = Math.max(total, 1);
        elemento.value = Math.min(processados, Math.max(total, 1));
      }
    });
  }

  function definirBibliotecaOcupada(ocupada) {
    [elementos.botaoAlterarPasta, elementos.botaoReescanearBiblioteca].forEach((botao) => {
      if (!botao) return;
      botao.disabled = ocupada;
      botao.setAttribute("aria-busy", String(ocupada));
    });
    documento.querySelector("[data-area-biblioteca]")
      ?.setAttribute("aria-busy", String(ocupada));
  }

  async function executarOperacaoBiblioteca(tipoOperacao) {
    const biblioteca = escopoAplicacao.ponteHorta?.biblioteca;
    const metodo = tipoOperacao === "escolher" ? "escolherPasta" : "reescanear";
    if (!biblioteca || typeof biblioteca[metodo] !== "function") {
      notificar({
        titulo: "Biblioteca indisponível",
        mensagem: "Abra este projeto pelo aplicativo Electron para acessar pastas locais.",
        tipo: "atencao",
      });
      return false;
    }

    definirBibliotecaOcupada(true);
    try {
      const resultado = await biblioteca[metodo]();
      if (!resultado) throw new Error("A biblioteca não retornou informações.");
      atualizarResumoBiblioteca(resultado);
      if (resultado.cancelado) return false;

      if (!resultado.disponivel && !resultado.pasta) {
        notificar({
          titulo: "Escolha uma pasta de músicas",
          mensagem: "A biblioteca ainda não possui uma pasta para reescanear.",
          tipo: "atencao",
        });
        return false;
      }

      if (resultado.pasta) {
        await alterarConfiguracao("estacao.pastaBiblioteca", resultado.pasta);
      }
      notificar({
        titulo: tipoOperacao === "escolher" ? "Biblioteca conectada" : "Biblioteca atualizada",
        mensagem: `${formatadorInteiro.format(resultado.quantidade ?? 0)} músicas encontradas.`,
        tipo: "sucesso",
      });
      return true;
    } catch (erro) {
      console.error("Não foi possível atualizar a biblioteca musical.", erro);
      notificar({
        titulo: "Não foi possível ler a pasta",
        mensagem: "Os arquivos originais não foram alterados. Escolha outra pasta ou tente novamente.",
        tipo: "erro",
      });
      return false;
    } finally {
      definirBibliotecaOcupada(false);
    }
  }

  async function executarAcaoSistema(acao) {
    if (acao !== "abrir-pasta-dados") return;
    try {
      await escopoAplicacao.ponteHorta?.sistema?.abrirPastaDados?.();
    } catch (erro) {
      console.error("Não foi possível abrir a pasta de dados.", erro);
      notificar({ titulo: "Pasta indisponível", mensagem: "Tente novamente pelo aplicativo Electron.", tipo: "erro" });
    }
  }

  function descreverTempoExecucao() {
    const minutosTotais = Math.floor((Date.now() - instanteInicial) / 60000);
    if (minutosTotais < 1) return "Menos de 1 minuto";
    const horas = Math.floor(minutosTotais / 60);
    const minutos = minutosTotais % 60;
    if (horas === 0) return `${minutos} min`;
    return minutos > 0 ? `${horas} h ${minutos} min` : `${horas} h`;
  }

  function obterValorInformacaoSistema(chaveRecebida) {
    const chave = normalizarIdentificador(chaveRecebida);
    const dados = estado.dadosHorta ?? {};
    const conexao = dados.estadoArduino?.conexao ?? dados.estadoArduino ?? "Aguardando";
    const fonte = String(dados.fonteDados ?? "");
    const ultimaLeitura = dados.ultimaAtualizacao ? new Date(dados.ultimaAtualizacao) : null;
    switch (chave) {
      case "versao":
      case "versao-software":
        return estado.informacoesAplicacao.versao
          ?? obterEspacoHorta().versaoSoftware
          ?? raizDocumento.dataset.versaoAplicacao
          ?? "Desenvolvimento";
      case "modo":
      case "modo-atual":
      case "fonte":
      case "fonte-dados":
        return fonte.toLocaleLowerCase("pt-BR").includes("simul") ? "Simulação" : (fonte || "Local");
      case "estado-arduino":
      case "arduino":
        return String(conexao);
      case "biblioteca":
      case "biblioteca-musical":
        return estado.resumoBiblioteca.nomePasta
          ?? (estado.resumoBiblioteca.pasta ? "Pasta conectada" : "Não configurada");
      case "quantidade-musicas":
      case "musicas":
        return formatadorInteiro.format(estado.resumoBiblioteca.quantidade);
      case "ultima-leitura":
        return ultimaLeitura && !Number.isNaN(ultimaLeitura.getTime())
          ? formatadorDataCurta.format(ultimaLeitura)
          : "Aguardando dados";
      case "tempo-execucao":
        return descreverTempoExecucao();
      case "pagina":
      case "pagina-atual":
        return estado.paginaAtiva === "estacao" ? "Estação" : "Painel";
      case "tema":
        return ({
          cultivo: "Cultivo",
          escuro: "Escuro",
          claro: "Claro",
        })[raizDocumento.dataset.modoCor] ?? "Sistema";
      case "leituras-sessao":
        return formatadorInteiro.format(estado.leiturasSessao);
      case "faixas-sessao":
        return formatadorInteiro.format(estado.faixasSessao);
      default:
        return estado.informacoesAplicacao[chaveRecebida] ?? "--";
    }
  }

  function atualizarInformacoesSistema() {
    documento.querySelectorAll("[data-informacao-sistema]").forEach((elemento) => {
      elemento.textContent = obterValorInformacaoSistema(elemento.dataset.informacaoSistema);
    });
  }

  async function carregarInformacoesAplicacao() {
    const obterInformacoes = escopoAplicacao.ponteHorta?.sistema?.obterInformacoes;
    if (typeof obterInformacoes !== "function") return;
    try {
      estado.informacoesAplicacao = await obterInformacoes() ?? {};
      if (estado.informacoesAplicacao.versao) {
        raizDocumento.dataset.versaoAplicacao = estado.informacoesAplicacao.versao;
      }
      if (estado.informacoesAplicacao.biblioteca) {
        atualizarResumoBiblioteca(estado.informacoesAplicacao.biblioteca);
      }
      atualizarInformacoesSistema();
    } catch (erro) {
      console.warn("As informações internas do aplicativo não puderam ser carregadas.", erro);
    }
  }

  async function carregarBibliotecaInicial() {
    const biblioteca = escopoAplicacao.ponteHorta?.biblioteca;
    if (!biblioteca) return;
    if (typeof biblioteca.aoProgresso === "function") {
      estado.remocaoProgressoBiblioteca?.();
      estado.remocaoProgressoBiblioteca = biblioteca.aoProgresso(atualizarProgressoBiblioteca);
    }
    if (typeof biblioteca.obter !== "function") return;
    try {
      atualizarResumoBiblioteca(await biblioteca.obter());
    } catch (erro) {
      console.warn("A biblioteca musical ainda não está disponível.", erro);
    }
  }

  async function conectarConfiguracoes() {
    const gerenciador = obterGerenciadorConfiguracoes();
    if (!gerenciador) {
      aplicarConfiguracoesVisuais();
      sincronizarControlesConfiguracoes();
      return;
    }
    try {
      await gerenciador.pronto;
      estado.remocaoAssinaturaConfiguracoes?.();
      if (typeof gerenciador.assinar === "function") {
        estado.remocaoAssinaturaConfiguracoes = gerenciador.assinar("", () => {
          sincronizarControlesConfiguracoes();
          aplicarConfiguracoesVisuais();
        });
      } else {
        sincronizarControlesConfiguracoes();
        aplicarConfiguracoesVisuais();
      }
    } catch (erro) {
      console.error("Não foi possível conectar a Central de Configurações.", erro);
      aplicarConfiguracoesVisuais();
    }
  }

  function configurarPersistenciaEncerramento() {
    const sistema = escopoAplicacao.ponteHorta?.sistema;
    if (typeof sistema?.aoSolicitarEncerramento !== "function") return;
    estado.remocaoSolicitacaoEncerramento?.();
    estado.remocaoSolicitacaoEncerramento = sistema.aoSolicitarEncerramento(async () => {
      if (estado.encerramentoEmAndamento) return;
      estado.encerramentoEmAndamento = true;
      try {
        await obterEspacoHorta().estacao?.persistirSessao?.();
        await obterGerenciadorConfiguracoes()?.salvarAgora?.();
      } catch (erro) {
        console.warn("A sessão não pôde ser totalmente persistida antes de sair.", erro);
      } finally {
        // O processo principal também possui um timeout de segurança; portanto,
        // uma falha aqui nunca deixa o CaseMod preso ao tentar encerrar.
        try { await sistema.confirmarEncerramento?.(); } catch { /* janela encerrada */ }
      }
    });
  }

  function tratarCliqueDocumento(evento) {
    const botaoPagina = evento.target.closest?.("[data-abrir-pagina]");
    if (botaoPagina) {
      navegar(botaoPagina.dataset.abrirPagina, { focar: evento.detail === 0 });
      return;
    }

    const botaoAbrirConfiguracoes = evento.target.closest?.("[data-abrir-configuracoes]");
    if (botaoAbrirConfiguracoes) {
      abrirConfiguracoes(
        botaoAbrirConfiguracoes.dataset.categoriaInicial,
        botaoAbrirConfiguracoes,
      );
      return;
    }
    if (evento.target.closest?.("[data-fechar-configuracoes]")) {
      fecharConfiguracoes();
      return;
    }
    const botaoRedefinir = evento.target.closest?.("[data-redefinir-ajustes]");
    if (botaoRedefinir) {
      abrirConfirmacaoRedefinir(botaoRedefinir);
      return;
    }
    if (evento.target.closest?.("[data-cancelar-redefinicao]")) {
      fecharConfirmacaoRedefinir();
      return;
    }
    if (evento.target.closest?.("[data-confirmar-redefinicao]")) {
      void confirmarRedefinicao();
      return;
    }

    const categoria = evento.target.closest?.("[data-categoria-configuracao]");
    if (categoria) {
      if (elementos.buscaConfiguracoes) elementos.buscaConfiguracoes.value = "";
      filtrarConfiguracoes("");
      ativarCategoriaConfiguracoes(categoria.dataset.categoriaConfiguracao);
      return;
    }

    const perfilSistema = evento.target.closest?.("[data-perfil-sistema]");
    if (perfilSistema) {
      aplicarPerfil("sistema", perfilSistema.dataset.perfilSistema, perfilSistema);
      return;
    }
    const perfilAudio = evento.target.closest?.("[data-perfil-audio]");
    if (perfilAudio) {
      aplicarPerfil("audio", perfilAudio.dataset.perfilAudio, perfilAudio);
      return;
    }

    const acaoConfiguracao = evento.target.closest?.("[data-acao-configuracao]");
    if (acaoConfiguracao) {
      executarAcaoConfiguracao(acaoConfiguracao.dataset.acaoConfiguracao);
      return;
    }

    const controleBotao = evento.target.closest?.("button[data-configuracao]");
    if (controleBotao) {
      registrarValorControle(controleBotao);
      return;
    }

    if (evento.target.closest?.("#botao-alterar-pasta")) {
      executarOperacaoBiblioteca("escolher");
      return;
    }
    if (evento.target.closest?.("#botao-reescanear-biblioteca")) {
      executarOperacaoBiblioteca("reescanear");
      return;
    }

    const acaoSistema = evento.target.closest?.("[data-acao-sistema]");
    if (acaoSistema) {
      executarAcaoSistema(acaoSistema.dataset.acaoSistema);
      return;
    }

    const comando = evento.target.closest?.("[data-comando]");
    if (comando && elementos.paletaComandos?.contains(comando)) {
      executarComando(comando.dataset.comando);
    }
  }

  function tratarEntradaDocumento(evento) {
    const controle = evento.target.closest?.("[data-configuracao]");
    if (!controle) return;
    const respondeImediatamente = controle instanceof HTMLInputElement
      && ["range", "color"].includes(controle.type);
    if (evento.type === "change" || respondeImediatamente) registrarValorControle(controle);
  }

  function tratarTecladoGlobal(evento) {
    const ambienteEstavaAtivo = estado.modoAmbienteAtivo;
    registrarAtividadeUsuario(evento);
    // Como em um protetor de tela, a primeira tecla apenas devolve a interface;
    // ela não deve também executar um atalho que o usuário não estava vendo.
    if (ambienteEstavaAtivo) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      return;
    }
    if (evento.key.toLocaleLowerCase("pt-BR") === "k" && evento.ctrlKey && !evento.altKey) {
      evento.preventDefault();
      if (elementos.paletaComandos?.open) fecharPaletaComandos();
      else abrirPaletaComandos(documento.activeElement);
      return;
    }
    if (evento.key !== "Escape") return;
    if (elementos.paletaComandos?.open) {
      evento.preventDefault();
      fecharPaletaComandos();
    } else if (elementos.centralConfiguracoes?.open) {
      evento.preventDefault();
      fecharConfiguracoes();
    } else if (estado.modoAmbienteAtivo) {
      evento.preventDefault();
      sairModoAmbiente();
    }
  }

  function configurarEventosDialogos() {
    elementos.centralConfiguracoes?.addEventListener("close", concluirFechamentoConfiguracoes);
    elementos.centralConfiguracoes?.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      fecharConfiguracoes();
    });
    elementos.centralConfiguracoes?.addEventListener("click", (evento) => {
      if (evento.target === elementos.centralConfiguracoes) fecharConfiguracoes();
    });
    elementos.paletaComandos?.addEventListener("close", concluirFechamentoPaleta);
    elementos.paletaComandos?.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      fecharPaletaComandos();
    });
    elementos.paletaComandos?.addEventListener("click", (evento) => {
      if (evento.target === elementos.paletaComandos) fecharPaletaComandos();
    });
    elementos.confirmacaoRedefinir?.addEventListener(
      "close",
      concluirFechamentoConfirmacao,
    );
    elementos.confirmacaoRedefinir?.addEventListener("cancel", (evento) => {
      evento.preventDefault();
      fecharConfirmacaoRedefinir();
    });
    elementos.confirmacaoRedefinir?.addEventListener("click", (evento) => {
      if (evento.target === elementos.confirmacaoRedefinir) fecharConfirmacaoRedefinir();
    });
  }

  function configurarEventosCategorias() {
    elementos.categoriasConfiguracoes.forEach((categoria, indice) => {
      categoria.addEventListener("keydown", (evento) => {
        const teclas = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"];
        if (!teclas.includes(evento.key)) return;
        evento.preventDefault();
        let proximoIndice = indice;
        if (["ArrowUp", "ArrowLeft"].includes(evento.key)) proximoIndice = indice - 1;
        if (["ArrowDown", "ArrowRight"].includes(evento.key)) proximoIndice = indice + 1;
        if (evento.key === "Home") proximoIndice = 0;
        if (evento.key === "End") proximoIndice = elementos.categoriasConfiguracoes.length - 1;
        proximoIndice = (proximoIndice + elementos.categoriasConfiguracoes.length)
          % elementos.categoriasConfiguracoes.length;
        const proxima = elementos.categoriasConfiguracoes[proximoIndice];
        ativarCategoriaConfiguracoes(proxima.dataset.categoriaConfiguracao, true);
      });
    });
  }

  function configurarEventosPaleta() {
    elementos.buscaComandos?.addEventListener("input", (evento) => {
      filtrarComandos(evento.target.value);
    });
    elementos.paletaComandos?.addEventListener("keydown", (evento) => {
      const comandos = obterComandosVisiveis();
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        selecionarComando(estado.indiceComandoAtivo + 1);
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        selecionarComando(estado.indiceComandoAtivo - 1);
      } else if (evento.key === "Enter" && comandos[estado.indiceComandoAtivo]) {
        evento.preventDefault();
        executarComando(comandos[estado.indiceComandoAtivo].dataset.comando);
      }
    });
  }

  function configurarEventosGlobais() {
    documento.addEventListener("click", tratarCliqueDocumento);
    documento.addEventListener("input", tratarEntradaDocumento);
    documento.addEventListener("change", tratarEntradaDocumento);
    documento.addEventListener("keydown", tratarTecladoGlobal, true);
    elementos.buscaConfiguracoes?.addEventListener("input", (evento) => {
      filtrarConfiguracoes(evento.target.value);
    });
    ["pointerdown", "wheel", "touchstart"].forEach((nomeEvento) => {
      documento.addEventListener(nomeEvento, registrarAtividadeUsuario, { passive: true });
    });
    documento.addEventListener("pointermove", registrarAtividadeUsuario, { passive: true });
    documento.addEventListener("dadoshortaatualizados", (evento) => {
      const dados = evento.detail?.dadosHorta ?? evento.detail;
      const identificador = dados?.numeroLeitura ?? dados?.ultimaAtualizacao;
      if (identificador == null || identificador !== estado.ultimaLeituraContada) {
        estado.ultimaLeituraContada = identificador;
        estado.leiturasSessao += 1;
      }
      atualizarModoAmbiente(dados);
    });
    documento.addEventListener("faixatocada", () => {
      estado.faixasSessao += 1;
      atualizarInformacoesSistema();
    });
    documento.addEventListener("estadomusicaatualizado", (evento) => {
      atualizarDadosAmbiente("musica", evento.detail?.titulo ?? "Estação em repouso");
      atualizarDadosAmbiente("artista", evento.detail?.artista ?? "Nenhuma música tocando");
    });
    documento.addEventListener("configuracoesprontas", conectarConfiguracoes);
    documento.addEventListener("visibilitychange", () => {
      if (documento.hidden) sairModoAmbiente({ restaurarFoco: false });
      else agendarModoAmbiente();
    });
    consultaTemaEscuro.addEventListener?.("change", aplicarConfiguracoesVisuais);
    consultaMovimentoReduzido.addEventListener?.("change", aplicarConfiguracoesVisuais);
    consultaJanelaCompacta.addEventListener?.("change", limitarNotificacoesVisiveis);
    escopoAplicacao.addEventListener("pagehide", () => {
      escopoAplicacao.clearTimeout(estado.temporizadorModoAmbiente);
      escopoAplicacao.clearTimeout(estado.temporizadorTema);
      escopoAplicacao.clearInterval(estado.relogioModoAmbiente);
      escopoAplicacao.clearInterval(estado.intervaloInformacoesSistema);
      estado.remocaoProgressoBiblioteca?.();
      estado.remocaoAssinaturaConfiguracoes?.();
      estado.remocaoSolicitacaoEncerramento?.();
    }, { once: true });
  }

  function iniciar() {
    if (estado.iniciado) return;
    estado.iniciado = true;
    coletarElementos();
    criarComandosPadraoSeNecessario();
    configurarEventosDialogos();
    configurarEventosCategorias();
    configurarEventosPaleta();
    configurarEventosGlobais();
    configurarPersistenciaEncerramento();

    const paginaInicial = corpoDocumento.dataset.paginaAtiva
      ?? elementos.paginas.find((pagina) => !pagina.hidden)?.dataset.pagina
      ?? "dashboard";
    navegar(paginaInicial, { emitir: false, focar: false, rolar: false });
    ativarCategoriaConfiguracoes(estado.categoriaConfiguracoesAtiva);
    conectarConfiguracoes();
    carregarInformacoesAplicacao();
    carregarBibliotecaInicial();
    atualizarInformacoesSistema();
    estado.intervaloInformacoesSistema = escopoAplicacao.setInterval(() => {
      aplicarConfiguracoesVisuais();
      atualizarInformacoesSistema();
    }, 60000);
    agendarModoAmbiente();
  }

  const hortaInteligente = obterEspacoHorta();
  hortaInteligente.interfaceSistema = Object.freeze({
    navegar,
    abrirConfiguracoes,
    notificar,
    atualizarResumoBiblioteca,
    entrarModoAmbiente,
    sairModoAmbiente,
    atualizarModoAmbiente,
    fecharDialogoComTransicao,
  });
  escopoAplicacao.HortaInteligente = hortaInteligente;

  if (documento.readyState === "loading") {
    documento.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})(window);
