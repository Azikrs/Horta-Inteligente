"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { setTimeout: esperar } = require("node:timers/promises");
const { criarServicoSerial } = require("../serial-arduino");
const mensagem = Buffer.from("UMIDADE = 40%; BRUTO = 416; BOMBA = 1; LEITURAS = 108\r\n");
const usb = (path, extras = {}) => ({ path, vendorId: "1234", ...extras });

async function aguardar(condicao) {
  const limite = Date.now() + 2000;
  while (!condicao()) {
    if (Date.now() > limite) assert.fail("Condição não atendida a tempo");
    await esperar(5);
  }
}

function preparar(t, { listar, aoAbrir = () => {}, ...opcoes }) {
  const portas = [];
  const eventos = [];
  class Porta extends EventEmitter {
    static list = listar;
    constructor(configuracao) { super(); this.path = configuracao.path; this.isOpen = false; portas.push(this); }
    open(callback) { aoAbrir(this, (erro) => { this.isOpen = !erro; callback(erro); }); }
    close(callback) { this.isOpen = false; this.emit("close"); callback?.(); }
    enviar() { this.emit("data", mensagem); }
  }
  const servico = criarServicoSerial({ publicar: e => eventos.push(e), ClassePorta: Porta, caminhoPorta: "", intervaloReconexao: 10, tempoSemLeitura: 100, ...opcoes });
  t.after(() => servico.finalizar());
  return { servico, portas, eventos, leituras: () => eventos.filter(e => e.tipo === "leitura") };
}

test("encontra Arduino fora da COM7 e ignora portas internas e Bluetooth", async t => {
  const teste = preparar(t, {
    listar: async () => [{ path: "COM1", pnpId: "ACPI" }, { path: "COM3", pnpId: "PCI" }, { path: "COM4", pnpId: "BTHENUM" }, usb("COM12")],
    aoAbrir: (porta, concluir) => { concluir(); porta.enviar(); },
  });
  teste.servico.iniciar();
  teste.servico.iniciar();
  await aguardar(() => teste.leituras().length === 1);
  assert.deepEqual(teste.portas.map(p => p.path), ["COM12"]);
  assert.equal(teste.leituras()[0].dados.estadoArduino.porta, "COM12");
});

test("ignora porta ocupada e dispositivo com mensagens de outro protocolo", async t => {
  const teste = preparar(t, {
    listar: async () => [usb("COM5"), usb("COM8"), usb("COM11")],
    aoAbrir: (porta, concluir) => {
      if (porta.path === "COM5") return concluir(new Error("Access denied"));
      concluir();
      if (porta.path === "COM8") porta.emit("data", Buffer.from("OUTRO_DISPOSITIVO=OK\n"));
      else porta.enviar();
    },
  });
  teste.servico.iniciar();
  await aguardar(() => teste.leituras().length > 0);
  assert.deepEqual(teste.portas.map(p => p.path), ["COM5", "COM8", "COM11"]);
  assert.equal(teste.portas[1].isOpen, false);
  assert.equal(teste.leituras()[0].dados.estadoArduino.porta, "COM11");
  assert.deepEqual(teste.eventos.filter(e => e.dados.estado === "conectado").map(e => e.dados.porta), ["COM11"]);
});

test("encontra placa conectada depois da inicialização e reconecta em outra COM", async t => {
  let lista = [];
  const teste = preparar(t, {
    listar: async () => lista,
    aoAbrir: (porta, concluir) => { concluir(); porta.enviar(); },
  });
  teste.servico.iniciar();
  await aguardar(() => teste.eventos.some(e => e.dados.estado === "aguardando"));
  lista = [usb("COM9", { serialNumber: "HORTA" })];
  await aguardar(() => teste.leituras().length === 1);
  lista = [usb("COM2"), usb("COM14", { serialNumber: "HORTA" })];
  teste.portas[0].close();
  await aguardar(() => teste.leituras().length === 2);
  assert.deepEqual(teste.portas.map(p => p.path), ["COM9", "COM14"]);
});

test("porta silenciosa não impede a descoberta e perda de leituras reinicia a busca", async t => {
  let lista = [usb("COM6"), usb("COM10")];
  const teste = preparar(t, {
    listar: async () => lista,
    aoAbrir: (porta, concluir) => { concluir(); if (porta.path !== "COM6") porta.enviar(); },
  });
  teste.servico.iniciar();
  await aguardar(() => teste.leituras().length === 1);
  lista = [usb("COM15")];
  await aguardar(() => teste.leituras().length === 2);
  assert.deepEqual(teste.portas.map(p => p.path), ["COM6", "COM10", "COM15"]);
  assert.equal(teste.portas[1].isOpen, false);
});

test("mensagens válidas mantêm a conexão sem abrir outras portas", async t => {
  const teste = preparar(t, {
    listar: async () => [usb("COM6"), usb("COM10", { vendorId: "2341" })],
    aoAbrir: (porta, concluir) => { concluir(); porta.enviar(); },
  });
  teste.servico.iniciar();
  await aguardar(() => teste.leituras().length > 0);
  const envio = setInterval(() => teste.portas[0].enviar(), 20);
  try { await esperar(250); } finally { clearInterval(envio); }
  assert.deepEqual(teste.portas.map(p => p.path), ["COM10"]);
});

test("porta manual não enumera nem tenta outras portas", async t => {
  const teste = preparar(t, {
    caminhoPorta: " COM20 ",
    listar: async () => { assert.fail("Não deve listar portas no modo manual"); },
    aoAbrir: (porta, concluir) => { concluir(); porta.enviar(); },
  });
  teste.servico.iniciar();
  await aguardar(() => teste.leituras().length > 0);
  assert.deepEqual(teste.portas.map(p => p.path), ["COM20"]);
});

test("falha temporária ao listar portas é recuperada", async t => {
  let chamadas = 0;
  const teste = preparar(t, {
    listar: async () => { if (++chamadas === 1) throw new Error("Falha temporária"); return [usb("COM8")]; },
    aoAbrir: (porta, concluir) => { concluir(); porta.enviar(); },
  });
  teste.servico.iniciar();
  await aguardar(() => teste.leituras().length > 0);
  assert.ok(teste.eventos.some(e => e.dados.estado === "erro"));
  assert.equal(teste.leituras()[0].dados.estadoArduino.porta, "COM8");
});

test("encerrar durante listagem não abre a porta quando a lista chega", async t => {
  let entregarLista;
  const teste = preparar(t, { listar: () => new Promise(r => { entregarLista = r; }) });
  teste.servico.iniciar();
  const encerramento = teste.servico.finalizar();
  entregarLista([usb("COM8")]);
  await encerramento;
  assert.equal(teste.portas.length, 0);
});

test("encerrar durante abertura fecha a porta assim que o sistema a libera", async t => {
  let concluirAbertura;
  const teste = preparar(t, {
    listar: async () => [usb("COM8")],
    aoAbrir: (_porta, concluir) => { concluirAbertura = concluir; },
  });
  teste.servico.iniciar();
  await aguardar(() => concluirAbertura);
  const encerramento = teste.servico.finalizar();
  concluirAbertura();
  await encerramento;
  assert.equal(teste.portas[0].isOpen, false);
  await esperar(30);
  assert.equal(teste.portas.length, 1);
});
