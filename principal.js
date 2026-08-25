/*
 * Mantém as variáveis deste arquivo isoladas e publica apenas a função que
 * recebe dados da horta. Assim, os scripts também funcionam ao abrir o HTML
 * diretamente, sem exigir um servidor ou uma etapa de compilação.
 */
(function iniciarAplicacao(escopoAplicacao) {
"use strict";

const formatadorInteiro = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const formatadorDecimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const formatadorHorario = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const formatadorHoraMinuto = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

// Centraliza as referências do HTML para deixar as funções de atualização menores.
const elementos = {
  gradePainel: document.querySelector(".grade-painel"),
  carimboAtualizacao: document.querySelector(".carimbo-atualizacao"),
  estadoCabecalho: document.querySelector("#estado-cabecalho"),
  textoEstadoCabecalho: document.querySelector("#texto-estado-cabecalho"),
  estadoGeralCompacto: document.querySelector("#estado-geral-compacto"),
  textoEstadoGeralCompacto: document.querySelector("#texto-estado-geral-compacto"),
  seloFonteDados: document.querySelector("#selo-fonte-dados"),
  siglaFonteDados: document.querySelector("#sigla-fonte-dados"),
  nomeFonteDados: document.querySelector("#nome-fonte-dados"),
  botaoPausar: document.querySelector("#botao-pausar"),
  textoBotaoPausar: document.querySelector("#texto-botao-pausar"),
  resumoPainel: document.querySelector("#resumo-painel"),
  tempoRelativo: document.querySelector("#tempo-relativo"),
  avisoSistema: document.querySelector("#aviso-sistema"),
  textoAvisoSistema: document.querySelector("#texto-aviso-sistema"),
  medidorUmidade: document.querySelector("#medidor-umidade"),
  circuloMedidor: document.querySelector("#medidor-umidade .circulo-medidor"),
  cartaoUmidade: document.querySelector(".cartao-umidade"),
  valorUmidade: document.querySelector("#valor-umidade"),
  etiquetaUmidade: document.querySelector("#etiqueta-umidade"),
  textoEtiquetaUmidade: document.querySelector("#texto-etiqueta-umidade"),
  chamadaUmidade: document.querySelector("#chamada-umidade"),
  explicacaoUmidade: document.querySelector("#explicacao-umidade"),
  valorBrutoSensor: document.querySelector("#valor-bruto-sensor"),
  faixaConfortoUmidade: document.querySelector("#faixa-conforto-umidade"),
  marcadorUmidade: document.querySelector("#marcador-umidade"),
  atuadorBomba: document.querySelector("#atuador-bomba"),
  estadoBomba: document.querySelector("#estado-bomba"),
  descricaoBomba: document.querySelector("#descricao-bomba"),
  atuadorIluminacao: document.querySelector("#atuador-iluminacao"),
  estadoIluminacao: document.querySelector("#estado-iluminacao"),
  descricaoIluminacao: document.querySelector("#descricao-iluminacao"),
  cartaoAutomacao: document.querySelector(".cartao-automacao"),
  horarioInicioIluminacao: document.querySelector("#horario-inicio-iluminacao"),
  horarioFimIluminacao: document.querySelector("#horario-fim-iluminacao"),
  proximaAcaoIluminacao: document.querySelector("#proxima-acao-iluminacao"),
  barraCicloIluminacao: document.querySelector("#barra-ciclo-iluminacao"),
  preenchimentoCicloIluminacao: document.querySelector("#preenchimento-ciclo-iluminacao"),
  estadoCicloIluminacao: document.querySelector("#estado-ciclo-iluminacao"),
  leituraCicloIluminacao: document.querySelector("#leitura-ciclo-iluminacao"),
  horarioRtcIluminacao: document.querySelector("#horario-rtc-iluminacao"),
  legendaInicioIluminacao: document.querySelector("#legenda-inicio-iluminacao"),
  legendaFimIluminacao: document.querySelector("#legenda-fim-iluminacao"),
  cartaoCicloIluminacao: document.querySelector("#cartao-ciclo-iluminacao"),
  cartaoArduino: document.querySelector("#cartao-arduino"),
  estadoArduino: document.querySelector("#estado-arduino"),
  portaArduino: document.querySelector("#porta-arduino"),
  transmissaoArduino: document.querySelector("#transmissao-arduino"),
  horarioAtualizacao: document.querySelector("#horario-atualizacao"),
  dataAtualizacao: document.querySelector("#data-atualizacao"),
  numeroLeitura: document.querySelector("#numero-leitura"),
  intervaloLeitura: document.querySelector("#intervalo-leitura"),
  cartaoHistorico: document.querySelector(".cartao-historico"),
  graficoUmidade: document.querySelector("#grafico-umidade"),
  areaHistorico: document.querySelector("#area-historico"),
  linhaHistorico: document.querySelector("#linha-historico"),
  pontoHistorico: document.querySelector("#ponto-historico"),
  linhaCursorHistorico: document.querySelector("#linha-cursor-historico"),
  pontoCursorHistorico: document.querySelector("#ponto-cursor-historico"),
  balaoGrafico: document.querySelector("#balao-grafico"),
  horarioBalaoGrafico: document.querySelector("#horario-balao-grafico"),
  valorBalaoGrafico: document.querySelector("#valor-balao-grafico"),
  anuncioGrafico: document.querySelector("#anuncio-grafico"),
  variacaoUmidade: document.querySelector("#variacao-umidade"),
  fluxoDados: document.querySelector("#fluxo-dados"),
  nomeFonteFluxo: document.querySelector("#nome-fonte-fluxo"),
  notaFonteDados: document.querySelector("#nota-fonte-dados"),
  textoFonteRodape: document.querySelector("#texto-fonte-rodape"),
  abasCartao: [...document.querySelectorAll(".abas-cartao [role='tab']")],
  listaAtividades: document.querySelector("#lista-atividades"),
  anuncioAtividade: document.querySelector("#anuncio-atividade"),
  botoesDetalhes: [...document.querySelectorAll("[data-abrir-detalhes]")],
  painelDetalhes: document.querySelector("#painel-detalhes"),
  botaoFecharDetalhes: document.querySelector("#botao-fechar-detalhes"),
  rotuloPainelDetalhes: document.querySelector("#rotulo-painel-detalhes"),
  tituloPainelDetalhes: document.querySelector("#titulo-painel-detalhes"),
  estadoPainelDetalhes: document.querySelector("#estado-painel-detalhes"),
  valorPainelDetalhes: document.querySelector("#valor-painel-detalhes"),
  unidadePainelDetalhes: document.querySelector("#unidade-painel-detalhes"),
  descricaoPainelDetalhes: document.querySelector("#descricao-painel-detalhes"),
  rotulosMetricasDetalhes: [
    document.querySelector("#rotulo-metrica-um"),
    document.querySelector("#rotulo-metrica-dois"),
    document.querySelector("#rotulo-metrica-tres"),
  ],
  valoresMetricasDetalhes: [
    document.querySelector("#valor-metrica-um"),
    document.querySelector("#valor-metrica-dois"),
    document.querySelector("#valor-metrica-tres"),
  ],
  tituloLeituraRecente: document.querySelector("#titulo-leitura-recente"),
  resumoLeituraDetalhes: document.querySelector("#resumo-leitura-detalhes"),
  visualLeituraDetalhes: document.querySelector("#visual-leitura-detalhes"),
};

const ESTADOS_CONEXAO_VALIDOS = new Set(["conectado", "conectando", "desconectado", "erro"]);
const LIMITE_HISTORICO = 24;
const LIMITE_EVENTOS = 8;
const prefereMovimentoReduzido = window.matchMedia("(prefers-reduced-motion: reduce)");

let dadosAtuais = null;
let historicoUmidade = [];
let historicoHorarios = [];
let historicoRegularidade = [];
let pontosHistoricoAtuais = [];
let fontePausada = false;
let avisoAtual = "";

// O relógio do computador é a referência para conexão e watchdog. O horário
// enviado no pacote permanece disponível apenas como horário da medição.
const estadoComunicacao = {
  primeiroPacoteValidoRecebido: false,
  ultimoPacoteRecebidoEm: null,
  intervaloUltimaRecepcao: null,
  estadoTransporte: "aguardando",
  chaveUltimoPacote: null,
  desatualizada: false,
};

// Reúne apenas estado de interação. Nenhum item conhece ou chama o simulador.
const estadoInteratividade = {
  eventosRecentes: [],
  sequenciaEvento: 0,
  detalheAberto: null,
  botaoDetalheOrigem: null,
  indiceGraficoSelecionado: null,
  coordenadaPonteiroGrafico: null,
  quadroPonteiroGrafico: null,
  leituraPendente: null,
  quadroLeituraPendente: null,
  temporizadorNovaLeitura: null,
  iniciada: false,
};

/**
 * Publica ações e mudanças de estado em um barramento neutro. O gerenciador de
 * som pode reagir a esses eventos sem a interface conhecer Web Audio e sem os
 * componentes visuais dependerem do simulador ou da futura comunicação Serial.
 */
function emitirEventoInterface(tipo, detalhes = {}) {
  document.dispatchEvent(
    new CustomEvent("eventohorta", {
      detail: { tipo, ...detalhes },
    }),
  );
}

function limitarValor(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function converterNumero(valor) {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string" || valor.trim() === "") return null;

  const numero = Number(valor.trim());
  return Number.isFinite(numero) ? numero : null;
}

function normalizarBooleano(valor) {
  if (typeof valor === "boolean") return valor;
  if (valor === 1) return true;
  if (valor === 0) return false;

  const texto = typeof valor === "string" ? valor.trim().toLowerCase() : "";
  if (["1", "true", "on", "ligado", "ligada"].includes(texto)) return true;
  if (["0", "false", "off", "desligado", "desligada"].includes(texto)) return false;
  return null;
}

function normalizarPercentual(valor) {
  const numero = converterNumero(valor);
  return numero === null ? null : limitarValor(numero, 0, 100);
}

function obterConfiguracao(caminho, valorPadrao) {
  return escopoAplicacao.HortaInteligente?.configuracoes?.obter?.(caminho, valorPadrao)
    ?? valorPadrao;
}

function normalizarHorarioTexto(valor, padrao = null, incluirSegundos = false) {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return formatadorHorario.format(valor);
  }

  const texto = String(valor ?? "").trim();
  const expressao = incluirSegundos
    ? /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/
    : /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  if (!expressao.test(texto)) return padrao;
  return incluirSegundos && texto.length === 5 ? `${texto}:00` : texto;
}

function normalizarAmostraHistorico(valor) {
  const numero = converterNumero(valor);
  return numero !== null && numero >= 0 && numero <= 100 ? numero : null;
}

function normalizarData(valor) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function normalizarEstadoArduino(estadoRecebido) {
  const estado = typeof estadoRecebido === "object" && estadoRecebido !== null
    ? estadoRecebido
    : { conexao: estadoRecebido };
  const conexao = ESTADOS_CONEXAO_VALIDOS.has(estado.conexao)
    ? estado.conexao
    : "desconectado";

  return {
    conexao,
    porta: typeof estado.porta === "string" && estado.porta.trim() ? estado.porta.trim() : "Não informada",
    recebendoDados: normalizarBooleano(estado.recebendoDados) ?? false,
  };
}

/**
 * Converte e limita os valores antes de desenhá-los. Essa camada evita que um
 * pacote incompleto, `NaN` ou um valor fora da faixa quebre a interface quando
 * os dados passarem a vir da porta Serial.
 */
function normalizarDadosHorta(dadosRecebidos) {
  const dados = dadosRecebidos && typeof dadosRecebidos === "object" ? dadosRecebidos : {};
  const historicoRecebido = Array.isArray(dados.historicoUmidade)
    ? dados.historicoUmidade
        .map(normalizarAmostraHistorico)
        .filter((valor) => valor !== null)
        .slice(-LIMITE_HISTORICO)
    : [];

  return {
    umidadeSolo: normalizarPercentual(dados.umidadeSolo),
    valorBrutoSensor: converterNumero(dados.valorBrutoSensor),
    bombaLigada: normalizarBooleano(dados.bombaLigada),
    iluminacaoLigada: normalizarBooleano(dados.iluminacaoLigada),
    horarioRtc: normalizarHorarioTexto(dados.horarioRtc, null, true),
    horarioIluminacaoInicio: normalizarHorarioTexto(
      dados.horarioIluminacaoInicio,
      obterConfiguracao("horta.horarioIluminacaoInicio", "08:00"),
    ),
    horarioIluminacaoFim: normalizarHorarioTexto(
      dados.horarioIluminacaoFim,
      obterConfiguracao("horta.horarioIluminacaoFim", "20:00"),
    ),
    estadoArduino: normalizarEstadoArduino(dados.estadoArduino),
    ultimaAtualizacao: normalizarData(dados.ultimaAtualizacao),
    numeroLeitura: converterNumero(dados.numeroLeitura),
    intervaloAtualizacao: converterNumero(dados.intervaloAtualizacao),
    fonteDados: typeof dados.fonteDados === "string" ? dados.fonteDados : "desconhecida",
    historicoUmidade: historicoRecebido,
  };
}

/**
 * Confere o contrato mínimo do pacote antes de qualquer normalização. Isso é
 * importante porque limitar automaticamente um valor inválido (por exemplo,
 * transformar 180% em 100%) não pode ser confundido com uma leitura real.
 *
 * A futura leitura Serial deverá transformar uma mensagem completa como
 * `UMIDADE:63;BRUTO:412;BOMBA:OFF;GROW_LIGHT:ON;RTC:16:46:20;CICLO_INICIO:08:00;CICLO_FIM:20:00`
 * neste mesmo objeto antes de chegar aqui. Porta, sequência, intervalo e nome
 * da fonte são metadados acrescentados pelo módulo Serial no computador.
 */
function leituraDaHortaValida(dadosRecebidos) {
  if (!dadosRecebidos || typeof dadosRecebidos !== "object" || Array.isArray(dadosRecebidos)) {
    return false;
  }

  const umidadeSolo = converterNumero(dadosRecebidos.umidadeSolo);
  const valorBrutoSensor = converterNumero(dadosRecebidos.valorBrutoSensor);
  const bombaLigada = normalizarBooleano(dadosRecebidos.bombaLigada);
  const iluminacaoLigada = normalizarBooleano(dadosRecebidos.iluminacaoLigada);
  const horarioRtc = normalizarHorarioTexto(dadosRecebidos.horarioRtc, null, true);
  const horarioIluminacaoInicio = normalizarHorarioTexto(dadosRecebidos.horarioIluminacaoInicio);
  const horarioIluminacaoFim = normalizarHorarioTexto(dadosRecebidos.horarioIluminacaoFim);
  const numeroLeitura = converterNumero(dadosRecebidos.numeroLeitura);
  const intervaloAtualizacao = converterNumero(dadosRecebidos.intervaloAtualizacao);
  const estadoArduino = dadosRecebidos.estadoArduino;
  const portaInformada = Boolean(estadoArduino
    && typeof estadoArduino === "object"
    && typeof estadoArduino.porta === "string"
    && estadoArduino.porta.trim() !== "");
  const fonteInformada = typeof dadosRecebidos.fonteDados === "string"
    && dadosRecebidos.fonteDados.trim() !== "";

  return umidadeSolo !== null
    && umidadeSolo >= 0
    && umidadeSolo <= 100
    && valorBrutoSensor !== null
    && valorBrutoSensor >= 0
    && valorBrutoSensor <= 1023
    && Number.isInteger(valorBrutoSensor)
    && bombaLigada !== null
    && iluminacaoLigada !== null
    && horarioRtc !== null
    && horarioIluminacaoInicio !== null
    && horarioIluminacaoFim !== null
    && portaInformada
    && numeroLeitura !== null
    && Number.isInteger(numeroLeitura)
    && numeroLeitura >= 0
    && intervaloAtualizacao !== null
    && intervaloAtualizacao > 0
    && fonteInformada;
}

// Uma mensagem válida comprova a conexão, mesmo que a fonte ainda não tenha
// enviado metadados como nome da porta ou horário da leitura.
function prepararLeituraConfirmada(dadosRecebidos, horarioRecebimento = new Date()) {
  const estadoRecebido = dadosRecebidos.estadoArduino;
  const detalhesArduino = estadoRecebido && typeof estadoRecebido === "object"
    ? estadoRecebido
    : {};

  return {
    ...dadosRecebidos,
    ultimaAtualizacao: normalizarData(dadosRecebidos.ultimaAtualizacao) ?? horarioRecebimento,
    estadoArduino: {
      ...detalhesArduino,
      conexao: "conectado",
      recebendoDados: true,
    },
  };
}

function atualizarTextoAnimado(elemento, novoTexto, valorNumerico = null) {
  if (!elemento) return;

  const valorAnterior = converterNumero(elemento.dataset.valorNumerico);
  if (valorNumerico === null) {
    delete elemento.dataset.valorNumerico;
    delete elemento.dataset.direcao;
  } else {
    elemento.dataset.valorNumerico = String(valorNumerico);

    if (valorAnterior !== null && valorNumerico !== valorAnterior) {
      elemento.dataset.direcao = valorNumerico > valorAnterior ? "subindo" : "descendo";
    }
  }

  if (elemento.textContent === novoTexto) return;

  elemento.textContent = novoTexto;
  elemento.classList.remove("valor-atualizado");

  // A informação continua mudando instantaneamente quando o usuário prefere
  // movimento reduzido; somente a confirmação animada é dispensada.
  if (!prefereMovimentoReduzido.matches) {
    window.requestAnimationFrame(() => elemento.classList.add("valor-atualizado"));
  }
}

function atualizarTextoSeMudou(elemento, novoTexto) {
  if (elemento && elemento.textContent !== novoTexto) elemento.textContent = novoTexto;
}

function classificarUmidade(umidadeSolo) {
  const limiteMinimo = limitarValor(
    converterNumero(obterConfiguracao("horta.limiteUmidadeMinima", 45)) ?? 45,
    5,
    95,
  );
  const limiteMaximoConfigurado = converterNumero(
    obterConfiguracao("horta.limiteUmidadeMaxima", 72),
  ) ?? 72;
  const limiteMaximo = limitarValor(Math.max(limiteMaximoConfigurado, limiteMinimo + 1), 6, 100);
  const limiteCritico = Math.max(8, limiteMinimo - 25);
  const limiteExcesso = Math.min(100, limiteMaximo + 14);

  if (umidadeSolo === null) {
    return {
      nivel: "indisponivel",
      etiqueta: "Sem leitura",
      chamada: "Dados do solo indisponíveis",
      explicacao: "A interface aguarda um valor válido da fonte de dados antes de avaliar o cultivo.",
    };
  }

  if (umidadeSolo < limiteCritico) {
    return {
      nivel: "critico",
      etiqueta: "Nível crítico",
      chamada: "O solo precisa de água agora",
      explicacao: "A umidade está muito baixa. A irrigação automática deve entrar em ação para proteger o cultivo.",
    };
  }

  if (umidadeSolo < limiteMinimo) {
    return {
      nivel: "seco",
      etiqueta: "Solo seco",
      chamada: "Umidade abaixo do recomendado",
      explicacao: "O solo está perdendo umidade. O sistema acompanha a queda e prepara o próximo ciclo de irrigação.",
    };
  }

  if (umidadeSolo <= limiteMaximo) {
    return {
      nivel: "ideal",
      etiqueta: "Faixa ideal",
      chamada: "Solo no ponto certo para cultivar",
      explicacao: "A retenção de água está equilibrada e dentro da faixa de conforto configurada para a horta.",
    };
  }

  if (umidadeSolo <= limiteExcesso) {
    return {
      nivel: "atencao",
      etiqueta: "Solo úmido",
      chamada: "Umidade acima da faixa ideal",
      explicacao: "Há bastante água disponível no solo. A bomba permanece em repouso enquanto o nível se estabiliza.",
    };
  }

  return {
    nivel: "critico",
    etiqueta: "Excesso de água",
    chamada: "Solo mais úmido que o recomendado",
    explicacao: "A leitura indica saturação. Mantenha a irrigação desligada e verifique a drenagem do recipiente.",
  };
}

/**
 * Resume o estado do cultivo usando apenas o pacote normalizado. A prioridade
 * evita mensagens alarmistas: primeiro mostra uma ação automática em curso e,
 * na ausência dela, informa se existe algo que merece observação.
 */
function calcularEstadoSistema(dadosHorta) {
  if (dadosHorta.estadoArduino.conexao !== "conectado") {
    return { chave: "desconectado", texto: "Fonte desconectada" };
  }

  const classificacao = classificarUmidade(dadosHorta.umidadeSolo);

  if (dadosHorta.bombaLigada === true) {
    return { chave: "irrigando", texto: "Irrigação em andamento" };
  }

  if (classificacao.nivel === "critico") {
    return { chave: "atencao", texto: "Atenção ao cultivo" };
  }

  if (dadosHorta.iluminacaoLigada === true) {
    return { chave: "luz-ativa", texto: "Iluminação em atividade" };
  }

  if (["seco", "atencao"].includes(classificacao.nivel)) {
    return { chave: "observacao", texto: "Cultivo em observação" };
  }

  return { chave: "estavel", texto: "Sistema estável" };
}

function atualizarEstadoGeral(dadosHorta) {
  const estado = calcularEstadoSistema(dadosHorta);
  document.body.dataset.estadoCultivo = estado.chave;

  if (dadosHorta.estadoArduino.conexao === "conectado") {
    definirEstadoGlobal("conectado", estado.texto);
  } else {
    definirEstadoGlobal("desconectado", estado.texto);
  }
}

function textosDiferentes(valorAnterior, valorAtual) {
  return valorAnterior !== valorAtual;
}

function registrarEvento(tipo, titulo, descricao, dataEvento) {
  // Existe somente uma linha de “nova leitura”; ela muda de posição e conteúdo
  // sem expulsar da lista os eventos importantes de bomba e iluminação.
  if (tipo === "leitura") {
    estadoInteratividade.eventosRecentes = estadoInteratividade.eventosRecentes.filter(
      (evento) => evento.tipo !== "leitura",
    );
  }

  estadoInteratividade.sequenciaEvento += 1;
  estadoInteratividade.eventosRecentes.unshift({
    id: estadoInteratividade.sequenciaEvento,
    tipo,
    titulo,
    descricao,
    data: dataEvento ?? new Date(),
  });
  estadoInteratividade.eventosRecentes = estadoInteratividade.eventosRecentes.slice(0, LIMITE_EVENTOS);
}

function renderizarAtividades() {
  const fragmento = document.createDocumentFragment();
  const itensExistentes = new Map(
    [...elementos.listaAtividades.querySelectorAll("[data-evento-id]")]
      .map((item) => [item.dataset.eventoId, item]),
  );

  estadoInteratividade.eventosRecentes.forEach((evento, indice) => {
    const chaveEvento = String(evento.id);
    let item = itensExistentes.get(chaveEvento);

    if (!item) {
      const textos = document.createElement("span");
      const titulo = document.createElement("strong");
      const descricao = document.createElement("small");
      const horario = document.createElement("time");

      item = document.createElement("li");
      item.dataset.eventoId = chaveEvento;
      textos.className = "texto-atividade";
      textos.append(titulo, descricao);
      item.append(textos, horario);
    }

    item.dataset.tipo = evento.tipo;
    if (indice === 0 && !prefereMovimentoReduzido.matches) {
      item.classList.add("atividade-entrada");
    } else {
      item.classList.remove("atividade-entrada");
    }

    const titulo = item.querySelector("strong");
    const descricao = item.querySelector("small");
    const horario = item.querySelector("time");
    atualizarTextoSeMudou(titulo, evento.titulo);
    atualizarTextoSeMudou(descricao, evento.descricao);
    horario.dateTime = evento.data.toISOString();
    atualizarTextoSeMudou(horario, formatadorHoraMinuto.format(evento.data));

    fragmento.append(item);
  });

  elementos.listaAtividades.replaceChildren(fragmento);
}

/**
 * Gera a linha do tempo comparando dois objetos `dadosHorta`. Portanto, as
 * atividades continuam corretas com dados simulados ou pacotes reais da Serial.
 */
function processarEventos(dadosAnteriores, dadosHorta) {
  const dataEvento = dadosHorta.ultimaAtualizacao ?? new Date();
  const numeroLeitura = dadosHorta.numeroLeitura === null
    ? "sem identificação"
    : `#${formatadorInteiro.format(dadosHorta.numeroLeitura)}`;
  const resumoUmidade = dadosHorta.umidadeSolo === null
    ? "Umidade indisponível"
    : `${formatadorInteiro.format(dadosHorta.umidadeSolo)}% de umidade`;
  let anuncioImportante = "";

  if (!dadosAnteriores) {
    registrarEvento(
      "sistema",
      "Monitoramento sincronizado",
      "Primeiro pacote completo recebido",
      dataEvento,
    );
  }

  registrarEvento(
    "leitura",
    `Nova leitura · ${resumoUmidade.toLocaleLowerCase("pt-BR")}`,
    `Pacote ${numeroLeitura} validado`,
    dataEvento,
  );

  if (dadosAnteriores) {
    if (textosDiferentes(dadosAnteriores.bombaLigada, dadosHorta.bombaLigada)) {
      const ligada = dadosHorta.bombaLigada === true;
      registrarEvento(
        "irrigacao",
        ligada ? "Irrigação ativada" : "Irrigação concluída",
        ligada ? "A bomba começou a elevar a umidade" : "A bomba voltou ao repouso",
        dataEvento,
      );
      emitirEventoInterface("atuador", { alvo: "bomba", ligado: ligada });
      anuncioImportante = ligada ? "Irrigação ativada" : "Irrigação concluída";
    }

    if (textosDiferentes(dadosAnteriores.iluminacaoLigada, dadosHorta.iluminacaoLigada)) {
      const ligada = dadosHorta.iluminacaoLigada === true;
      registrarEvento(
        "iluminacao",
        ligada ? "Grow Light ligada" : "Grow Light desligada",
        ligada
          ? `Ciclo ativo até ${dadosHorta.horarioIluminacaoFim}`
          : `Próxima ativação às ${dadosHorta.horarioIluminacaoInicio}`,
        dataEvento,
      );
      emitirEventoInterface("atuador", { alvo: "iluminacao", ligado: ligada });
      anuncioImportante = ligada ? "Grow Light ligada" : "Grow Light desligada";
    }

    const classificacaoAnterior = classificarUmidade(dadosAnteriores.umidadeSolo);
    const classificacaoAtual = classificarUmidade(dadosHorta.umidadeSolo);
    if (classificacaoAnterior.nivel !== classificacaoAtual.nivel) {
      registrarEvento(
        ["critico", "seco"].includes(classificacaoAtual.nivel) ? "atencao" : "sistema",
        `Solo entrou em: ${classificacaoAtual.etiqueta.toLocaleLowerCase("pt-BR")}`,
        resumoUmidade,
        dataEvento,
      );
      if (["critico", "seco"].includes(classificacaoAtual.nivel)) {
        emitirEventoInterface("alerta", { alvo: "umidade", nivel: classificacaoAtual.nivel });
      }
      anuncioImportante = classificacaoAtual.chamada;
    }
  }

  renderizarAtividades();

  // O leitor de tela é avisado apenas sobre mudanças de estado, nunca sobre
  // cada pacote periódico, para não transformar monitoramento em ruído.
  if (anuncioImportante) {
    elementos.anuncioAtividade.textContent = anuncioImportante;
  }
}

function valorMudou(dadosAnteriores, dadosHorta, campos) {
  if (!dadosAnteriores) return true;
  return campos.some((campo) => dadosAnteriores[campo] !== dadosHorta[campo]);
}

/**
 * Confirma visualmente um pacote novo sem movimentar cartões inteiros. Em uma
 * Serial mais rápida, chamadas no mesmo quadro são agrupadas pelo navegador.
 */
function sinalizarNovaLeitura(dadosAnteriores, dadosHorta) {
  const cartoesAtualizados = new Set();

  if (valorMudou(dadosAnteriores, dadosHorta, ["umidadeSolo", "valorBrutoSensor"])) {
    cartoesAtualizados.add(elementos.cartaoUmidade);
  }
  if (valorMudou(dadosAnteriores, dadosHorta, ["bombaLigada", "iluminacaoLigada"])) {
    cartoesAtualizados.add(elementos.cartaoAutomacao);
  }
  if (valorMudou(dadosAnteriores, dadosHorta, [
    "horarioRtc",
    "horarioIluminacaoInicio",
    "horarioIluminacaoFim",
  ])) {
    cartoesAtualizados.add(elementos.cartaoCicloIluminacao);
  }

  elementos.gradePainel.querySelectorAll(".cartao").forEach((cartao) => {
    cartao.dataset.atualizado = String(cartoesAtualizados.has(cartao));
  });

  const painelEstaVisivel = document.body.classList.contains("painel-visivel");
  if (!dadosAnteriores || !painelEstaVisivel || prefereMovimentoReduzido.matches) return;

  window.clearTimeout(estadoInteratividade.temporizadorNovaLeitura);
  elementos.gradePainel.classList.remove("nova-leitura");
  elementos.cartaoArduino.classList.remove("pacote-recebido");
  elementos.cartaoHistorico.classList.remove("nova-amostra");
  elementos.carimboAtualizacao.classList.remove("leitura-recebida");

  window.requestAnimationFrame(() => {
    elementos.gradePainel.classList.add("nova-leitura");
    elementos.cartaoArduino.classList.add("pacote-recebido");
    elementos.cartaoHistorico.classList.add("nova-amostra");
    elementos.carimboAtualizacao.classList.add("leitura-recebida");
  });

  estadoInteratividade.temporizadorNovaLeitura = window.setTimeout(() => {
    elementos.gradePainel.classList.remove("nova-leitura");
    elementos.cartaoArduino.classList.remove("pacote-recebido");
    elementos.cartaoHistorico.classList.remove("nova-amostra");
    elementos.carimboAtualizacao.classList.remove("leitura-recebida");
  }, 850);
}

function atualizarUmidade(dadosHorta) {
  const { umidadeSolo, valorBrutoSensor } = dadosHorta;
  const classificacao = classificarUmidade(umidadeSolo);
  const valorVisual = umidadeSolo ?? 0;
  const limiteMinimo = obterConfiguracao("horta.limiteUmidadeMinima", 45);
  const limiteMaximo = obterConfiguracao("horta.limiteUmidadeMaxima", 72);

  atualizarTextoAnimado(
    elementos.valorUmidade,
    umidadeSolo === null ? "--" : formatadorInteiro.format(umidadeSolo),
    umidadeSolo,
  );
  atualizarTextoAnimado(
    elementos.valorBrutoSensor,
    valorBrutoSensor === null ? "----" : formatadorInteiro.format(limitarValor(valorBrutoSensor, 0, 1023)),
    valorBrutoSensor,
  );
  atualizarTextoSeMudou(elementos.faixaConfortoUmidade, `${limiteMinimo}–${limiteMaximo}`);

  elementos.medidorUmidade.style.setProperty("--valor-medidor", valorVisual.toFixed(1));
  elementos.circuloMedidor.dataset.estadoSolo = classificacao.nivel;
  elementos.circuloMedidor.dataset.irrigando = String(dadosHorta.bombaLigada === true);
  elementos.marcadorUmidade.style.left = `${valorVisual}%`;
  elementos.etiquetaUmidade.dataset.nivel = classificacao.nivel;
  elementos.textoEtiquetaUmidade.textContent = classificacao.etiqueta;
  elementos.chamadaUmidade.textContent = classificacao.chamada;
  elementos.explicacaoUmidade.textContent = classificacao.explicacao;

  if (umidadeSolo === null) {
    elementos.medidorUmidade.removeAttribute("aria-valuenow");
    elementos.medidorUmidade.setAttribute("aria-valuetext", "Leitura indisponível");
  } else {
    elementos.medidorUmidade.setAttribute("aria-valuenow", String(arredondarParaAria(umidadeSolo)));
    elementos.medidorUmidade.setAttribute("aria-valuetext", `${formatadorDecimal.format(umidadeSolo)} por cento`);
  }
}

function arredondarParaAria(valor) {
  return Math.round(valor * 10) / 10;
}

function atualizarAtuadores(dadosHorta) {
  const bombaDisponivel = dadosHorta.bombaLigada !== null;
  const iluminacaoDisponivel = dadosHorta.iluminacaoLigada !== null;
  const estadoBomba = bombaDisponivel
    ? dadosHorta.bombaLigada ? "ligado" : "desligado"
    : "indisponivel";
  const estadoIluminacao = iluminacaoDisponivel
    ? dadosHorta.iluminacaoLigada ? "ligado" : "desligado"
    : "indisponivel";

  elementos.atuadorBomba.dataset.estado = estadoBomba;
  atualizarTextoSeMudou(elementos.estadoBomba, !bombaDisponivel
    ? "Estado indisponível"
    : dadosHorta.bombaLigada ? "Ligada · irrigando" : "Desligada · em repouso");
  elementos.descricaoBomba.textContent = !bombaDisponivel
    ? "A fonte não informou o estado da bomba"
    : dadosHorta.bombaLigada
      ? "Elevando gradualmente a umidade"
      : "Umidade não exige irrigação";

  elementos.atuadorIluminacao.dataset.estado = estadoIluminacao;
  atualizarTextoSeMudou(elementos.estadoIluminacao, !iluminacaoDisponivel
    ? "Estado indisponível"
    : dadosHorta.iluminacaoLigada ? "Ligada · ciclo ativo" : "Desligada · em repouso");
  elementos.descricaoIluminacao.textContent = !iluminacaoDisponivel
    ? "A fonte não informou o estado da Grow Light"
    : dadosHorta.iluminacaoLigada
      ? `Programada para desligar às ${dadosHorta.horarioIluminacaoFim}`
      : `Programada para ligar às ${dadosHorta.horarioIluminacaoInicio}`;
}

function converterHorarioEmSegundos(horario) {
  const partes = String(horario ?? "").split(":").map(Number);
  if (partes.length < 2 || partes.some((parte) => !Number.isFinite(parte))) return null;
  return (partes[0] * 3600) + (partes[1] * 60) + (partes[2] ?? 0);
}

function calcularCicloIluminacao(dadosHorta) {
  const inicio = converterHorarioEmSegundos(dadosHorta.horarioIluminacaoInicio);
  const fim = converterHorarioEmSegundos(dadosHorta.horarioIluminacaoFim);
  const agora = converterHorarioEmSegundos(dadosHorta.horarioRtc);
  if (inicio === null || fim === null || agora === null || inicio === fim) {
    return { valido: false, ativo: false, progresso: 0 };
  }

  const atravessaMeiaNoite = inicio > fim;
  const duracao = atravessaMeiaNoite ? (86400 - inicio) + fim : fim - inicio;
  const ativo = atravessaMeiaNoite
    ? agora >= inicio || agora < fim
    : agora >= inicio && agora < fim;
  let decorrido;
  if (ativo) {
    decorrido = agora >= inicio ? agora - inicio : (86400 - inicio) + agora;
  } else if (!atravessaMeiaNoite && agora >= fim) {
    decorrido = duracao;
  } else {
    decorrido = 0;
  }

  return {
    valido: true,
    ativo,
    progresso: limitarValor((decorrido / duracao) * 100, 0, 100),
  };
}

function atualizarCicloIluminacao(dadosHorta) {
  const ciclo = calcularCicloIluminacao(dadosHorta);
  const inicio = dadosHorta.horarioIluminacaoInicio ?? "--:--";
  const fim = dadosHorta.horarioIluminacaoFim ?? "--:--";
  const rtc = dadosHorta.horarioRtc ?? "--:--:--";

  atualizarTextoSeMudou(elementos.horarioInicioIluminacao, inicio);
  atualizarTextoSeMudou(elementos.horarioFimIluminacao, fim);
  atualizarTextoSeMudou(elementos.legendaInicioIluminacao, inicio);
  atualizarTextoSeMudou(elementos.legendaFimIluminacao, fim);
  atualizarTextoSeMudou(elementos.horarioRtcIluminacao, `RTC ${rtc}`);
  elementos.preenchimentoCicloIluminacao.style.width = `${ciclo.progresso}%`;
  elementos.cartaoCicloIluminacao.dataset.cicloAtivo = String(ciclo.ativo);

  if (!ciclo.valido) {
    elementos.estadoCicloIluminacao.textContent = "Aguardando RTC";
    elementos.proximaAcaoIluminacao.textContent = "Programação indisponível";
    elementos.leituraCicloIluminacao.textContent = "Aguardando horário e ciclo completos do sistema.";
    elementos.barraCicloIluminacao.removeAttribute("aria-valuenow");
    elementos.barraCicloIluminacao.setAttribute("aria-valuetext", "Ciclo indisponível");
    return;
  }

  elementos.estadoCicloIluminacao.textContent = ciclo.ativo ? "Ciclo ativo" : "Em repouso";
  elementos.proximaAcaoIluminacao.textContent = ciclo.ativo
    ? `Desliga às ${fim}`
    : `Liga às ${inicio}`;
  elementos.leituraCicloIluminacao.textContent = dadosHorta.iluminacaoLigada
    ? ciclo.ativo
      ? `Grow Light ligada. Desligamento programado para ${fim}.`
      : "Grow Light ligada fora do período programado; verifique o controle do circuito."
    : ciclo.ativo
      ? "Ciclo ativo; aguardando a confirmação de acionamento da Grow Light."
      : `Ciclo em repouso. Próxima ativação às ${inicio}.`;
  elementos.barraCicloIluminacao.setAttribute("aria-valuenow", String(Math.round(ciclo.progresso)));
  elementos.barraCicloIluminacao.setAttribute(
    "aria-valuetext",
    `${Math.round(ciclo.progresso)} por cento do ciclo; RTC ${rtc}`,
  );
}

function traduzirConexao(conexao) {
  const rotulos = {
    conectado: "Conectado",
    conectando: "Conectando",
    desconectado: "Desconectado",
    erro: "Falha na conexão",
  };
  return rotulos[conexao] ?? "Desconectado";
}

function obterApresentacaoFonte(nomeFonte) {
  const fonteNormalizada = nomeFonte.toLocaleLowerCase("pt-BR");

  if (fonteNormalizada.includes("arduino") || fonteNormalizada.includes("serial")) {
    return {
      sigla: "USB",
      nomeCabecalho: "Arduino Serial",
      nomeFluxo: "Arduino",
      titulo: "Os dados atuais são recebidos pela comunicação Serial",
      descricaoFluxo: "Arduino envia dados da horta para a interface",
      nota: "A fonte Serial utiliza o mesmo objeto de dados esperado pelos cartões do painel.",
      rodape: "Dados recebidos do Arduino",
    };
  }

  if (fonteNormalizada.includes("simulador")) {
    return {
      sigla: "SIM",
      nomeCabecalho: "Simulador ativo",
      nomeFluxo: "Simulador",
      titulo: "Os dados atuais são gerados pelo simulador",
      descricaoFluxo: "Simulador envia dados da horta para a interface",
      nota: "A fonte poderá ser trocada pelo Arduino Serial sem alterar os cartões do painel.",
      rodape: "Dados simulados para desenvolvimento",
    };
  }

  return {
    sigla: "DAD",
    nomeCabecalho: "Fonte conectada",
    nomeFluxo: "Fonte externa",
    titulo: "Fonte usada pelo painel",
    descricaoFluxo: "Fonte externa envia dados da horta para a interface",
    nota: "A interface recebe um objeto padronizado, independentemente da origem dos dados.",
    rodape: "Dados fornecidos por fonte externa",
  };
}

function atualizarIdentificacaoFonte(dadosHorta) {
  const apresentacao = obterApresentacaoFonte(dadosHorta.fonteDados);
  elementos.siglaFonteDados.textContent = apresentacao.sigla;
  elementos.nomeFonteDados.textContent = apresentacao.nomeCabecalho;
  elementos.seloFonteDados.title = apresentacao.titulo;
  elementos.nomeFonteFluxo.textContent = apresentacao.nomeFluxo;
  elementos.fluxoDados.setAttribute("aria-label", apresentacao.descricaoFluxo);
  elementos.notaFonteDados.textContent = apresentacao.nota;
  elementos.textoFonteRodape.textContent = apresentacao.rodape;
}

function atualizarArduino(dadosHorta) {
  const { estadoArduino } = dadosHorta;
  elementos.cartaoArduino.dataset.conexao = estadoArduino.conexao;
  atualizarTextoSeMudou(elementos.estadoArduino, traduzirConexao(estadoArduino.conexao));
  elementos.portaArduino.textContent = estadoArduino.porta;
  elementos.transmissaoArduino.textContent = estadoArduino.recebendoDados
    ? "Recebendo pacotes"
    : "Sem transmissão";
}

function marcarTransmissaoInterrompida(conexaoVisual, estadoVisual, transmissaoVisual) {
  elementos.cartaoArduino.dataset.conexao = conexaoVisual;

  if (elementos.estadoArduino.textContent !== estadoVisual) {
    elementos.estadoArduino.textContent = estadoVisual;
  }

  if (elementos.transmissaoArduino.textContent !== transmissaoVisual) {
    elementos.transmissaoArduino.textContent = transmissaoVisual;
  }
}

function atualizarHorario(dadosHorta) {
  const { ultimaAtualizacao, numeroLeitura, intervaloAtualizacao } = dadosHorta;

  if (ultimaAtualizacao) {
    const dataFormatada = formatadorData.format(ultimaAtualizacao);
    elementos.horarioAtualizacao.dateTime = ultimaAtualizacao.toISOString();
    elementos.horarioAtualizacao.textContent = formatadorHorario.format(ultimaAtualizacao);
    elementos.dataAtualizacao.textContent = dataFormatada.charAt(0).toLocaleUpperCase("pt-BR") + dataFormatada.slice(1);
  } else {
    elementos.horarioAtualizacao.removeAttribute("datetime");
    elementos.horarioAtualizacao.textContent = "--:--:--";
    elementos.dataAtualizacao.textContent = "Horário indisponível";
  }

  elementos.numeroLeitura.textContent = numeroLeitura === null
    ? "#----"
    : `#${formatadorInteiro.format(numeroLeitura)}`;
  elementos.intervaloLeitura.textContent = intervaloAtualizacao === null
    ? "intervalo desconhecido"
    : `a cada ${formatadorInteiro.format(intervaloAtualizacao / 1000)} s`;
}

function atualizarHistorico(dadosHorta) {
  if (dadosHorta.historicoUmidade.length > 0) {
    historicoUmidade = [...dadosHorta.historicoUmidade];
  } else if (dadosHorta.umidadeSolo !== null) {
    historicoUmidade.push(dadosHorta.umidadeSolo);
    historicoUmidade = historicoUmidade.slice(-LIMITE_HISTORICO);
  }

  const intervaloEsperado = Math.max(dadosHorta.intervaloAtualizacao ?? 4000, 1);
  let regularidadeAtual = 100;
  if (estadoComunicacao.intervaloUltimaRecepcao !== null) {
    regularidadeAtual = limitarValor(
      100 - (Math.abs(estadoComunicacao.intervaloUltimaRecepcao - intervaloEsperado) / intervaloEsperado) * 100,
      0,
      100,
    );
  }
  historicoRegularidade.push(regularidadeAtual);
  historicoRegularidade = historicoRegularidade.slice(-LIMITE_HISTORICO);

  // Quando a fonte fornece o histórico completo, os horários são reconstruídos
  // a partir do intervalo declarado. Na Serial, cada pacote poderá trazer seu
  // próprio histórico ou deixar o painel acumular as amostras normalmente.
  const instanteFinal = dadosHorta.ultimaAtualizacao ?? new Date();
  historicoHorarios = historicoUmidade.map((valor, indice) => new Date(
    instanteFinal.getTime() - (historicoUmidade.length - 1 - indice) * intervaloEsperado,
  ));

  if (historicoUmidade.length === 0) {
    pontosHistoricoAtuais = [];
    elementos.linhaHistorico.setAttribute("points", "");
    elementos.areaHistorico.setAttribute("d", "");
    elementos.pontoHistorico.setAttribute("visibility", "hidden");
    elementos.variacaoUmidade.textContent = "—";
    ocultarPontoGrafico();
    return;
  }

  const largura = 720;
  const topo = 20;
  const base = 170;
  const intervaloHorizontal = historicoUmidade.length > 1
    ? largura / (historicoUmidade.length - 1)
    : 0;
  pontosHistoricoAtuais = historicoUmidade.map((valor, indice) => {
    const x = indice * intervaloHorizontal;
    const y = base - (valor / 100) * (base - topo);
    return { x, y };
  });
  const pontosFormatados = pontosHistoricoAtuais
    .map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const primeiroPonto = pontosHistoricoAtuais[0];
  const ultimoPonto = pontosHistoricoAtuais[pontosHistoricoAtuais.length - 1];
  const caminhoArea = `M${primeiroPonto.x.toFixed(1)},${base} L${pontosFormatados.replaceAll(" ", " L")} L${ultimoPonto.x.toFixed(1)},${base} Z`;
  const variacao = historicoUmidade.at(-1) - historicoUmidade[0];
  const sinal = variacao > 0 ? "+" : "";

  elementos.linhaHistorico.setAttribute("points", pontosFormatados);
  elementos.areaHistorico.setAttribute("d", caminhoArea);
  elementos.pontoHistorico.setAttribute("cx", ultimoPonto.x.toFixed(1));
  elementos.pontoHistorico.setAttribute("cy", ultimoPonto.y.toFixed(1));
  elementos.pontoHistorico.removeAttribute("visibility");
  elementos.variacaoUmidade.textContent = `${sinal}${formatadorDecimal.format(variacao)}%`;
  elementos.graficoUmidade.setAttribute(
    "aria-label",
    `Histórico de ${historicoUmidade.length} leituras. Umidade atual de ${formatadorDecimal.format(historicoUmidade.at(-1))} por cento.`,
  );

  if (estadoInteratividade.indiceGraficoSelecionado !== null) {
    mostrarPontoGrafico(Math.min(
      estadoInteratividade.indiceGraficoSelecionado,
      pontosHistoricoAtuais.length - 1,
    ));
  }
}

function atualizarResumo(dadosHorta) {
  if (dadosHorta.estadoArduino.conexao !== "conectado") {
    elementos.resumoPainel.textContent = "A fonte de dados está desconectada. As leituras abaixo não estão sendo atualizadas.";
    return;
  }

  const classificacao = classificarUmidade(dadosHorta.umidadeSolo);
  let complemento = " Irrigação em repouso; Grow Light seguindo o ciclo programado.";

  if (dadosHorta.bombaLigada === true) {
    complemento = " A irrigação automática está em andamento.";
  } else if (dadosHorta.iluminacaoLigada === true) {
    complemento = ` A Grow Light está ligada até ${dadosHorta.horarioIluminacaoFim}.`;
  } else if (dadosHorta.bombaLigada === null || dadosHorta.iluminacaoLigada === null) {
    complemento = " Um ou mais estados dos atuadores não foram informados pela fonte.";
  }

  elementos.resumoPainel.textContent = `${classificacao.chamada}.${complemento}`;
}

function mostrarPontoGrafico(indiceSolicitado, anunciarParaLeitor = false, retangulos = null) {
  if (pontosHistoricoAtuais.length === 0) return;

  const indice = limitarValor(
    Math.round(indiceSolicitado),
    0,
    pontosHistoricoAtuais.length - 1,
  );
  const ponto = pontosHistoricoAtuais[indice];
  const valor = historicoUmidade[indice];
  const horario = historicoHorarios[indice];
  const retanguloSvg = retangulos?.svg ?? elementos.graficoUmidade.getBoundingClientRect();
  const retanguloConteiner = retangulos?.conteiner
    ?? elementos.graficoUmidade.parentElement.getBoundingClientRect();
  const esquerda = retanguloSvg.left - retanguloConteiner.left + (ponto.x / 720) * retanguloSvg.width;
  const topo = retanguloSvg.top - retanguloConteiner.top + (ponto.y / 190) * retanguloSvg.height;

  estadoInteratividade.indiceGraficoSelecionado = indice;
  elementos.linhaCursorHistorico.setAttribute("x1", ponto.x.toFixed(1));
  elementos.linhaCursorHistorico.setAttribute("x2", ponto.x.toFixed(1));
  elementos.pontoCursorHistorico.setAttribute("cx", ponto.x.toFixed(1));
  elementos.pontoCursorHistorico.setAttribute("cy", ponto.y.toFixed(1));
  elementos.linhaCursorHistorico.removeAttribute("hidden");
  elementos.pontoCursorHistorico.removeAttribute("hidden");

  elementos.horarioBalaoGrafico.textContent = indice === historicoUmidade.length - 1
    ? "Agora"
    : horario ? formatadorHoraMinuto.format(horario) : `Leitura ${indice + 1}`;
  elementos.valorBalaoGrafico.textContent = formatadorDecimal.format(valor);
  elementos.balaoGrafico.hidden = false;
  elementos.balaoGrafico.setAttribute("aria-hidden", "false");

  // O último ponto fica no limite direito do SVG; o posicionamento é limitado
  // para o balão nunca ser recortado pelo cartão, inclusive no celular.
  const margemBalao = 7;
  const metadeBalao = elementos.balaoGrafico.offsetWidth / 2;
  const alturaBalao = elementos.balaoGrafico.offsetHeight;
  const esquerdaLimitada = limitarValor(
    esquerda,
    metadeBalao + margemBalao,
    retanguloConteiner.width - metadeBalao - margemBalao,
  );
  const topoLimitado = Math.max(topo, alturaBalao + 16);
  elementos.balaoGrafico.style.left = `${esquerdaLimitada}px`;
  elementos.balaoGrafico.style.top = `${topoLimitado}px`;

  if (anunciarParaLeitor) {
    elementos.anuncioGrafico.textContent = `${elementos.horarioBalaoGrafico.textContent}: ${formatadorDecimal.format(valor)} por cento de umidade`;
  }
}

function ocultarPontoGrafico() {
  estadoInteratividade.indiceGraficoSelecionado = null;
  elementos.linhaCursorHistorico.setAttribute("hidden", "");
  elementos.pontoCursorHistorico.setAttribute("hidden", "");
  elementos.balaoGrafico.hidden = true;
  elementos.balaoGrafico.setAttribute("aria-hidden", "true");
}

function selecionarPontoPeloPonteiro(evento) {
  if (pontosHistoricoAtuais.length === 0) return;
  const retanguloSvg = elementos.graficoUmidade.getBoundingClientRect();
  const proporcao = limitarValor((evento.clientX - retanguloSvg.left) / retanguloSvg.width, 0, 1);
  const indice = Math.round(proporcao * (pontosHistoricoAtuais.length - 1));
  if (indice === estadoInteratividade.indiceGraficoSelecionado && !elementos.balaoGrafico.hidden) return;

  mostrarPontoGrafico(indice, false, {
    svg: retanguloSvg,
    conteiner: elementos.graficoUmidade.parentElement.getBoundingClientRect(),
  });
}

function agendarSelecaoPeloPonteiro(evento) {
  estadoInteratividade.coordenadaPonteiroGrafico = evento.clientX;
  if (estadoInteratividade.quadroPonteiroGrafico !== null) return;

  estadoInteratividade.quadroPonteiroGrafico = window.requestAnimationFrame(() => {
    estadoInteratividade.quadroPonteiroGrafico = null;
    selecionarPontoPeloPonteiro({ clientX: estadoInteratividade.coordenadaPonteiroGrafico });
  });
}

function ativarAba(botaoAtivo, deveReceberFoco = false) {
  const abaMudou = botaoAtivo.getAttribute("aria-selected") !== "true";

  elementos.abasCartao.forEach((botao) => {
    const estaAtivo = botao === botaoAtivo;
    const painel = document.querySelector(`#${botao.getAttribute("aria-controls")}`);
    botao.setAttribute("aria-selected", String(estaAtivo));
    botao.tabIndex = estaAtivo ? 0 : -1;
    painel.hidden = !estaAtivo;
  });

  if (abaMudou) {
    emitirEventoInterface("aba", {
      acao: "ativou",
      alvo: botaoAtivo.id || botaoAtivo.getAttribute("aria-controls"),
    });
  }

  if (deveReceberFoco) botaoAtivo.focus();
}

function resumirVariacao(valores, unidade = "%") {
  if (valores.length < 2) return "Primeira amostra";
  const variacao = valores.at(-1) - valores[0];
  const sinal = variacao > 0 ? "+" : "";
  return `${sinal}${formatadorDecimal.format(variacao)}${unidade} no período`;
}

function obterEstadoComunicacaoVisual(dadosHorta = dadosAtuais) {
  if (fontePausada) {
    return { conexao: "pausado", rotulo: "Monitoramento pausado", valor: "PAUSADO", transmissao: "Atualização pausada" };
  }

  if (estadoComunicacao.desatualizada) {
    return { conexao: "desatualizado", rotulo: "Sem resposta", valor: "SEM SINAL", transmissao: "Leitura interrompida" };
  }

  if (["desconectado", "erro"].includes(estadoComunicacao.estadoTransporte)) {
    return {
      conexao: estadoComunicacao.estadoTransporte,
      rotulo: estadoComunicacao.estadoTransporte === "erro" ? "Falha na conexão" : "Fonte desconectada",
      valor: "DESCONECTADO",
      transmissao: "Sem transmissão",
    };
  }

  if (estadoComunicacao.estadoTransporte !== "conectado") {
    return { conexao: "sincronizando", rotulo: "Aguardando pacote válido", valor: "SINCRONIZANDO", transmissao: "Validando dados" };
  }

  const recebeuPacote = estadoComunicacao.primeiroPacoteValidoRecebido
    && dadosHorta?.estadoArduino.recebendoDados;
  return recebeuPacote
    ? { conexao: "conectado", rotulo: "Pacotes válidos", valor: "CONECTADO", transmissao: "Recebendo pacotes" }
    : { conexao: "sincronizando", rotulo: "Aguardando pacote válido", valor: "SINCRONIZANDO", transmissao: "Validando dados" };
}

function obterConfiguracaoDetalhes(tipo, dadosHorta) {
  const classificacao = classificarUmidade(dadosHorta.umidadeSolo);
  const horario = dadosHorta.ultimaAtualizacao
    ? formatadorHorario.format(dadosHorta.ultimaAtualizacao)
    : "Não informado";
  const bomba = dadosHorta.bombaLigada === true ? "Ligada" : "Desligada";
  const iluminacao = dadosHorta.iluminacaoLigada === true ? "Ligada" : "Desligada";
  const limiteMinimo = obterConfiguracao("horta.limiteUmidadeMinima", 45);
  const limiteMaximo = obterConfiguracao("horta.limiteUmidadeMaxima", 72);

  if (tipo === "umidade") {
    return {
      rotulo: "Sensor de umidade",
      titulo: "Leitura aprofundada do solo",
      estado: classificacao.etiqueta,
      valor: dadosHorta.umidadeSolo === null ? "--" : formatadorInteiro.format(dadosHorta.umidadeSolo),
      unidade: "%",
      descricao: classificacao.explicacao,
      metricas: [
        ["Valor bruto", dadosHorta.valorBrutoSensor === null ? "--" : `${formatadorInteiro.format(dadosHorta.valorBrutoSensor)} / 1023`],
        ["Faixa de conforto", `${limiteMinimo}–${limiteMaximo}%`],
        ["Última leitura", horario],
      ],
      tituloVisual: "Histórico recente da umidade",
      resumoVisual: resumirVariacao(historicoUmidade),
      valoresVisual: historicoUmidade,
    };
  }

  if (tipo === "iluminacao") {
    const ciclo = calcularCicloIluminacao(dadosHorta);
    return {
      rotulo: "Automação temporal",
      titulo: "Ciclo da Grow Light",
      estado: dadosHorta.iluminacaoLigada ? "Grow Light ligada" : "Grow Light em repouso",
      valor: dadosHorta.horarioRtc?.slice(0, 5) ?? "--:--",
      unidade: " RTC",
      descricao: ciclo.ativo
        ? `Período de iluminação em andamento; término programado para ${dadosHorta.horarioIluminacaoFim}.`
        : `Próxima ativação programada para ${dadosHorta.horarioIluminacaoInicio}.`,
      metricas: [
        ["Ciclo", `${dadosHorta.horarioIluminacaoInicio} → ${dadosHorta.horarioIluminacaoFim}`],
        ["Grow Light", iluminacao],
        ["Próxima ação", ciclo.ativo ? `Desligar às ${dadosHorta.horarioIluminacaoFim}` : `Ligar às ${dadosHorta.horarioIluminacaoInicio}`],
      ],
      tituloVisual: "Posição no ciclo atual",
      resumoVisual: ciclo.valido ? `${Math.round(ciclo.progresso)}% do período` : "RTC indisponível",
      valoresVisual: ciclo.valido ? [4, ciclo.progresso] : [],
    };
  }

  if (tipo === "automacao") {
    const totalAtivos = [dadosHorta.bombaLigada, dadosHorta.iluminacaoLigada].filter(Boolean).length;
    return {
      rotulo: "Controle automático",
      titulo: "Decisões dos atuadores",
      estado: totalAtivos > 0 ? "Automação atuando" : "Sistema em repouso",
      valor: formatadorInteiro.format(totalAtivos),
      unidade: totalAtivos === 1 ? " ativo" : " ativos",
      descricao: totalAtivos > 0
        ? "Os atuadores estão respondendo às condições recebidas dos sensores."
        : "Os limites atuais não exigem compensação por irrigação ou iluminação.",
      metricas: [
        ["Bomba de irrigação", bomba],
        ["Grow Light", iluminacao],
        ["Modo de controle", "Automático"],
      ],
      tituloVisual: "Umidade que orienta a irrigação",
      resumoVisual: `Faixa de conforto: ${limiteMinimo}–${limiteMaximo}%`,
      valoresVisual: historicoUmidade,
    };
  }

  const comunicacao = obterEstadoComunicacaoVisual(dadosHorta);
  return {
    rotulo: "Comunicação do dispositivo",
    titulo: "Canal de dados do Arduino",
    estado: comunicacao.rotulo,
    valor: comunicacao.valor,
    unidade: "",
    descricao: "O painel considera o dispositivo conectado somente depois de receber um pacote completo e válido.",
    metricas: [
      ["Porta", dadosHorta.estadoArduino.porta],
      ["Transmissão", comunicacao.transmissao],
      ["Leitura atual", dadosHorta.numeroLeitura === null ? "#----" : `#${formatadorInteiro.format(dadosHorta.numeroLeitura)}`],
    ],
    tituloVisual: "Regularidade dos pacotes",
    resumoVisual: dadosHorta.intervaloAtualizacao === null
      ? "Intervalo não informado"
      : `Intervalo esperado: ${formatadorDecimal.format(dadosHorta.intervaloAtualizacao / 1000)} s`,
    valoresVisual: historicoRegularidade,
  };
}

/** Atualiza o diálogo aberto com a leitura mais recente, sem fechá-lo. */
function atualizarPainelDetalhes(dadosHorta = dadosAtuais) {
  if (!estadoInteratividade.detalheAberto || !dadosHorta) return;

  const configuracao = obterConfiguracaoDetalhes(estadoInteratividade.detalheAberto, dadosHorta);
  elementos.painelDetalhes.dataset.tipo = estadoInteratividade.detalheAberto;
  elementos.rotuloPainelDetalhes.textContent = configuracao.rotulo;
  elementos.tituloPainelDetalhes.textContent = configuracao.titulo;
  elementos.estadoPainelDetalhes.textContent = configuracao.estado;
  atualizarTextoAnimado(elementos.valorPainelDetalhes, configuracao.valor);
  elementos.unidadePainelDetalhes.textContent = configuracao.unidade;
  elementos.descricaoPainelDetalhes.textContent = configuracao.descricao;

  configuracao.metricas.forEach(([rotulo, valor], indice) => {
    elementos.rotulosMetricasDetalhes[indice].textContent = rotulo;
    elementos.valoresMetricasDetalhes[indice].textContent = valor;
  });

  elementos.tituloLeituraRecente.textContent = configuracao.tituloVisual;
  elementos.resumoLeituraDetalhes.textContent = configuracao.resumoVisual;
  const valoresBarras = configuracao.valoresVisual.slice(-16);
  while (elementos.visualLeituraDetalhes.children.length > valoresBarras.length) {
    elementos.visualLeituraDetalhes.lastElementChild.remove();
  }
  while (elementos.visualLeituraDetalhes.children.length < valoresBarras.length) {
    const barra = document.createElement("i");
    barra.style.setProperty("--nivel-barra", "0.04");
    elementos.visualLeituraDetalhes.append(barra);
  }

  const barras = [...elementos.visualLeituraDetalhes.children];
  window.requestAnimationFrame(() => {
    barras.forEach((barra, indice) => {
      barra.style.setProperty(
        "--nivel-barra",
        (limitarValor(valoresBarras[indice], 4, 100) / 100).toFixed(3),
      );
    });
  });
}

function abrirPainelDetalhes(tipo, botaoOrigem) {
  if (!dadosAtuais) return;
  estadoInteratividade.detalheAberto = tipo;
  estadoInteratividade.botaoDetalheOrigem = botaoOrigem;
  atualizarPainelDetalhes(dadosAtuais);

  if (!elementos.painelDetalhes.open) {
    document.documentElement.classList.add("detalhes-abertos");
    elementos.painelDetalhes.showModal();
    emitirEventoInterface("detalhes", { acao: "abriu", alvo: tipo });
  }
}

async function fecharPainelDetalhes() {
  if (!elementos.painelDetalhes.open) return;
  const fecharComTransicao = escopoAplicacao.HortaInteligente
    ?.interfaceSistema
    ?.fecharDialogoComTransicao;
  if (typeof fecharComTransicao === "function") {
    await fecharComTransicao(elementos.painelDetalhes);
  } else {
    elementos.painelDetalhes.close();
  }
}

/** Configura controles uma única vez antes que a fonte publique o primeiro pacote. */
function iniciarInteratividade() {
  if (estadoInteratividade.iniciada) return;
  estadoInteratividade.iniciada = true;

  elementos.abasCartao.forEach((botao, indice) => {
    botao.addEventListener("click", () => ativarAba(botao));
    botao.addEventListener("keydown", (evento) => {
      const teclasNavegacao = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!teclasNavegacao.includes(evento.key)) return;
      evento.preventDefault();

      let proximoIndice = indice;
      if (evento.key === "ArrowLeft") proximoIndice = (indice - 1 + elementos.abasCartao.length) % elementos.abasCartao.length;
      if (evento.key === "ArrowRight") proximoIndice = (indice + 1) % elementos.abasCartao.length;
      if (evento.key === "Home") proximoIndice = 0;
      if (evento.key === "End") proximoIndice = elementos.abasCartao.length - 1;
      ativarAba(elementos.abasCartao[proximoIndice], true);
    });
  });

  elementos.graficoUmidade.addEventListener("pointermove", agendarSelecaoPeloPonteiro);
  elementos.graficoUmidade.addEventListener("pointerdown", (evento) => {
    elementos.graficoUmidade.focus({ preventScroll: true });
    selecionarPontoPeloPonteiro(evento);
  });
  elementos.graficoUmidade.addEventListener("pointerleave", () => {
    window.cancelAnimationFrame(estadoInteratividade.quadroPonteiroGrafico);
    estadoInteratividade.quadroPonteiroGrafico = null;
    if (document.activeElement !== elementos.graficoUmidade) ocultarPontoGrafico();
  });
  elementos.graficoUmidade.addEventListener("focus", () => {
    if (estadoInteratividade.indiceGraficoSelecionado === null && pontosHistoricoAtuais.length > 0) {
      mostrarPontoGrafico(
        pontosHistoricoAtuais.length - 1,
        elementos.graficoUmidade.matches(":focus-visible"),
      );
    }
  });
  elementos.graficoUmidade.addEventListener("blur", ocultarPontoGrafico);
  elementos.graficoUmidade.addEventListener("keydown", (evento) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(evento.key)) return;
    evento.preventDefault();

    if (evento.key === "Escape") {
      ocultarPontoGrafico();
      return;
    }

    const indiceAtual = estadoInteratividade.indiceGraficoSelecionado ?? pontosHistoricoAtuais.length - 1;
    if (evento.key === "Home") mostrarPontoGrafico(0, true);
    if (evento.key === "End") mostrarPontoGrafico(pontosHistoricoAtuais.length - 1, true);
    if (evento.key === "ArrowLeft") mostrarPontoGrafico(indiceAtual - 1, true);
    if (evento.key === "ArrowRight") mostrarPontoGrafico(indiceAtual + 1, true);
  });

  elementos.botoesDetalhes.forEach((botao) => {
    botao.addEventListener("click", () => abrirPainelDetalhes(botao.dataset.abrirDetalhes, botao));
  });
  elementos.botaoFecharDetalhes.addEventListener("click", fecharPainelDetalhes);
  elementos.painelDetalhes.addEventListener("click", (evento) => {
    if (evento.target === elementos.painelDetalhes) fecharPainelDetalhes();
  });
  elementos.painelDetalhes.addEventListener("cancel", (evento) => {
    evento.preventDefault();
    fecharPainelDetalhes();
  });
  elementos.painelDetalhes.addEventListener("close", () => {
    const botaoOrigem = estadoInteratividade.botaoDetalheOrigem;
    const detalheFechado = estadoInteratividade.detalheAberto;
    document.documentElement.classList.remove("detalhes-abertos");
    estadoInteratividade.detalheAberto = null;
    estadoInteratividade.botaoDetalheOrigem = null;
    botaoOrigem?.focus({ preventScroll: true });
    emitirEventoInterface("detalhes", { acao: "fechou", alvo: detalheFechado });
  });

  // Limites e horários podem mudar nas Configurações enquanto o painel está
  // aberto. A leitura continua a mesma; apenas sua interpretação é recalculada.
  document.addEventListener("configuracoesalteradas", () => {
    if (!dadosAtuais) return;
    atualizarUmidade(dadosAtuais);
    atualizarAtuadores(dadosAtuais);
    atualizarCicloIluminacao(dadosAtuais);
    atualizarEstadoGeral(dadosAtuais);
    atualizarPainelDetalhes(dadosAtuais);
  });

  prefereMovimentoReduzido.addEventListener?.("change", (evento) => {
    if (!evento.matches) return;
    elementos.gradePainel.classList.remove("nova-leitura");
    elementos.cartaoArduino.classList.remove("pacote-recebido");
    elementos.cartaoHistorico.classList.remove("nova-amostra");
    elementos.carimboAtualizacao.classList.remove("leitura-recebida");
  });

  // A fonte continua coletando dados em segundo plano; somente movimentos
  // decorativos são suspensos enquanto a janela não está visível.
  document.addEventListener("visibilitychange", () => {
    document.documentElement.classList.toggle("pagina-oculta", document.hidden);
  });
}

function definirEstadoGlobal(estado, texto) {
  elementos.estadoCabecalho.dataset.estado = estado;
  elementos.estadoGeralCompacto.dataset.estado = estado;
  atualizarTextoSeMudou(elementos.textoEstadoCabecalho, texto);
  atualizarTextoSeMudou(elementos.textoEstadoGeralCompacto, texto);
}

function mostrarAviso(mensagem) {
  if (avisoAtual === mensagem && !elementos.avisoSistema.hidden) return;
  avisoAtual = mensagem;
  elementos.textoAvisoSistema.textContent = mensagem;
  elementos.avisoSistema.hidden = false;
}

function ocultarAviso() {
  avisoAtual = "";
  elementos.avisoSistema.hidden = true;
}

/**
 * Atualiza os elementos visuais utilizando somente o objeto `dadosHorta`.
 * A função não sabe se esse objeto veio do simulador ou do Arduino; essa é a
 * separação que permitirá trocar a fonte sem reconstruir o painel.
 */
function atualizarInterface(dadosRecebidos) {
  const dadosHorta = normalizarDadosHorta(dadosRecebidos);
  const dadosAnteriores = dadosAtuais;

  dadosAtuais = dadosHorta;

  atualizarUmidade(dadosHorta);
  atualizarAtuadores(dadosHorta);
  atualizarCicloIluminacao(dadosHorta);
  atualizarArduino(dadosHorta);
  atualizarIdentificacaoFonte(dadosHorta);
  atualizarHorario(dadosHorta);
  atualizarHistorico(dadosHorta);
  atualizarResumo(dadosHorta);
  processarEventos(dadosAnteriores, dadosHorta);
  sinalizarNovaLeitura(dadosAnteriores, dadosHorta);
  atualizarPainelDetalhes(dadosHorta);

  document.body.classList.remove("dados-desatualizados");

  if (!fontePausada && dadosHorta.estadoArduino.conexao === "conectado") {
    atualizarEstadoGeral(dadosHorta);
    ocultarAviso();
  } else if (dadosHorta.estadoArduino.conexao !== "conectado") {
    document.body.dataset.estadoCultivo = "desconectado";
    definirEstadoGlobal(dadosHorta.estadoArduino.conexao, traduzirConexao(dadosHorta.estadoArduino.conexao));
    mostrarAviso("A comunicação com a fonte de dados foi interrompida. Os valores podem estar desatualizados.");
  }

  atualizarEstadoTemporal();

  // Publica o mesmo contrato normalizado para modos globais, como Estação
  // imersiva e Modo Ambiente. Eles não leem textos dos cartões e, no futuro,
  // continuarão funcionando quando a origem for substituída pela Serial.
  document.dispatchEvent(new CustomEvent("dadoshortaatualizados", {
    detail: dadosHorta,
  }));
  return true;
}

/**
 * Mantém no máximo uma renderização pendente e usa sempre o pacote mais novo.
 * Isso protege o painel de rajadas da futura Serial sem atrasar o simulador,
 * que publica em um intervalo muito maior que um quadro de tela.
 */
function agendarAtualizacaoInterface(leituraConfirmada) {
  estadoInteratividade.leituraPendente = leituraConfirmada;
  if (estadoInteratividade.quadroLeituraPendente !== null) return true;

  estadoInteratividade.quadroLeituraPendente = window.requestAnimationFrame(() => {
    const leituraMaisRecente = estadoInteratividade.leituraPendente;
    estadoInteratividade.leituraPendente = null;
    estadoInteratividade.quadroLeituraPendente = null;

    const leituraRenderizada = atualizarInterface(leituraMaisRecente);
    if (leituraRenderizada) {
      escopoAplicacao.HortaInteligente?.inicializacao?.confirmarPrimeiraLeitura();
    }
  });

  return true;
}

/**
 * Ponto único de entrada dos dados vindos de qualquer fonte. A interface não
 * chama o simulador diretamente: hoje ele entrega o objeto aqui e, no futuro,
 * a comunicação Serial entregará exatamente o mesmo formato.
 */
function receberLeituraDaFonte(dadosRecebidos) {
  const inicializacao = escopoAplicacao.HortaInteligente?.inicializacao;

  // A chegada de bytes ou de um pacote candidato permite mostrar sincronização,
  // mas ainda não autoriza a abertura da interface.
  inicializacao?.informarEstadoDaFonte("sincronizando");

  if (!leituraDaHortaValida(dadosRecebidos)) {
    return false;
  }

  const chavePacote = `${dadosRecebidos.fonteDados.trim()}:${converterNumero(dadosRecebidos.numeroLeitura)}`;
  if (estadoComunicacao.chaveUltimoPacote === chavePacote) {
    return false;
  }

  const conexaoPrecisavaRetomar = estadoComunicacao.estadoTransporte !== "conectado"
    || estadoComunicacao.desatualizada;
  const horarioRecebimento = new Date();
  estadoComunicacao.intervaloUltimaRecepcao = estadoComunicacao.ultimoPacoteRecebidoEm
    ? horarioRecebimento - estadoComunicacao.ultimoPacoteRecebidoEm
    : null;
  estadoComunicacao.ultimoPacoteRecebidoEm = horarioRecebimento;
  estadoComunicacao.estadoTransporte = "conectado";
  estadoComunicacao.chaveUltimoPacote = chavePacote;
  estadoComunicacao.desatualizada = false;
  estadoComunicacao.primeiroPacoteValidoRecebido = true;

  // Durante a abertura, a própria sequência de inicialização sonoriza a
  // conexão. Esta notificação cobre somente reconexões já dentro do painel.
  if (conexaoPrecisavaRetomar && document.body.classList.contains("painel-visivel")) {
    emitirEventoInterface("conexao", { estado: "conectado" });
  }

  const leituraConfirmada = prepararLeituraConfirmada(dadosRecebidos, horarioRecebimento);
  return agendarAtualizacaoInterface(leituraConfirmada);
}

// O segundo callback da fonte informa apenas procura, porta aberta ou
// sincronização. Nem mesmo um estado chamado "conectado" libera o painel.
function informarEstadoDaFonte(estadoRecebido) {
  escopoAplicacao.HortaInteligente?.inicializacao?.informarEstadoDaFonte(estadoRecebido);

  const estadoBruto = typeof estadoRecebido === "string"
    ? estadoRecebido
    : estadoRecebido?.estado ?? estadoRecebido?.conexao ?? estadoRecebido?.status;
  const estadoNormalizado = typeof estadoBruto === "string"
    ? estadoBruto.trim().toLocaleLowerCase("pt-BR")
    : "aguardando";
  const estadoAnterior = estadoComunicacao.estadoTransporte;

  if (["erro", "falha"].includes(estadoNormalizado)) {
    estadoComunicacao.estadoTransporte = "erro";
  } else if (["desconectado", "offline", "ausente"].includes(estadoNormalizado)) {
    estadoComunicacao.estadoTransporte = "desconectado";
  } else if (["aguardando", "procurando"].includes(estadoNormalizado)) {
    estadoComunicacao.estadoTransporte = "aguardando";
  } else if (
    ["conectado", "online"].includes(estadoNormalizado)
    && estadoComunicacao.primeiroPacoteValidoRecebido
  ) {
    // Depois da primeira leitura válida, a confirmação do transporte não
    // regride o painel; a ausência de novos pacotes continua sob o watchdog.
    estadoComunicacao.estadoTransporte = "conectado";
  } else {
    // Porta aberta, dispositivo encontrado e até “conectado” significam apenas
    // sincronização até que `receberLeituraDaFonte` valide o pacote completo.
    estadoComunicacao.estadoTransporte = "sincronizando";
  }

  if (["desconectado", "erro"].includes(estadoComunicacao.estadoTransporte)) {
    estadoComunicacao.primeiroPacoteValidoRecebido = false;
    estadoComunicacao.chaveUltimoPacote = null;
    estadoComunicacao.desatualizada = false;
  }

  if (!document.body.classList.contains("painel-visivel")) return;

  if (estadoComunicacao.estadoTransporte === "conectado") {
    if (!estadoComunicacao.desatualizada && dadosAtuais) {
      atualizarArduino(dadosAtuais);
      atualizarEstadoGeral(dadosAtuais);
      ocultarAviso();
      atualizarPainelDetalhes();
    }
    return;
  }

  const comunicacao = obterEstadoComunicacaoVisual();
  const estaSincronizando = ["sincronizando", "aguardando"].includes(estadoComunicacao.estadoTransporte);
  document.body.dataset.estadoCultivo = comunicacao.conexao;
  definirEstadoGlobal(
    estadoComunicacao.estadoTransporte === "erro"
      ? "erro"
      : estaSincronizando ? "desatualizado" : "desconectado",
    comunicacao.rotulo,
  );
  marcarTransmissaoInterrompida(
    estadoComunicacao.estadoTransporte === "erro"
      ? "erro"
      : estaSincronizando ? "conectando" : "desconectado",
    comunicacao.rotulo,
    comunicacao.transmissao,
  );
  mostrarAviso(
    estaSincronizando
      ? "O dispositivo foi encontrado. O painel aguarda um pacote completo e válido antes de confirmar a conexão."
      : "A comunicação com a fonte de dados foi interrompida. Os valores permanecem visíveis, mas não estão sendo atualizados.",
  );
  atualizarPainelDetalhes();

  if (estadoAnterior !== estadoComunicacao.estadoTransporte) {
    registrarEvento(
      estadoComunicacao.estadoTransporte === "sincronizando" ? "sistema" : "atencao",
      comunicacao.rotulo,
      comunicacao.transmissao,
      new Date(),
    );
    renderizarAtividades();
    emitirEventoInterface("conexao", {
      estado: estadoComunicacao.estadoTransporte,
      estadoAnterior,
    });
  }
}

function descreverTempoDecorrido(data) {
  const segundos = Math.max(0, Math.floor((Date.now() - data.getTime()) / 1000));
  if (segundos < 2) return "Atualizado agora";
  if (segundos < 60) return `Atualizado há ${segundos} s`;

  const minutos = Math.floor(segundos / 60);
  if (minutos === 1) return "Atualizado há 1 min";
  if (minutos < 60) return `Atualizado há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  return horas === 1 ? "Atualizado há 1 h" : `Atualizado há ${horas} h`;
}

/**
 * Roda a cada segundo apenas para atualizar “há quantos segundos” e detectar
 * leituras antigas. Os sensores continuam sendo atualizados no ritmo da fonte.
 */
function atualizarEstadoTemporal() {
  if (!estadoComunicacao.ultimoPacoteRecebidoEm) {
    elementos.tempoRelativo.textContent = "Horário indisponível";
    return;
  }

  elementos.tempoRelativo.textContent = descreverTempoDecorrido(estadoComunicacao.ultimoPacoteRecebidoEm);

  if (fontePausada) {
    document.body.classList.add("dados-pausados");
    document.body.classList.remove("dados-desatualizados");
    document.body.dataset.estadoCultivo = "pausado";
    definirEstadoGlobal("pausado", "Atualizações pausadas");
    marcarTransmissaoInterrompida("conectando", "Monitoramento pausado", "Atualização pausada");
    mostrarAviso("As atualizações estão pausadas. Os valores permanecem congelados até você retomar.");
    atualizarPainelDetalhes();
    return;
  }

  document.body.classList.remove("dados-pausados");
  // Em um reload muito rápido do Electron, o relógio de comunicação pode ser
  // restaurado um quadro antes do primeiro objeto normalizado chegar.
  const intervaloEsperado = dadosAtuais?.intervaloAtualizacao ?? 4000;
  const limiteSemDados = Math.max(intervaloEsperado * 3, 12000);
  const tempoSemDados = Date.now() - estadoComunicacao.ultimoPacoteRecebidoEm.getTime();

  if (tempoSemDados > limiteSemDados) {
    const acabouDeFicarDesatualizada = !estadoComunicacao.desatualizada;
    estadoComunicacao.desatualizada = true;
    document.body.classList.add("dados-desatualizados");
    document.body.dataset.estadoCultivo = "desatualizado";
    definirEstadoGlobal("desatualizado", "Dados desatualizados");
    marcarTransmissaoInterrompida("desconectado", "Sem resposta", "Leitura interrompida");
    mostrarAviso("Nenhuma leitura recente foi recebida. Confira a fonte de dados antes de usar estes valores.");
    atualizarPainelDetalhes();
    if (acabouDeFicarDesatualizada) {
      emitirEventoInterface("conexao", { estado: "desatualizado" });
    }
  }
}

/**
 * Inicializa qualquer fonte previamente registrada. Para usar dados reais depois,
 * o arquivo Serial precisa oferecer `iniciar(aoReceberDados, aoMudarEstado)` e,
 * opcionalmente, os controles de pausa; as funções visuais permanecem iguais.
 */
function iniciarPainel(fonteDados) {
  if (!fonteDados || typeof fonteDados.iniciar !== "function") {
    throw new TypeError("A fonte de dados precisa oferecer o método iniciar().");
  }

  iniciarInteratividade();

  const inicializacao = escopoAplicacao.HortaInteligente?.inicializacao;
  inicializacao?.configurarFonte(fonteDados);
  inicializacao?.informarEstadoDaFonte("aguardando");

  const fontePermitePausa = ["pausar", "retomar", "estaPausado"].every(
    (metodo) => typeof fonteDados[metodo] === "function",
  );

  elementos.botaoPausar.hidden = !fontePermitePausa;

  if (fontePermitePausa) {
    elementos.botaoPausar.addEventListener("click", () => {
      if (fonteDados.estaPausado()) {
        fontePausada = false;
        elementos.botaoPausar.setAttribute("aria-pressed", "false");
        elementos.botaoPausar.setAttribute("aria-label", "Pausar atualização dos dados");
        elementos.textoBotaoPausar.textContent = "Pausar";
        fonteDados.retomar();
      } else {
        fonteDados.pausar();
        fontePausada = true;
        elementos.botaoPausar.setAttribute("aria-pressed", "true");
        elementos.botaoPausar.setAttribute("aria-label", "Retomar atualização dos dados");
        elementos.textoBotaoPausar.textContent = "Retomar";
        atualizarEstadoTemporal();
      }

      emitirEventoInterface("monitoramento", {
        acao: fontePausada ? "pausou" : "retomou",
      });
    });
  }

  const identificadorRelogio = window.setInterval(atualizarEstadoTemporal, 1000);

  window.addEventListener(
    "pagehide",
    (evento) => {
      // No cache de navegação, o navegador suspende e depois restaura os timers.
      if (evento.persisted) return;

      window.clearInterval(identificadorRelogio);
      window.cancelAnimationFrame(estadoInteratividade.quadroLeituraPendente);
      window.cancelAnimationFrame(estadoInteratividade.quadroPonteiroGrafico);
      fonteDados.parar?.();
    },
  );

  // A fonte é iniciada por último porque o simulador publica sincronicamente.
  // Assim, controles, relógio e encerramento já estão prontos ao primeiro dado.
  fonteDados.iniciar(receberLeituraDaFonte, informarEstadoDaFonte);
}

// Publica somente a entrada validada. Assim, a futura comunicação Serial não
// consegue contornar por engano o contrato completo exigido pela interface.
const hortaInteligente = escopoAplicacao.HortaInteligente ?? {};
hortaInteligente.receberDadosHorta = receberLeituraDaFonte;
hortaInteligente.leituraDaHortaValida = leituraDaHortaValida;
escopoAplicacao.HortaInteligente = hortaInteligente;

try {
  if (typeof hortaInteligente.criarFonteDados !== "function") {
    throw new TypeError("Nenhuma fonte de dados foi registrada para o painel.");
  }

  const fonteDados = hortaInteligente.criarFonteDados({ intervaloAtualizacao: 4000 });
  iniciarPainel(fonteDados);
} catch (erro) {
  console.error("Não foi possível iniciar o painel da Horta Inteligente.", erro);
  hortaInteligente.inicializacao?.informarFalha(
    "A fonte de dados não pôde ser iniciada. Verifique a configuração do sistema.",
  );
  definirEstadoGlobal("erro", "Falha ao iniciar");
  mostrarAviso("O painel não conseguiu iniciar a fonte de dados. Consulte o console do navegador para mais detalhes.");
}
})(window);
