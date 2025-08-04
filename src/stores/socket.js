import { ref, inject } from "vue"
import VueCookies from "vue-cookies"
import { io } from "socket.io-client"

export const id = ref(Math.random().toString()) //브로드캐스팅 받은 데이터 구분을 위한 id
export const chatMessages =ref([]) //받은 데이터를 수집
export const connected =ref(false) //연결 상태

const query = { token : VueCookies.get("token") }
export const socket = io('http://localhost:3000', { forceNew: false, reconnection: false, query: query })

socket.on("connect", () => {
    console.log("connect..socket.io")
    connected.value = true
})

socket.on("disconnect", () => {
    console.log("disconnect")
    connected.value = false
})

socket.on('ServerToClient', (data) => {
    console.log(data+"@@@@@@@@@@@@@@@@@")
    chatMessages.value.push(data)
})