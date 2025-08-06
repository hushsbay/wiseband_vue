import { ref } from "vue"
import VueCookies from "vue-cookies"
import { io } from "socket.io-client"
import hush from '/src/stores/Common.js'

export const connected = ref(false) //연결 상태
//export const socket = io('http://localhost:3000/' + hush.cons.appName, { forceNew: false, reconnection: false, query: query })
//바로 위의 경우는 socket이 끊어졌을 때 다시 접속해 socket으로 받을 때 구현에 문제가 되어 바로 아래처럼 해결함 (여러 탭에서 랜덤으로 살아나야 하므로 reconnection:true도 100% 해결이 안됨)
export const sock = { socket: null } //export는 immutable이므로 바로 변수로 처리하지 않고 object로 처리해야 문제가 없을 것임

export function connectSock() {
    const query = { token : VueCookies.get("token") } //hush.cons.appName은 namespace (서버와 동일하게 가져 가야 함)
    sock.socket = io('http://localhost:3000/' + hush.cons.appName, { forceNew: false, reconnection: false, query: query })
    sock.socket.on("connect", () => {
        console.log("socket connected")
        connected.value = true
    })
    sock.socket.on("disconnect", () => {
        console.log("socket disconnected")
        connected.value = false
    })
    sock.socket.on('error', (data) => {
        console.log('error: ' + data)
        chatMessages.value.push(data)
    })
    sock.socket.on("connect_error", err => { //https://socket.io/docs/v4/server-api/
        console.log("connect_error: " + err instanceof Error) //true
        console.log("connect_error: " + err.message)
        console.log("connect_error: " + err.data) //예) { content: "Please retry later" }
    })
}
