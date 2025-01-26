import { createRouter, createWebHistory } from 'vue-router'

import Login from '/src/views/Login.vue'
import Main from '/src/views/Main.vue'
import Channel from '/src/views/Channel.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL), //import.meta.env.BASE_URL => /로 표시됨
    routes: [
        {
            path: '/',
            redirect: '/main'
        },
        {
            path: '/main',
            name: 'main',
            component: Main,
            children: [
                {                    
                    path: 'channel',
                    component: Channel,
                //   children: [
                //         {                    
                //             path: 'menu0002_right',
                //             component: Menu0002Right,
                //         }
                //     ],
                }
            ],
        },
        {
            path: '/login',
            name: 'login',
            component: Login
        }
    ]
})

export default router
