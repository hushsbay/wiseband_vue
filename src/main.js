import '/src/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueCookies from "vue-cookies"
import { VueQueryPlugin } from '@tanstack/vue-query'
import axios from 'axios'
//import Vue3Sanitize  from 'vue-3-sanitize'

import App from '/src/App.vue'
import router from '/src/router'

import hush from '/src/stores/Common.js'
import GeneralStore from '/src/stores/GeneralStore.js'

let hostnameStr = "", domainStr = ""
if (location.href.startsWith("http://localhost")) {
    hostnameStr = "localhost"
    domainStr = location.protocol + "//" + hostnameStr + ":3000" //nest port
} else {
    hostnameStr = "hushsbay.com"
    domainStr = location.protocol + "//" + hostnameStr + ":" + location.port
}

const vueQueryPluginOptions = {
    queryClientConfig: {
        defaultOptions: { 
            queries: { 
                //gcTime: 1000 * 60, //1분
                //cacheTime: 1000 * 30, //30초. inactive부터 산정됨
                staleTime: 0 
                //1) Home.vue에서 keep-alive제거하고 gcTime,cacheTime 막은 상태(기본)에서 즉시(0)로 하면 뒤로가기시 무한스크롤 맨 마지막에 여러번 호출해서 데이터 뿌려주긴 하나 깜빡임이 많음
                //   - 30초로 하니 무한스크롤도 아닌 첫페이지만 가져옴
                //2) Home.vue에서 keep-alive 넣고 gcTime,cacheTime 막은 상태(기본)에서 즉시(0)로 하면 뒤로가기시 기존 데이터 그대로 지켜줌
                //   - 하지만, 그동안 서버에서 수정한 데이터가 자동으로 반영되지 않아서 이 부분은 소켓이든 뭐든 업데이트 하는 루틴이 필요해 보임
                //슬랙은 뒤로가기시 기존 데이터가 그대로 보이므로 (그 사이 다른 사용자가 수정한 데이터나 추가된 데이터가 반영되어야 함) 그대로 따라 하려면 keep alive써야 하는데
                //keep-alive 쓰는 상황에서는 vue-query가 의미없어 보임 (사용자 입장에서는 화면은 번쩍이지 않게 직전 데이터를 모두 보여줘야 하고 업데이트도 되어 있어야 함)
            }
        }
    }
}

const app = createApp(App) 
app.config.globalProperties.axios = axios //global로 설정했음에도 각 .vue마다 axios import하지 않고는 axios or this.axios로 호출시 오류 발생!?
app.use(createPinia())
app.use(router)
app.use(VueCookies, { path : '/', domain : hostnameStr, secure : true, sameSite : 'none' }) //none(모든 도메인에 쿠키가 전송), strict(동일한 사이트 내의 요청에만 전송)
//const overridenOptions = { allowedTags: ['span'] }
//app.use(Vue3Sanitize, overridenOptions)
app.use(VueQueryPlugin, vueQueryPluginOptions)
app.mount('#app')

const gst = GeneralStore() //app위로 올리지 말기

axios.defaults.baseURL = domainStr //https://cokes.tistory.com/123, https://inpa.tistory.com/entry/AXIOS-%F0%9F%93%9A-CORS-%EC%BF%A0%ED%82%A4-%EC%A0%84%EC%86%A1withCredentials-%EC%98%B5%EC%85%98
axios.defaults.withCredentials = true //localhost 2개의 다른 포트시 쿠키 전송안되는 것은 nest main.ts enableCors()도 필요
axios.interceptors.request.use(
    function (config) {
        gst.util.setToast(hush.cons.toastMsg, true) //clear는 axios response interceptor에 구현해도 되나 chkAxiosCode in gst에 이미 구현되어 있어 그대로 둠
        return config
    }, function (error) { 
        return Promise.reject(error) 
    }
)

app.config.errorHandler = (err, instance, info) => {
    //click event에서 router.push({ path : "./Wisepush" })시 router 객체 import를 일부러 막고 Exception 발생시 아래와 같았음
    //1) err.message, err.stack 2) instance는 Target이 _pStores {main: Proxy}로 나오는데 현재 사용할 케이스를 찾지 못함 3) info는 "native event handler"로 나옴
    gst.util.setSnack(err, false)
}
