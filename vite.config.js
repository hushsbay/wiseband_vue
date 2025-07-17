import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
// export default defineConfig({
//   plugins: [
//     vue(),
//     vueDevTools(),
//   ],
//   resolve: {
//     alias: {
//       '@': fileURLToPath(new URL('./src', import.meta.url))
//     }
//   }
// })

//https://dimorin.tistory.com/entry/Vite-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8-%EC%84%A4%EC%A0%95-%ED%8C%8C%EC%9D%BC-viteconfigjs
export default defineConfig(({ mode }) => {
    return {
        plugins: [
            vue(),
            vueDevTools(),
        ],
        resolve: {
            alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
            }
        },
        publicPath: mode == 'production' ? '/' : '/'
    }
})
