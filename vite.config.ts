import unocssPlugin from "unocss/vite";
import { defineConfig, loadEnv } from 'vite';
import solidPlugin from 'vite-plugin-solid';
// import AutoImport from 'unplugin-auto-import/vite'
// import IconsResolver from 'unplugin-icons/resolver'
// vite.config.js
// import Icons from 'unplugin-icons/vite'
import { VitePWA } from 'vite-plugin-pwa'


export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  return {
    plugins: [
      unocssPlugin(),
      solidPlugin(),
      VitePWA({
        injectRegister: false,
        fileName: 'manifest.webmanifest',
        publicPath: '/',
        basePath: '/assets/',
        selfDestroying: true,
        workbox: {
          runtimeCaching: []
        },
        manifest: {
          id: "ostore",
          name: "OStore",
          short_name: "OStore",
          description: "Orange app store for kaios 3.1",
          lang: "en-US",
          theme_color: "#FFFFFF",
          orientation: "natural",
          start_url: "/index.html",
          display: "standalone",
          icons: [
            {
              src: "/ostore_56.png",
              type: "image/png",
              sizes: "56x56"
            },
            {
              src: "/ostore_112.png",
              type: "image/png",
              sizes: "112x112"
            }
          ],
          b2g_features: {
            // type: "privileged",
            permissions: {
              "device-storage:sdcard": { access: "readwrite" },
              "systemXHR": {},
            },
            version: env.VITE_APP_VERSION,
            origin: "ostore"
          }
        }
      }),
    ],
    server: {
      port: 3000,
      proxy: {
        '/proxy': {
          target: 'https://dl-ostore.yexm.eu.org/',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/proxy/, ''),
        },
        '/appscmd': {
          target: 'http://127.0.0.1:5431/',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/appscmd/, ''),
        },
      }
    },
    build: {
      target: 'esnext',
    },
  }
});
