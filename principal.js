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
const formatadorData = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
});

// Centraliza as referências do HTML para deixar as funções de atualização menores.
const elementos = {
  estadoCabecalho: document.querySelector("#estado-cabecalho"),
  textoEstadoCabecalho: document.querySelector("#texto-estado-cabecalho"),
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
  valorUmidade: document.querySelector("#valor-umidade"),
  etiquetaUmidade: document.querySelector("#etiqueta-umidade"),
  textoEtiquetaUmidade: document.querySelector("#texto-etiqueta-umidade"),
  chamadaUmidade: document.querySelector("#chamada-umidade"),
  explicacaoUmidade: document.querySelector("#explicacao-umidade"),
  valorBrutoSensor: document.querySelector("#valor-bruto-sensor"),
  marcadorUmidade: document.querySelector("#marcador-umidade"),
  atuadorBomba: document.querySelector("#atuador-bomba"),
  estadoBomba: document.querySelector("#estado-bomba"),
  descricaoBomba: document.querySelector("#descricao-bomba"),
  atuadorIluminacao: document.querySelector("#atuador-iluminacao"),
  estadoIluminacao: document.querySelector("#estado-iluminacao"),
  descricaoIluminacao: document.querySelector("#descricao-iluminacao"),
  valorLuminosidade: document.querySelector("#valor-luminosidade"),
  valorLux: document.querySelector("#valor-lux"),
  barraLuminosidade: document.querySelector("#barra-luminosidade"),
  preenchimentoLuminosidade: document.querySelector("#preenchimento-luminosidade"),
  tendenciaLuminosidade: document.querySelector("#tendencia-luminosidade"),
  leituraLuminosidade: document.querySelector("#leitura-luminosidade"),
  cartaoArduino: document.querySelector("#cartao-arduino"),
  estadoArduino: document.querySelector("#estado-arduino"),
  portaArduino: document.querySelector("#porta-arduino"),
  transmissaoArduino: document.querySelector("#transmissao-arduino"),
  horarioAtualizacao: document.querySelector("#horario-atualizacao"),
  dataAtualizacao: document.querySelector("#data-atualizacao"),
  numeroLeitura: document.querySelector("#numero-leitura"),
  intervaloLeitura: document.querySelector("#intervalo-leitura"),
  graficoUmidade: document.querySelector("#grafico-umidade"),
  areaHistorico: document.querySelector("#area-historico"),
  linhaHistorico: document.querySelector("#linha-historico"),
  pontoHistorico: document.querySelector("#ponto-historico"),
  variacaoUmidade: document.querySelector("#variacao-umidade"),
  fluxoDados: document.querySelector("#fluxo-dados"),
  nomeFonteFluxo: document.querySelector("#nome-fonte-fluxo"),
  notaFonteDados: document.querySelector("#nota-fonte-dados"),
  textoFonteRodape: document.querySelector("#texto-fonte-rodape"),
};

const ESTADOS_CONEXAO_VALIDOS = new Set(["conectado", "conectando", "desconectado", "erro"]);
const LIMITE_HISTORICO = 24;

let dadosAtuais = null;
let dataUltimaRenderizacao = null;
let luminosidadeAnterior = null;
let historicoUmidade = [];
let fontePausada = false;
let avisoAtual = "";

function limitarValor(valor, minimo, maximo) {
  return Math.min(Math.max(valor, minimo), maximo);
}

function converterNumero(valor) {
  if (valor === null || valor === undefined || valor === "" || typeof valor === "boolean") return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function normalizarBooleano(valor) {
  if (typeof valor === "boolean") return valor;
  if (valor === 1 || valor === "1" || valor === "true") return true;
  if (valor === 0 || valor === "0" || valor === "false") return false;
  return null;
}

function normalizarPercentual(valor) {
  const numero = converterNumero(valor);
  return numero === null ? null : limitarValor(numero, 0, 100);
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
    recebendoDados: Boolean(estado.recebendoDados),
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
        .map(normalizarPercentual)
        .filter((valor) => valor !== null)
        .slice(-LIMITE_HISTORICO)
    : [];

  return {
    umidadeSolo: normalizarPercentual(dados.umidadeSolo),
    valorBrutoSensor: converterNumero(dados.valorBrutoSensor),
    bombaLigada: normalizarBooleano(dados.bombaLigada),
    luminosidade: normalizarPercentual(dados.luminosidade),
    luminosidadeLux: converterNumero(dados.luminosidadeLux),
    iluminacaoLigada: normalizarBooleano(dados.iluminacaoLigada),
    estadoArduino: normalizarEstadoArduino(dados.estadoArduino),
    ultimaAtualizacao: normalizarData(dados.ultimaAtualizacao),
    numeroLeitura: converterNumero(dados.numeroLeitura),
    intervaloAtualizacao: converterNumero(dados.intervaloAtualizacao),
    fonteDados: typeof dados.fonteDados === "string" ? dados.fonteDados : "desconhecida",
    historicoUmidade: historicoRecebido,
  };
}

function atualizarTextoAnimado(elemento, novoTexto) {
  if (!elemento || elemento.textContent === novoTexto) return;

  elemento.textContent = novoTexto;
  elemento.classList.remove("valor-atualizado");
  window.requestAnimationFrame(() => elemento.classList.add("valor-atualizado"));
}

function classificarUmidade(umidadeSolo) {
  if (umidadeSolo === null) {
    return {
      nivel: "indisponivel",
      etiqueta: "Sem leitura",
      chamada: "Dados do solo indisponíveis",
      explicacao: "A interface aguarda um valor válido da fonte de dados antes de avaliar o cultivo.",
    };
  }

  if (umidadeSolo < 20) {
    return {
      nivel: "critico",
      etiqueta: "Nível crítico",
      chamada: "O solo precisa de água agora",
      explicacao: "A umidade está muito baixa. A irrigação automática deve entrar em ação para proteger o cultivo.",
    };
  }

  if (umidadeSolo < 45) {
    return {
      nivel: "seco",
      etiqueta: "Solo seco",
      chamada: "Umidade abaixo do recomendado",
      explicacao: "O solo está perdendo umidade. O sistema acompanha a queda e prepara o próximo ciclo de irrigação.",
    };
  }

  if (umidadeSolo <= 72) {
    return {
      nivel: "ideal",
      etiqueta: "Faixa ideal",
      chamada: "Solo no ponto certo para cultivar",
      explicacao: "A retenção de água está equilibrada e dentro da faixa de conforto configurada para a horta.",
    };
  }

  if (umidadeSolo <= 86) {
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

function atualizarUmidade(dadosHorta) {
  const { umidadeSolo, valorBrutoSensor } = dadosHorta;
  const classificacao = classificarUmidade(umidadeSolo);
  const valorVisual = umidadeSolo ?? 0;

  atualizarTextoAnimado(
    elementos.valorUmidade,
    umidadeSolo === null ? "--" : formatadorInteiro.format(umidadeSolo),
  );
  atualizarTextoAnimado(
    elementos.valorBrutoSensor,
    valorBrutoSensor === null ? "----" : formatadorInteiro.format(limitarValor(valorBrutoSensor, 0, 1023)),
  );

  elementos.medidorUmidade.style.setProperty("--valor-medidor", valorVisual.toFixed(1));
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
  elementos.estadoBomba.textContent = !bombaDisponivel
    ? "Estado indisponível"
    : dadosHorta.bombaLigada ? "Ligada · irrigando" : "Desligada · em repouso";
  elementos.descricaoBomba.textContent = !bombaDisponivel
    ? "A fonte não informou o estado da bomba"
    : dadosHorta.bombaLigada
      ? "Elevando gradualmente a umidade"
      : "Umidade não exige irrigação";

  elementos.atuadorIluminacao.dataset.estado = estadoIluminacao;
  elementos.estadoIluminacao.textContent = !iluminacaoDisponivel
    ? "Estado indisponível"
    : dadosHorta.iluminacaoLigada ? "Ligada · compensando" : "Desligada · em repouso";
  elementos.descricaoIluminacao.textContent = !iluminacaoDisponivel
    ? "A fonte não informou o estado da iluminação"
    : dadosHorta.iluminacaoLigada
      ? "Complementando a luz do ambiente"
      : "Luz ambiente suficiente no momento";
}

function interpretarLuminosidade(luminosidade) {
  if (luminosidade === null) return "Aguardando uma leitura válida do sensor de luz.";
  if (luminosidade < 25) return "Ambiente escuro; a iluminação auxiliar pode ser necessária.";
  if (luminosidade < 45) return "Luz suave, próxima do limite definido para o cultivo.";
  if (luminosidade <= 82) return "Boa disponibilidade de luz para o desenvolvimento das plantas.";
  return "Luz intensa; observe a temperatura e a exposição direta das folhas.";
}

function atualizarLuminosidade(dadosHorta) {
  const { luminosidade, luminosidadeLux } = dadosHorta;
  const valorVisual = luminosidade ?? 0;

  atualizarTextoAnimado(
    elementos.valorLuminosidade,
    luminosidade === null ? "--" : formatadorInteiro.format(luminosidade),
  );
  atualizarTextoAnimado(
    elementos.valorLux,
    luminosidadeLux === null ? "-----" : formatadorInteiro.format(Math.max(0, luminosidadeLux)),
  );

  elementos.preenchimentoLuminosidade.style.width = `${valorVisual}%`;
  elementos.leituraLuminosidade.textContent = interpretarLuminosidade(luminosidade);

  if (luminosidade === null) {
    elementos.barraLuminosidade.removeAttribute("aria-valuenow");
    elementos.barraLuminosidade.setAttribute("aria-valuetext", "Leitura indisponível");
    elementos.tendenciaLuminosidade.textContent = "Sem dados";
    return;
  }

  elementos.barraLuminosidade.setAttribute("aria-valuenow", String(arredondarParaAria(luminosidade)));
  elementos.barraLuminosidade.setAttribute("aria-valuetext", `${formatadorInteiro.format(luminosidade)} por cento`);

  if (luminosidadeAnterior === null || Math.abs(luminosidade - luminosidadeAnterior) < 1) {
    elementos.tendenciaLuminosidade.textContent = "Estável";
  } else if (luminosidade > luminosidadeAnterior) {
    elementos.tendenciaLuminosidade.textContent = "↗ Aumentando";
  } else {
    elementos.tendenciaLuminosidade.textContent = "↘ Diminuindo";
  }

  luminosidadeAnterior = luminosidade;
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
  elementos.estadoArduino.textContent = traduzirConexao(estadoArduino.conexao);
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

  if (historicoUmidade.length === 0) {
    elementos.linhaHistorico.setAttribute("points", "");
    elementos.areaHistorico.setAttribute("d", "");
    elementos.pontoHistorico.setAttribute("visibility", "hidden");
    elementos.variacaoUmidade.textContent = "—";
    return;
  }

  const largura = 720;
  const topo = 20;
  const base = 170;
  const intervaloHorizontal = historicoUmidade.length > 1
    ? largura / (historicoUmidade.length - 1)
    : 0;
  const pontos = historicoUmidade.map((valor, indice) => {
    const x = indice * intervaloHorizontal;
    const y = base - (valor / 100) * (base - topo);
    return { x, y };
  });
  const pontosFormatados = pontos.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const primeiroPonto = pontos[0];
  const ultimoPonto = pontos[pontos.length - 1];
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
}

function atualizarResumo(dadosHorta) {
  if (dadosHorta.estadoArduino.conexao !== "conectado") {
    elementos.resumoPainel.textContent = "A fonte de dados está desconectada. As leituras abaixo não estão sendo atualizadas.";
    return;
  }

  const classificacao = classificarUmidade(dadosHorta.umidadeSolo);
  let complemento = " Irrigação e iluminação permanecem em repouso.";

  if (dadosHorta.bombaLigada === true) {
    complemento = " A irrigação automática está em andamento.";
  } else if (dadosHorta.iluminacaoLigada === true) {
    complemento = " A iluminação auxiliar está compensando a baixa luz ambiente.";
  } else if (dadosHorta.bombaLigada === null || dadosHorta.iluminacaoLigada === null) {
    complemento = " Um ou mais estados dos atuadores não foram informados pela fonte.";
  }

  elementos.resumoPainel.textContent = `${classificacao.chamada}.${complemento}`;
}

function definirEstadoGlobal(estado, texto) {
  elementos.estadoCabecalho.dataset.estado = estado;
  elementos.textoEstadoCabecalho.textContent = texto;
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

  // Pacotes antigos são ignorados para não fazer o painel “voltar no tempo”.
  if (
    dadosHorta.ultimaAtualizacao
    && dataUltimaRenderizacao
    && dadosHorta.ultimaAtualizacao < dataUltimaRenderizacao
  ) {
    return;
  }

  dadosAtuais = dadosHorta;
  dataUltimaRenderizacao = dadosHorta.ultimaAtualizacao ?? dataUltimaRenderizacao;

  atualizarUmidade(dadosHorta);
  atualizarAtuadores(dadosHorta);
  atualizarLuminosidade(dadosHorta);
  atualizarArduino(dadosHorta);
  atualizarIdentificacaoFonte(dadosHorta);
  atualizarHorario(dadosHorta);
  atualizarHistorico(dadosHorta);
  atualizarResumo(dadosHorta);

  document.body.classList.remove("dados-desatualizados");

  if (!fontePausada && dadosHorta.estadoArduino.conexao === "conectado") {
    definirEstadoGlobal("conectado", "Operando normalmente");
    ocultarAviso();
  } else if (dadosHorta.estadoArduino.conexao !== "conectado") {
    definirEstadoGlobal(dadosHorta.estadoArduino.conexao, traduzirConexao(dadosHorta.estadoArduino.conexao));
    mostrarAviso("A comunicação com a fonte de dados foi interrompida. Os valores podem estar desatualizados.");
  }

  atualizarEstadoTemporal();
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
  if (!dadosAtuais?.ultimaAtualizacao) {
    elementos.tempoRelativo.textContent = "Horário indisponível";
    return;
  }

  elementos.tempoRelativo.textContent = descreverTempoDecorrido(dadosAtuais.ultimaAtualizacao);

  if (fontePausada) {
    document.body.classList.add("dados-pausados");
    document.body.classList.remove("dados-desatualizados");
    definirEstadoGlobal("pausado", "Atualizações pausadas");
    marcarTransmissaoInterrompida("conectando", "Monitoramento pausado", "Atualização pausada");
    mostrarAviso("As atualizações estão pausadas. Os valores permanecem congelados até você retomar.");
    return;
  }

  document.body.classList.remove("dados-pausados");
  const intervaloEsperado = dadosAtuais.intervaloAtualizacao ?? 4000;
  const limiteSemDados = Math.max(intervaloEsperado * 3, 12000);
  const tempoSemDados = Date.now() - dadosAtuais.ultimaAtualizacao.getTime();

  if (tempoSemDados > limiteSemDados) {
    document.body.classList.add("dados-desatualizados");
    definirEstadoGlobal("desatualizado", "Dados desatualizados");
    marcarTransmissaoInterrompida("desconectado", "Sem resposta", "Leitura interrompida");
    mostrarAviso("Nenhuma leitura recente foi recebida. Confira a fonte de dados antes de usar estes valores.");
  }
}

/**
 * Inicializa qualquer fonte previamente registrada. Para usar dados reais depois,
 * o arquivo Serial precisa oferecer `iniciar(aoReceberDados)` e, opcionalmente,
 * os controles de pausa; as funções visuais abaixo permanecem iguais.
 */
function iniciarPainel(fonteDados) {
  if (!fonteDados || typeof fonteDados.iniciar !== "function") {
    throw new TypeError("A fonte de dados precisa oferecer o método iniciar().");
  }

  fonteDados.iniciar(atualizarInterface);

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
    });
  }

  const identificadorRelogio = window.setInterval(atualizarEstadoTemporal, 1000);

  window.addEventListener(
    "pagehide",
    (evento) => {
      // No cache de navegação, o navegador suspende e depois restaura os timers.
      if (evento.persisted) return;

      window.clearInterval(identificadorRelogio);
      fonteDados.parar?.();
    },
  );
}

// Deixa a função disponível para a futura integração Serial e para testes manuais.
const hortaInteligente = escopoAplicacao.HortaInteligente ?? {};
hortaInteligente.atualizarInterface = atualizarInterface;
escopoAplicacao.HortaInteligente = hortaInteligente;

try {
  if (typeof hortaInteligente.criarFonteDados !== "function") {
    throw new TypeError("Nenhuma fonte de dados foi registrada para o painel.");
  }

  const fonteDados = hortaInteligente.criarFonteDados({ intervaloAtualizacao: 4000 });
  iniciarPainel(fonteDados);
} catch (erro) {
  console.error("Não foi possível iniciar o painel da Horta Inteligente.", erro);
  definirEstadoGlobal("erro", "Falha ao iniciar");
  mostrarAviso("O painel não conseguiu iniciar a fonte de dados. Consulte o console do navegador para mais detalhes.");
}
})(window);
