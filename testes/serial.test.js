"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { setTimeout: esperar } = require("node:timers/promises");
const { interpretarLinhaArduino, criarServicoSerial } = require("../serial-arduino");
const linha = "UMIDADE = 40%; BRUTO = 416; BOMBA = 1; LEITURAS = 108";

test("interpreta o firmware real sem inventar iluminação ou RTC", () => {
  const dados = interpretarLinhaArduino(`${linha}\r`, "COM7");
  assert.equal(dados.umidadeSolo, 40);
  assert.equal(dados.valorBrutoSensor, 416);
  assert.equal(dados.bombaLigada, true);
  assert.equal(dados.numeroLeitura, 108);
  assert.equal(dados.estadoArduino.porta, "COM7");
  for (const campo of ["iluminacaoLigada", "horarioRtc", "horarioIluminacaoInicio", "horarioIluminacaoFim"]) assert.equal(dados[campo], null);
  assert.equal(interpretarLinhaArduino(linha.replace("BOMBA = 1", "BOMBA = 0"), "COM7").bombaLigada, false);
  assert.equal(interpretarLinhaArduino(linha.replace("108", "-32768"), "COM7").numeroLeitura, -32768);
});

test("interpreta o formato textual observado no Arduino Uno em COM3", () => {
  const recebida = "BOMBA = DESLIGADA; UMIDADE = 99%; BRUTO = 1014; LEITURAS = 4\r";
  const dados = interpretarLinhaArduino(recebida, "COM3");
  assert.equal(dados.bombaLigada, false);
  assert.equal(dados.umidadeSolo, 99);
  assert.equal(dados.valorBrutoSensor, 1014);
  assert.equal(dados.numeroLeitura, 4);
  assert.equal(dados.estadoArduino.porta, "COM3");
  assert.equal(interpretarLinhaArduino(recebida.replace("DESLIGADA", "LIGADA"), "COM3").bombaLigada, true);
  assert.equal(interpretarLinhaArduino("LEITURAS = 5; BOMBA = 0; BRUTO = 770; UMIDADE = 75%", "COM3").bombaLigada, false);
});

test("ignora o scanner I2C e rejeita estado de bomba ausente ou ambíguo", () => {
  for (const invalida of [
    "Procurando dispositivos I2C...", "Dispositivo encontrado: 0x27", "Busca finalizada!",
    "; UMIDADE = 75%; BRUTO = 770; LEITURAS = 5",
    "BOMBA = DESLIGADA; UMIDADE = 75%; BRUTO = 770; BOMBA = LIGADA",
    "BOMBA = DESCONHECIDA; UMIDADE = 75%; BRUTO = 770; LEITURAS = 5",
  ]) assert.equal(interpretarLinhaArduino(invalida, "COM3"), null);
});

test("descarta mensagens incompletas, corrompidas e fora da faixa", () => {
  for (const invalida of ["", "UMIDBOMBA = 1; LEITURAS = 104", linha.slice(0, 28), linha.replace("40%", "140%"), linha.replace("416", "1024"), linha.replace("BOMBA = 1", "BOMBA = 2"), `${linha}; LIXO`, linha.replace("108", "999999999999999999999")]) {
    assert.equal(interpretarLinhaArduino(invalida, "COM7"), null);
  }
});

function prepararServico(opcoes = {}) {
  const portas = [];
  const eventos = [];
  class PortaTeste extends EventEmitter {
    constructor(configuracao) { super(); this.configuracao = configuracao; this.isOpen = false; portas.push(this); }
    open(callback) { this.isOpen = true; callback(); }
    close(callback) { this.isOpen = false; this.emit("close"); callback?.(); }
  }
  const servico = criarServicoSerial({ publicar: (evento) => eventos.push(evento), ClassePorta: PortaTeste, caminhoPorta: "COM_TESTE", intervaloReconexao: 10, ...opcoes });
  return { portas, eventos, servico };
}

test("remonta fragmentos, separa rajadas e limita linhas sem delimitador", async () => {
  const { portas, eventos, servico } = prepararServico();
  servico.iniciar();
  servico.iniciar();
  assert.equal(portas.length, 1);
  assert.equal(portas[0].configuracao.baudRate, 9600);
  portas[0].emit("data", Buffer.from(linha.slice(0, 20)));
  assert.equal(eventos.filter((e) => e.tipo === "leitura").length, 0);
  portas[0].emit("data", Buffer.from(`${linha.slice(20)}\r\n${linha.replace("108", "109")}\n`));
  portas[0].emit("data", Buffer.from(`${"x".repeat(1000)}${linha}\n${linha.replace("108", "110")}\n`));
  assert.deepEqual(eventos.filter((e) => e.tipo === "leitura").map((e) => e.dados.numeroLeitura), [108, 109, 110]);
  await servico.finalizar();
  assert.equal(portas[0].isOpen, false);
});

test("sincroniza com mensagens textuais fragmentadas após o scanner I2C", async () => {
  const { portas, eventos, servico } = prepararServico();
  servico.iniciar();
  try {
    portas[0].emit("data", Buffer.from("Procurando dispositivos I2C...\r\nDispositivo encontrado: 0x27\r\nBusca finalizada!\r\n"));
    assert.equal(eventos.filter(e => e.tipo === "leitura").length, 0);
    const mensagem = "BOMBA = DESLIGADA; UMIDADE = 99%; BRUTO = 1014; LEITURAS = 4\r\n";
    for (let i = 0; i < mensagem.length; i += 4) portas[0].emit("data", Buffer.from(mensagem.slice(i, i + 4)));
    assert.equal(eventos.filter(e => e.tipo === "leitura").length, 1);
    assert.equal(eventos.at(-1).dados.bombaLigada, false);
    assert.ok(eventos.some(e => e.dados.estado === "conectado"));
  } finally { await servico.finalizar(); }
});

test("reconecta após desconectar e cancela tentativas ao encerrar", async () => {
  const { portas, eventos, servico } = prepararServico();
  servico.iniciar();
  portas[0].close();
  await esperar(40);
  assert.equal(portas.length, 2);
  assert.ok(eventos.some((e) => e.dados.estado === "desconectado"));
  portas[1].emit("data", Buffer.from(`${linha}\n`));
  assert.equal(eventos.at(-1).tipo, "leitura");
  await servico.finalizar();
  await esperar(30);
  assert.equal(portas.length, 2);
});

test("porta ocupada informa erro e tenta novamente sem gerar leituras", async () => {
  let tentativas = 0;
  class PortaOcupada extends EventEmitter {
    open(callback) { tentativas++; callback(new Error("Access denied")); }
  }
  const { eventos, servico } = prepararServico({ ClassePorta: PortaOcupada });
  servico.iniciar();
  await esperar(40);
  await servico.finalizar();
  assert.ok(tentativas >= 2);
  assert.ok(eventos.some((e) => e.dados.estado === "erro" && e.dados.mensagem.includes("Monitor Serial")));
  assert.equal(eventos.filter((e) => e.tipo === "leitura").length, 0);
});
