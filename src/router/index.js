import { createRouter, createWebHistory } from 'vue-router'

import Login from '/src/views/Login.vue'
import Main from '/src/views/Main.vue'
import Channel from '/src/views/Channel.vue'
import ChannelBody from '/src/views/ChannelBody.vue'
import Test from '/src/views/Test.vue'

import GeneralStore from '/src/stores/GeneralStore.js'

let gst // = GeneralStore() //router.beforeEach안에서 문제가 발생해 선언만 하고 router.beforeEach안에서 처리함 (1) 참조

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

router.beforeEach((to, from) => {
    if (!gst) gst = GeneralStore() //(1)
    console.log(from.path + "********" + JSON.stringify(from.params))
    console.log(to.path + "********" + JSON.stringify(to.params))
    if (to.path.startsWith("/main/channel/chan_body")) {
        const arr = to.path.split("/")
        if (arr.length >= 6) { //=>/main/channel/chan_body/20250122084532918913033401/20250120084532918913033423
            gst.selChanId = arr[4]
            gst.selGrId = arr[5]
            console.log(gst.selChanId+ "********" + gst.selGrId)
        }
    }
    return true
})

export default router
