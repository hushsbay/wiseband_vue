import '/src/assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueCookies from "vue-cookies"
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
//} else if (location.href.startsWith("http://10.10.221.214")) {
//    hostnameStr = "http://10.10.221.214"
//    domainStr = location.protocol + "//" + hostnameStr + ":3000" //nest port
} else {
    hostnameStr = "hushsbay.com"
    domainStr = location.protocol + "//" + hostnameStr + ":" + location.port
}

const app = createApp(App) 
app.config.globalProperties.axios = axios //global로 설정했음에도 각 .vue마다 axios import하지 않고는 axios or this.axios로 호출시 오류 발생!?
app.use(createPinia())
app.use(router)
app.use(VueCookies, { path : '/', domain : hostnameStr, secure : true, sameSite : 'none' }) //none(모든 도메인에 쿠키가 전송), strict(동일한 사이트 내의 요청에만 전송)
//const overridenOptions = { allowedTags: ['span'] }
//app.use(Vue3Sanitize, overridenOptions)
app.mount('#app')

const gst = GeneralStore() //app위로 올리지 말기

axios.defaults.baseURL = domainStr //https://cokes.tistory.com/123, https://inpa.tistory.com/entry/AXIOS-%F0%9F%93%9A-CORS-%EC%BF%A0%ED%82%A4-%EC%A0%84%EC%86%A1withCredentials-%EC%98%B5%EC%85%98
axios.defaults.withCredentials = true //localhost 2개의 다른 포트시 쿠키 전송안되는 것은 nest main.ts enableCors()도 필요
axios.interceptors.request.use(
    function (config) {
        //console.log("main.js axios config : " + config.url + " ::: " + JSON.stringify(config.data))
        if (config.data.toastMsg) {
            gst.util.setToast(hush.cons.toastMsg, true) //clear는 axios response interceptor에 구현해도 되나 chkAxiosCode in gst에 이미 구현되어 있어 그대로 둠
        } else {
            gst.bottomMsg = config.url + " :: " + JSON.stringify(config.data)
        }
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
