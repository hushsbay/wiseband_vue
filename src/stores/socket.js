import { ref } from "vue"
import VueCookies from "vue-cookies"
import { io } from "socket.io-client"
import hush from '/src/stores/Common.js'

//export const id = ref(Math.random().toString()) //브로드캐스팅 받은 데이터 구분을 위한 id
//export const chatMessages =ref([]) //받은 데이터를 수집
export const connected = ref(false) //연결 상태
//export const socket = io('http://localhost:3000/' + hush.cons.appName, { forceNew: false, reconnection: false, query: query }) //hush.cons.appName은 namespace

export const sock = { socket: null }

export function connectSock() {
    if (!sock.socket || !sock.socket.connected) {
        const query = { token : VueCookies.get("token") }
        sock.socket = io('http://localhost:3000/' + hush.cons.appName, { forceNew: false, reconnection: false, query: query }) //hush.cons.appName은 namespace
        sock.socket.on("connect", () => {
            console.log("socket connected")
            connected.value = true
        })
        sock.socket.on("disconnect", () => {
            console.log("socket disconnected")
            connected.value = false
        })
        // socket.on('ServerToClient', (data) => {
        //     console.log(data+"@@@@@@@@@@@@@@@@@")
        //     chatMessages.value.push(data)
        // })
        sock.socket.on('error', (data) => {
            console.log('error: ' + data + "!!!!!!!!!!!!!!!")
            chatMessages.value.push(data)
        })
        sock.socket.on("connect_error", err => { //https://socket.io/docs/v4/server-api/
            console.log("connect_error: " + err instanceof Error) // true
            console.log("connect_error: " + err.message) // not authorized
            console.log("connect_error: " + err.data) // { content: "Please retry later" }
        })
    }
}

/*
export let socket

export function connectSock() {
    if (!socket || !socket.connected) {
        const query = { token : VueCookies.get("token") }
        socket = io('http://localhost:3000/' + hush.cons.appName, { forceNew: false, reconnection: false, query: query }) //hush.cons.appName은 namespace
        socket.on("connect", () => {
            console.log("socket connected")
            connected.value = true
        })
        socket.on("disconnect", () => {
            console.log("socket disconnected")
            connected.value = false
        })
        // socket.on('ServerToClient', (data) => {
        //     console.log(data+"@@@@@@@@@@@@@@@@@")
        //     chatMessages.value.push(data)
        // })
        socket.on('error', (data) => {
            console.log('error: ' + data + "!!!!!!!!!!!!!!!")
            chatMessages.value.push(data)
        })
        socket.on("connect_error", err => { //https://socket.io/docs/v4/server-api/
            console.log("connect_error: " + err instanceof Error) // true
            console.log("connect_error: " + err.message) // not authorized
            console.log("connect_error: " + err.data) // { content: "Please retry later" }
        })
    }
    return socket
}*/

