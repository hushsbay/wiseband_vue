import { ref } from "vue"
import VueCookies from "vue-cookies"
import { io } from "socket.io-client"
import hush from '/src/stores/Common.js'

const query = { token : VueCookies.get("token") }

export const id = ref(Math.random().toString()) //브로드캐스팅 받은 데이터 구분을 위한 id
export const chatMessages =ref([]) //받은 데이터를 수집
export const connected =ref(false) //연결 상태
export const socket = io('http://localhost:3000/' + hush.cons.appName, { forceNew: false, reconnection: false, query: query }) //hush.cons.appName은 namespace

socket.on("connect", () => {
    console.log("connect")
    connected.value = true
})

socket.on("disconnect", () => {
    console.log("disconnect")
    connected.value = false
})

// socket.on('ServerToClient', (data) => {
//     console.log(data+"@@@@@@@@@@@@@@@@@")
//     chatMessages.value.push(data)
// })

socket.on('error', (data) => {
    console.log(data+"!!!!!!!!!!!!!!!")
    chatMessages.value.push(data)
})

socket.on("connect_error", err => { //https://socket.io/docs/v4/server-api/
  console.log(err instanceof Error); // true
  console.log(err.message); // not authorized
  console.log(err.data); // { content: "Please retry later" }
});