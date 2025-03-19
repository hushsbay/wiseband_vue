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
                            path: 'home_body/:chanid/:grid',
                            name: 'home_body', //path와 param는 같이 사용하지 못하므로 name 이용해야 함
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
    ]
})

router.beforeEach((to, from) => {
    if (!gst) gst = GeneralStore() //(1)
    //console.log("from.path: " + from.path + "********" + JSON.stringify(from.params)) //console.log("to.path: " + to.path + "********" + JSON.stringify(to.params))
    const arr = to.path.split("/")
    if (to.path.startsWith("/main/home")) {
        gst.selSideMenu = "mnuHome" //나중에 첫글자 대문자 치환으로 하드코딩 제거 코딩하기 (그리 많지 않으면 그냥 둬도 무방)
        if (to.path == "/main/home") {
            //gst.selSideMenuTimeTag = "/main/home: " + (new Date()).toString() ##87
        } else if (to.path.startsWith("/main/home/home_body")) {            
            if (arr.length >= 6) { //=>/main/home/home_body/20250122084532918913033401/20250120084532918913033423
                gst.selChanId = arr[4]
                gst.selGrId = arr[5]
                // setTimeout(() => {
                //     //debugger (scrollBehavior는 포기 - overflow:hidden 빼면 가능?!)
                //     const ele = document.getElementById("chan_center_body") //beforeLeave가 있으면 그걸로 기억할 수 있을 것임
                //     ele.scrollTo({ top: 400 })
                // }, 2000)
            }
        }
    }
    return true
})

export default router
