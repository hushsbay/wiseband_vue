import { createRouter, createWebHistory } from 'vue-router'

import Login from '/src/views/Login.vue'
import Main from '/src/views/Main.vue'
import HomePanel from '/src/views/HomePanel.vue'
import DmPanel from '/src/views/DmPanel.vue'
import ActivityPanel from '/src/views/ActivityPanel.vue'
import LaterPanel from '/src/views/LaterPanel.vue'
import FixedPanel from '/src/views/FixedPanel.vue'
import GroupPanel from '/src/views/GroupPanel.vue'
import MsgList from '/src/views/MsgList.vue'
import UserList from '/src/views/UserList.vue'

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
            path: '/body/msglist/:chanid/:msgid', //새창에서 열기 (사이드 및 패널 없음)
            name: 'msglist',
            component: MsgList
        },
        { //path와 param는 같이 사용하지 못함. name 이용해야 함
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
                            path: 'home_body/:chanid/:msgid', //msgid 있으면 안읽은 메시지. 0이면 모두 읽은 것임
                            name: 'home_body',
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
                            path: 'dm_body/:chanid/:msgid', //msgid 있으면 안읽은 메시지. 0이면 모두 읽은 것임
                            name: 'dm_body',
                            component: MsgList,
                        }
                    ]                  
                },
                {                    
                    path: 'activity',
                    name: 'activity',
                    component: ActivityPanel,
                    children: [
                        {
                            path: 'activity_body/:chanid/:msgid', //msgid 있으면 안읽은 메시지. 0이면 모두 읽은 것임
                            name: 'activity_body',
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
                            name: 'later_body',
                            component: MsgList,
                        }
                    ]                  
                },
                {                    
                    path: 'fixed',
                    name: 'fixed',
                    component: FixedPanel,
                    children: [
                        {
                            path: 'fixed_body/:chanid/:msgid',
                            name: 'fixed_body',
                            component: MsgList,
                        }
                    ]                  
                },
                {                    
                    path: 'group',
                    name: 'group',
                    component: GroupPanel,
                    children: [
                        {
                            path: 'group_body/:grid',
                            name: 'group_body',
                            component: UserList,
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
    //console.log("from.path: " + from.path + " : " + JSON.stringify(from.params) + " : " + JSON.stringify(from.query))
    //console.log("to.path: " + to.path + " : " + JSON.stringify(to.params) + " : " + JSON.stringify(from.query))
    if (from.path == "/" && to.path.startsWith("/main/home/home_body/")) {
        console.log("chk) redirect to home")
        return { path: '/main/home', query : { ver : Math.random() }}
    } else if ( //아래는 from,to가 반대로 호출되고 있어 MsgList에 표시되지 않은 경우가 많은데 여기서 막아주면 문제없음 (현재까지 대안 못찾음)
        (from.path.startsWith("/main/home/home_body/") && to.path == ("/main/home")) ||
        (from.path.startsWith("/main/dm/dm_body/") && to.path == ("/main/dm")) ||
        (from.path.startsWith("/main/activity/activity_body/") && to.path == ("/main/activity")) ||
        (from.path.startsWith("/main/later/later_body/") && to.path == ("/main/later")) ||
        (from.path.startsWith("/main/fixed/fixed_body/") && to.path == ("/main/fixed")) ||
        (from.path.startsWith("/main/group/group_body/") && to.path == ("/main/group")) 
    ) {
        console.log(from.path + " -> " + to.path) //새로고침, 새창에서열기 등 
        return false //MsgList.vue의 $$76 참조
    }
    return true
})

export default router
