# Horta Inteligente

Software desktop local para acompanhar uma horta automatizada no CaseMod. A versão atual usa dados simulados e já mantém separadas a fonte dos dados, a validação do pacote e a interface; por isso a futura leitura Serial poderá substituir o simulador sem reconstruir o painel.

## Preparar um computador novo

Instale o [Node.js LTS](https://nodejs.org/) e o Git. O Node 24.19.0 que foi separado para o SENAC é compatível com este projeto. O Visual Studio Code é opcional para executar, mas é recomendado para editar. Depois clone o repositório pelo GitHub Desktop ou pelo Git e abra um terminal na pasta clonada.

```powershell
npm.cmd ci
npm.cmd start
```

`npm.cmd start` abre a janela Electron em tela cheia real. Não abre uma página da internet. Para sair, use `Alt + F4`.

Na primeira preparação, `npm.cmd ci` precisa de internet para baixar as dependências descritas no `package-lock.json`. Depois disso, `npm.cmd start` funciona localmente. Rode `npm.cmd ci` novamente quando `package.json` ou `package-lock.json` mudar.

Para usar apenas a simulação, não é necessário instalar Python nem a Arduino IDE. A Arduino IDE será necessária quando começar a montagem, o envio do código para o Arduino e a futura integração Serial.

## Verificar o projeto

```powershell
npm.cmd test
```

Esse comando confirma os arquivos essenciais e verifica a sintaxe dos JavaScripts sem alterar configurações ou a biblioteca musical.

## Música local

Na Estação, você pode escolher qualquer pasta externa pelo próprio aplicativo. As faixas originais não são copiadas nem enviadas para a internet; somente um índice é salvo nos dados locais do Electron.

No computador do SENAC, abra **Configurações → Estação → Alterar pasta** e selecione a pasta sincronizada pelo Drive. Se o caminho dessa pasta mudar entre computadores, basta escolhê-la novamente. As músicas e suas capas incorporadas permanecem fora do projeto e do GitHub.

## Dados atuais e Arduino futuro

Hoje, `simulador.js` cria um objeto completo e o entrega a `principal.js`. A comunicação Serial futura deverá entregar o mesmo contrato somente depois de receber um pacote válido e completo do Arduino:

```text
umidadeSolo
valorBrutoSensor
bombaLigada
iluminacaoLigada
horarioRtc
horarioIluminacaoInicio
horarioIluminacaoFim
estadoArduino (conexão, porta e recebendoDados)
ultimaAtualizacao
numeroLeitura
intervaloAtualizacao
fonteDados
```

O painel não exige LDR. A área da Grow Light apresenta o ciclo programado e o horário do RTC do circuito. Limites de umidade e horários podem ser ajustados nas Configurações.

## Arquivos principais

- `aplicativo.js`: processo principal e janela segura do Electron.
- `precarregamento.js`: ponte restrita entre Electron e interface.
- `configuracoes-aplicativo.js` e `configuracoes.js`: validação, persistência e uso das preferências.
- `biblioteca-musical.js` e `estacao.js`: índice local e player de música.
- `simulador.js`: fonte temporária de dados da horta.
- `principal.js`: contrato, validação e atualização do painel.
- `interface-sistema.js`: navegação, temas, Configurações e overlays.
- `sons.js`: identidade sonora sintetizada localmente.

## Checklist para levar ao SENAC

Antes de sair de casa:

1. confira no GitHub Desktop se todos os arquivos-fonte desta versão foram adicionados ao commit;
2. faça o commit e o `Push origin`;
3. confirme no site do GitHub que arquivos como `estacao.js`, `sons.js`, `biblioteca-musical.js`, `precarregamento.js` e `package-lock.json` aparecem no repositório;
4. se quiser um plano B no pendrive, faça um clone novo ou baixe o ZIP do GitHub depois do push.

No computador do SENAC:

```powershell
npm.cmd ci
npm.cmd test
npm.cmd start
```

Não copie a pasta atual inteira para o pendrive. `node_modules/`, `out/` e o histórico `.git/` local são grandes e reproduzíveis; um clone novo é menor e comprova que o projeto não depende de arquivos escondidos no seu computador.

## Git e builds

O código-fonte, o `package-lock.json`, os ícones e este guia devem ir para o GitHub. Não envie `node_modules/`, `out/`, bibliotecas musicais pessoais ou instaladores. Esses itens são grandes ou reproduzíveis e continuam protegidos pelo `.gitignore`.

Para gerar um build futuramente, use `npm.cmd run make`. O diretório `out/` gerado continua fora do GitHub.
