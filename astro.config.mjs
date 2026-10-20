// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  site: 'https://tokenwatt.netlify.app',

  vite: {
    plugins: [tailwindcss()]
  },

  // Polices auto-hébergées : téléchargées au build, servies depuis le site (font-display: swap)
  fonts: [
    { provider: fontProviders.google(), name: 'Unbounded', cssVariable: '--font-unbounded', weights: [200, 600], styles: ['normal'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'Manrope', cssVariable: '--font-manrope', weights: [400, 700], styles: ['normal'], fallbacks: ['sans-serif'] },
    { provider: fontProviders.google(), name: 'JetBrains Mono', cssVariable: '--font-jetbrains', weights: [400, 600], styles: ['normal'], fallbacks: ['monospace'] },
  ],

  adapter: netlify()
});
