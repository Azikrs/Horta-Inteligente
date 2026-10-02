"use strict";

const { SerialPort } = require("serialport");

// O firmware informa somente estes quatro campos. Ausência de RTC ou Grow Light
// não pode ser preenchida com valores simulados ou com o relógio do computador.
function interpretarLinhaArduino(linha, porta) {
  const campos = /^UMIDADE\s*=\s*(\d+)%;\s*BRUTO\s*=\s*(\d+);\s*BOMBA\s*=\s*([01]);\s*LEITURAS\s*=\s*(-?\d+)\s*$/.exec(linha.trim());
  if (!campos) return null;
  const [, umidade, bruto, bomba, leitura] = campos.map(Number);
  if (umidade > 100 || bruto > 1023 || !Number.isSafeInteger(leitura)) return null;
  return {
    umidadeSolo: umidade,
    valorBrutoSensor: bruto,
    bombaLigada: bomba === 1,
    iluminacaoLigada: null,
    horarioRtc: null,
    horarioIluminacaoInicio: null,
    horarioIluminacaoFim: null,
    estadoArduino: { conexao: "conectado", porta, recebendoDados: true },
    ultimaAtualizacao: new Date().toISOString(),
    // int no AVR passa a ser negativo depois de 32767 leituras.
    numeroLeitura: leitura,
    intervaloAtualizacao: 4000,
    fonteDados: "arduino-serial",
  };
}

function selecionarPortasUsb(portas, ultimaPorta) {
  const prioridade = (porta) => {
    if (ultimaPorta && ((porta.serialNumber && porta.serialNumber === ultimaPorta.serialNumber)
      || porta.path === ultimaPorta.path)) return 0;
    return /arduino/i.test(porta.manufacturer ?? "") || /^(2341|2a03)$/i.test(porta.vendorId ?? "") ? 1 : 2;
  };
  return portas.filter((porta) => typeof porta.path === "string" && (
    porta.vendorId || /USB/i.test(porta.pnpId ?? "")
    || /arduino|usb|ch340|ch341|cp210|ftdi/i.test(`${porta.manufacturer ?? ""} ${porta.friendlyName ?? ""}`)
    || /(?:ttyUSB|ttyACM|usbserial|usbmodem)/i.test(porta.path)
  )).sort((a, b) => prioridade(a) - prioridade(b) || a.path.localeCompare(b.path, undefined, { numeric: true }));
}

function criarServicoSerial({ publicar, caminhoPorta = process.env.HORTA_PORTA_SERIAL, ClassePorta = SerialPort, intervaloReconexao = 3000, tempoSemLeitura = 12000 }) {
  const portaFixa = caminhoPorta?.trim() || null;
  let ativo = false;
  let tarefa = null;
  let cancelando = false;
  let cancelarTentativa = null;
  let cancelarEspera = null;
  let ultimaPorta = null;
  let estadoAtual = { estado: "aguardando", porta: portaFixa ?? "Busca automática" };

  function informar(estado, mensagem, porta = portaFixa ?? "Busca automática") {
    if (!ativo) return;
    estadoAtual = { estado, porta, mensagem };
    publicar({ tipo: "estado", dados: estadoAtual });
  }

  function monitorar(candidata) {
    return new Promise((resolver) => {
      const caminho = candidata.path;
      informar("procurando", `Procurando Arduino em ${caminho} a 9600 baud.`, caminho);
      let atual;
      let aberturaPendente = true;
      let fechamentoSolicitado = false;
      let encerrando = false;
      let concluido = false;
      let confirmado = false;
      let limite = null;
      let linha = "";
      let descartando = false;

      function concluir() {
        if (concluido) return;
        concluido = true;
        clearTimeout(limite);
        cancelarTentativa = null;
        resolver(confirmado);
      }
      function fechar() {
        if (concluido || encerrando) return;
        fechamentoSolicitado = true;
        clearTimeout(limite);
        // Uma abertura em andamento não pode ser fechada antes do callback.
        if (aberturaPendente) return;
        encerrando = true;
        if (atual?.isOpen) atual.close(concluir);
        else concluir();
      }
      function armarLimite() {
        clearTimeout(limite);
        limite = setTimeout(() => {
          informar("desconectado", `Nenhuma leitura válida em ${caminho}. ${portaFixa ? "Tentando reconectar." : "Continuando a busca automática."}`, caminho);
          fechar();
        }, tempoSemLeitura);
      }

      cancelarTentativa = fechar;
      try {
        atual = new ClassePorta({ path: caminho, baudRate: 9600, autoOpen: false });
        atual.on("data", (trecho) => {
          if (!ativo || concluido || encerrando) return;
          for (const caractere of trecho.toString("ascii")) {
            if (caractere === "\n") {
              const dados = descartando ? null : interpretarLinhaArduino(linha, caminho);
              linha = "";
              descartando = false;
              if (dados) {
                if (!confirmado) {
                  confirmado = true;
                  ultimaPorta = candidata;
                  informar("conectado", `Arduino da horta identificado em ${caminho}.`, caminho);
                }
                armarLimite();
                publicar({ tipo: "leitura", dados });
              }
            } else if (!descartando) {
              linha += caractere;
              if (linha.length > 256) { linha = ""; descartando = true; }
            }
          }
        });
        atual.on("error", () => {
          if (concluido) return;
          informar("erro", `Não foi possível ler ${caminho}. Confira o cabo e feche o Monitor Serial da IDE.`, caminho);
          fechar();
        });
        atual.on("close", () => {
          if (!encerrando && !concluido) informar("desconectado", `Arduino desconectado de ${caminho}. Tentando reconectar.`, caminho);
          concluir();
        });
        atual.open((erro) => {
          aberturaPendente = false;
          if (erro) {
            informar("erro", `Não foi possível abrir ${caminho}. Confira o cabo e feche o Monitor Serial da IDE.`, caminho);
            concluir();
          } else if (!ativo || fechamentoSolicitado) fechar();
          else {
            informar("sincronizando", `Porta ${caminho} aberta. Aguardando leitura do Arduino.`, caminho);
            armarLimite();
          }
        });
      } catch {
        aberturaPendente = false;
        informar("erro", `Não foi possível acessar ${caminho}.`, caminho);
        fechar();
      }
    });
  }

  async function procurar() {
    while (ativo) {
      try {
        const candidatas = portaFixa ? [{ path: portaFixa }] : selecionarPortasUsb(await ClassePorta.list(), ultimaPorta);
        if (!ativo) return;
        if (!candidatas.length) informar("aguardando", "Nenhum Arduino USB encontrado. Conecte a placa; a busca continuará automaticamente.");
        for (const candidata of candidatas) {
          if (!ativo) return;
          // Depois de perder um dispositivo confirmado, atualiza a lista antes
          // de tentar novamente: o Windows pode ter atribuído outra COM.
          if (await monitorar(candidata)) break;
        }
      } catch {
        informar("erro", "Não foi possível listar as portas USB. Tentando novamente.");
      }
      if (!ativo) return;
      await new Promise((resolver) => {
        const temporizador = setTimeout(() => { cancelarEspera = null; resolver(); }, intervaloReconexao);
        cancelarEspera = () => { clearTimeout(temporizador); cancelarEspera = null; resolver(); };
      });
    }
  }

  return {
    iniciar() {
      if (!ativo && !cancelando) {
        ativo = true;
        informar("procurando", portaFixa ? `Procurando Arduino em ${portaFixa}.` : "Procurando Arduino nas portas USB a 9600 baud.");
        tarefa = procurar();
      }
      return estadoAtual;
    },
    async finalizar() {
      ativo = false;
      cancelando = true;
      cancelarEspera?.();
      cancelarTentativa?.();
      await tarefa;
      cancelando = false;
    },
  };
}

module.exports = { interpretarLinhaArduino, criarServicoSerial };
