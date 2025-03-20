import { createRouter, createWebHistory } from 'vue-router'

import Login from '/src/views/Login.vue'
import Main from '/src/views/Main.vue'
import Home from '/src/views/Home.vue'
import HomeBody from '/src/views/HomeBody.vue'
import Test from '/src/views/Test.vue'

import GeneralStore from '/src/stores/GeneralStore.js'

let gst // = GeneralStore() //router.beforeEach안에서 문제가 발생해 선언만 하고 router.beforeEach안에서 처리함 아래 (1) 참조

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
                    path: 'home',
                    component: Home,
                    children: [
                        {
                            path: 'home_body/:grid/:chanid', //params 순서 유의 (아래 beforeEach arr[] 참조)
                            name: 'home_body', //path와 param는 같이 사용하지 못함. name 이용해야 함
                            component: HomeBody                            
                        }
                    ]
                },
                {
                    path: 'test',
                    component: Test,
                }
            ]
        }        
    ],
    //scrollBehavior는 포기 : 구현 못함 : overflow:hidden 빼면 가능하다고 하나 구현어려움
    //대신 keppalive로 되어 있는 Home 및 HomeBody에서 필요하므로 Activate/Deactivated hook에서 처리해 보고자 함
})

router.beforeEach((to, from) => { //keepalive시 Mounted hook은 처음 말고는 안먹혀도 여기 beforeEach와 Activeted/Deactivated는 먹힘
    if (!gst) gst = GeneralStore() //(1)
    //console.log("from.path: " + from.path + " *** " + JSON.stringify(from.params)) 
    //console.log("to.path: " + to.path + " *** " + JSON.stringify(to.params))
    const arr = to.path.split("/")
    if (to.path.startsWith("/main/home")) {
        gst.selSideMenu = "mnuHome" //향후, 나중에, 내활동 구현시 이 부분 개선하기. 나중에 첫글자 대문자 치환으로 하드코딩 제거 코딩하기 (그리 많지 않으면 그냥 둬도 무방)
        if (to.path == "/main/home") {
            //gst.selSideMenuTimeTag = "/main/home: " + (new Date()).toString() ##87
        } else if (to.path.startsWith("/main/home/home_body")) {            
            if (arr.length >= 6) { //=>/main/home/home_body/20250120084532918913033423/20250122084532918913033401
                gst.selGrId = arr[4]
                gst.selChanId = arr[5]                
            }
        }
    }
    return true
})

export default router
