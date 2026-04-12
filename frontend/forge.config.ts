import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';

const config: ForgeConfig = {
  packagerConfig: {
    name: 'AIWorkflow',
    executableName: 'ai-workflow',
    asar: true,
    icon: './public/icon',
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({
      name: 'AIWorkflow',
      setupIcon: './public/icon.ico',
    }),
    new MakerZIP({}, ['darwin', 'linux']),
    new MakerDeb({
      options: {
        name: 'ai-workflow',
        productName: 'AI Workflow',
        genericName: 'Content Production',
        categories: ['Development', 'Video', 'Audio'],
      },
    }),
    new MakerDMG({
      name: 'AIWorkflow',
    }),
  ],
  plugins: [new AutoUnpackNativesPlugin({})],
  hooks: {
    generateAssets: async () => {
      // Copy backend dist files to packaged app
    },
    postPackage: async ({ outputPaths }) => {
      console.log('Packaged to:', outputPaths.appPath);
    },
  },
};

export default config;
