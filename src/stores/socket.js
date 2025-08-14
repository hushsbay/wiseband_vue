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

//각종 패널.vue를 제외한 윈도우 레이아웃은 1) Main.vue + MsgList.vue 2) 1) 말고도 MsgList.vue만 존재 3) 1),2) 말고도 또 다른 Main.vue + MsgList.vue 방식 (사용자가 주소를 복사해 오픈한 경우) => 3가지임
//1)과 3)은 각각의 데이터 폴링과 소켓 (브라우저별로 1개의 소켓과 1개의 데이터 몰링 아님) - 위 2)의 경우만 1)에 종속되어 통신함
//소켓으로 데이터가 수신되면 대부분은 데이터 폴링을 3초간 시작해라는 트리거만 제공할 뿐 다른 업무로직은 없음. 따라서, 송신시에도 별다른 업무로직은 없음 (chkTyping, chkAlive 등 일부는 별도 로직 있음)
