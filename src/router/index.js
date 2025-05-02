import { createRouter, createWebHistory } from 'vue-router'

import Login from '/src/views/Login.vue'
import Main from '/src/views/Main.vue'
import HomePanel from '/src/views/HomePanel.vue'
import DmPanel from '/src/views/DmPanel.vue'
import LaterPanel from '/src/views/LaterPanel.vue'
import MsgList from '/src/views/MsgList.vue'

//import GeneralStore from '/src/stores/GeneralStore.js'
//let gst // = GeneralStore() //router.beforeEach안에서 문제가 발생해 필요시 선언만 하고 router.beforeEach안에서 처리함 아래 (1) 참조

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
            path: '/body/msglist/:chanid/:msgid',
            name: 'msglist',
            component: MsgList
        },
        {
            path: '/main',
            name: 'main',
            component: Main,
            children: [
                {                    
                    path: 'home',
                    name: 'home',
                    component: HomePanel,
                    children: [
                        {
                            path: 'home_body/:chanid',
                            name: 'home_body', //path와 param는 같이 사용하지 못함. name 이용해야 함
                            component: MsgList,
                        }
                    ]
                },
                {                    
                    path: 'dm',
                    name: 'dm',
                    component: DmPanel,
                    children: [
                        {
                            path: 'dm_body/:chanid',
                            name: 'dm_body', //path와 param는 같이 사용하지 못함. name 이용해야 함
                            component: MsgList,
                        }
                    ]                  
                },
                {                    
                    path: 'later',
                    name: 'later',
                    component: LaterPanel,
                    children: [
                        {
                            path: 'later_body/:chanid/:msgid',
                            name: 'later_body', //path와 param는 같이 사용하지 못함. name 이용해야 함
                            component: MsgList,
                        }
                    ]                  
                }
            ]
        }        
    ],
    //scrollBehavior는 포기 : overflow:hidden 빼면 가능하다고 하나 구현 어려움
    //대신 keepalive + onscrollend + onActivated hook에서 더 자유도 높게 해결함
})

router.beforeEach((to, from) => { //keepalive시 Mounted hook은 처음 말고는 안 먹혀도 여기 beforeEach와 Activeted/Deactivated는 먹힘
    //if (!gst) gst = GeneralStore() //(1)
    console.log("from.path: " + from.path + " : " + JSON.stringify(from.params) + " : " + JSON.stringify(from.query))
    console.log("to.path: " + to.path + " : " + JSON.stringify(to.params) + " : " + JSON.stringify(from.query))
    if (from.path == "/" && to.path.startsWith("/main/home/home_body/")) {
        console.log("chk) redirect to home")
        return { path: '/main/home', query : { ver : Math.random() }}
    } 
    //아래는 from,to가 반대로 호출되고 있어서 여기서 흐름을 막아주면 문제없음 (현재까지 대안 못찾음)
    if (from.path.startsWith("/main/home/home_body/") && to.path == ("/main/home")) {
        console.log("chk) home_body -> home") //새창에서 열기시 
        return false //MsgList.vue의 $$76 참조
    } else if (from.path.startsWith("/main/later/later_body/") && to.path == ("/main/later")) {
        console.log("chk) later_body -> later") //새창에서 열기시 
        return false //MsgList.vue의 $$76 참조
    } else if (from.path.startsWith("/main/dm/dm_body/") && to.path == ("/main/dm")) {
        console.log("chk) dm_body -> dm") //새창에서 열기시 
        return false //MsgList.vue의 $$76 참조
    }
    return true
})

export default router
