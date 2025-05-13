const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    icon: './20250512_0950_Capybara Filmmaker Cartoon_simple_compose_01jv1bh6aaf3980pm19f1vc0za.png'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
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
    {
      name: '@electron-forge/maker-dmg',
      config: {
        background: './20250512_0950_Capybara Filmmaker Cartoon_simple_compose_01jv1bh6aaf3980pm19f1vc0za.png',
        format: 'ULFO',
        icon: './20250512_0950_Capybara Filmmaker Cartoon_simple_compose_01jv1bh6aaf3980pm19f1vc0za.png',
        name: 'Cappy',
        overwrite: true,
        contents: [
          {
            x: 448,
            y: 344,
            type: 'link',
            path: '/Applications'
          },
          {
            x: 192,
            y: 344,
            type: 'file',
            path: '${src}'
          }
        ]
      }
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
