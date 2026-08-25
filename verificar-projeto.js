"use strict";

const arquivos = require("node:fs");
const caminho = require("node:path");
const { spawnSync } = require("node:child_process");

const diretorioProjeto = __dirname;
const arquivosObrigatorios = [
  "index.html",
  "estilos.css",
  "aplicativo.js",
  "precarregamento.js",
  "configuracoes-aplicativo.js",
  "biblioteca-musical.js",
  "configuracoes.js",
  "simulador.js",
  "sons.js",
  "interface-sistema.js",
  "estacao.js",
  "inicializacao.js",
  "principal.js",
  "recursos/icone-horta.ico",
  "package.json",
  "package-lock.json",
  "forge.config.js",
];

const ausentes = arquivosObrigatorios.filter(
  (nomeArquivo) => !arquivos.existsSync(caminho.join(diretorioProjeto, nomeArquivo)),
);

if (ausentes.length) {
  console.error(`Arquivos obrigatórios ausentes:\n- ${ausentes.join("\n- ")}`);
  process.exitCode = 1;
  return;
}

const arquivosJavaScript = arquivosObrigatorios.filter((nome) => nome.endsWith(".js"));
for (const nomeArquivo of arquivosJavaScript) {
  const resultado = spawnSync(
    process.execPath,
    ["--check", caminho.join(diretorioProjeto, nomeArquivo)],
    { encoding: "utf8" },
  );
  if (resultado.status !== 0) {
    console.error(`Falha de sintaxe em ${nomeArquivo}:`);
    console.error(resultado.stderr.trim());
    process.exitCode = 1;
  }
}

const html = arquivos.readFileSync(caminho.join(diretorioProjeto, "index.html"), "utf8");
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((correspondencia) => correspondencia[1]);
const idsDuplicados = [...new Set(ids.filter((id, indice) => ids.indexOf(id) !== indice))];
if (idsDuplicados.length) {
  console.error(`IDs duplicados no HTML: ${idsDuplicados.join(", ")}`);
  process.exitCode = 1;
}

const elementosAudio = [...html.matchAll(/<audio\b/gi)];
if (elementosAudio.length !== 1 || !html.includes('id="audio-estacao"')) {
  console.error("A Estação deve possuir exatamente um elemento de áudio central.");
  process.exitCode = 1;
}

const fontesAudioRenderer = [
  "sons.js",
  "estacao.js",
  "inicializacao.js",
  "interface-sistema.js",
]
  .map((nome) => arquivos.readFileSync(caminho.join(diretorioProjeto, nome), "utf8"))
  .join("\n");
if (/\bnew\s+Audio\s*\(|createElement\s*\(\s*["']audio["']\s*\)/i.test(fontesAudioRenderer)) {
  console.error("Foi encontrado um segundo player de áudio criado por JavaScript.");
  process.exitCode = 1;
}

const pacote = JSON.parse(arquivos.readFileSync(caminho.join(diretorioProjeto, "package.json"), "utf8"));
if (pacote.main !== "aplicativo.js" || pacote.scripts?.start !== "electron-forge start") {
  console.error("O ponto de entrada ou o comando npm start do Electron está incorreto.");
  process.exitCode = 1;
}

const fontesSemDependencias = [
  "index.html",
  "estacao.js",
  "configuracoes.js",
  "configuracoes-aplicativo.js",
].map((nome) => arquivos.readFileSync(caminho.join(diretorioProjeto, nome), "utf8")).join("\n");
if (/crossfade|fade entre músicas/i.test(fontesSemDependencias)) {
  console.error("A lógica antiga de crossfade ainda aparece no player ou nas configurações.");
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`Projeto verificado: ${arquivosObrigatorios.length} arquivos presentes e ${arquivosJavaScript.length} scripts válidos.`);
}
