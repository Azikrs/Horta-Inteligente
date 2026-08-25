const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const caminho = require('node:path');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: caminho.join(__dirname, 'recursos', 'icone-horta'),
    // Mantém builds, metadados do Git e músicas pessoais fora do ASAR. As
    // dependências de produção continuam sendo coletadas normalmente pelo Forge.
    ignore: [
      /^[/\\]out(?:[/\\]|$)/,
      /^[/\\]\.git(?:[/\\]|$)/,
      // A biblioteca musical é externa e nunca acompanha o executável.
      /^[/\\]musicas(?:[/\\]|$)/i,
      /^[/\\]ferramentas(?:[/\\]|$)/,
      /^[/\\](?:README\.md|verificar-projeto\.js|\.gitignore|\.gitattributes)$/,
    ],
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'HortaInteligente',
        setupIcon: caminho.join(__dirname, 'recursos', 'icone-horta.ico'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
