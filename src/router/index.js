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

router.beforeEach((to, from) => {
    //if (!gst) gst = GeneralStore() //참조 (1)
    console.log("## from.path: " + from.path + " : " + JSON.stringify(from.params) + " : " + JSON.stringify(from.query))
    console.log("## to.path: " + to.path + " : " + JSON.stringify(to.params) + " : " + JSON.stringify(from.query))
    //아래 return false를 안막으면 두번 이상 실행되는데 원인을 모르는 것이 많음
    //keepalive시 Mounted hook은 처음 말고는 안 먹혀도 여기 beforeEach와 Activeted/Deactivated는 먹힘을 유의 (그래서 onMounted()가 2회 수행되는 수도 있을 것임)
    //각 vue의 gst.util.chkOnMountedTwice() 참조 - onMounted가 2회 이상 실행되어 막음 (Hot Deploy가 원인일 수도 있어 운영에서 체크 필요)
    if (from.path.includes("_body/")) {
        if (from.path == to.path) {
            //예1) 새로고침시 1) MsgList->MsgList 2) /->MsgList가 기본적으로 라우팅되는데 그걸 1)은 막고 2)는 /->Panel로 라우팅되게 함
            //예2) DmPanel에서 각 Dm방 클릭시 onMounted() 두번 호출됨 - Hot Deploy + v-for + ref인 경우 2번 호출된다고는 하는데 운영에서 체크해봐야 함
            console.log('body -> body (새로고침 등으로 같은 body : 안막으면 onMounted 두번 호출됨)')
            return false
        } else {
            const arr = from.path.split("/")
            const fromPath2 = "/" + arr[1] + "/" + arr[2]
            if (to.path == fromPath2) {
                console.log('body -> panel (새로고침 등으로 body에서 panel을 호출하는 것은 막음)')
                return false
            }
        }
    } else if (from.path == "/" && to.path.includes("_body/")) {
        const arr = to.path.split("/")
        const realTo = "/" + arr[1] + "/" + arr[2]
        console.log('root -> body 라우팅을 root -> ' + realTo + '(패널)로 변경 : 변경안하면 멈춤')
        return { path: realTo }
    }
    return true
})

export default router
