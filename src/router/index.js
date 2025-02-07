import { createRouter, createWebHistory } from 'vue-router'

import Login from '/src/views/Login.vue'
import Main from '/src/views/Main.vue'
import Channel from '/src/views/Channel.vue'
import ChannelBody from '/src/views/ChannelBody.vue'
import Test from '/src/views/Test.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL), //import.meta.env.BASE_URL => /로 표시됨
    routes: [
        {
            path: '/',
            redirect: '/main'
        },
        {
            path: '/login',
            name: 'login',
            component: Login
        },
        {
            path: '/main',
            name: 'main',
            component: Main,
            children: [
                {                    
                    path: 'channel',
                    component: Channel,
                    children: [
                        {                    
                            path: 'chan_body/:chanid/:grid',
                            name: 'chan_body', //path와 param는 같이 사용하지 못하므로 name 이용해야 함
                            component: ChannelBody
                        }
                    ]
                },
                {
                    path: 'test',
                    component: Test,
                }
            ]
        }        
    ]
})

export default router
