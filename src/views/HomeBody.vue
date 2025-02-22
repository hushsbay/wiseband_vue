<script setup>
    import { ref, onMounted, nextTick, computed } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import PopupCommon from "/src/components/PopupCommon.vue"
    
    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    const scrollArea = ref(null)
    const imgPopupRef = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련
    
    const MAX_PICTURE_CNT = 11
    let grnm = ref(''), channm = ref(''), chanimg = ref('')
    let chandtl = ref([]), chanmemUnder = ref([]), chandtlObj = ref({})
    let msglist = ref([])
    let msgbody = ref("구름에 \"달 가듯이\" 가는 나그네<br>술익는 마을마다 <span style='color:red;font-weight:bold'>타는 저녁놀</span> Lets GoGo!!!")
    let uploadFileProgress = ref([]), uploadImageProgress = ref([]) //파일, 이미지 업로드시 진행바 표시
    let fileBlobArr = ref([]), imgBlobArr = ref([]) //파일객체(ReadOnly)가 아님. hover 속성 등 추가 관리 가능

    let savLastMsgMstCdt = ""

    /* 라우팅 관련 정리 : 현재는 부모(Main) > 자식(Home) > 손자(HomeBody) 구조임 (결론은 맨 마지막에 있음)
    1. Home.vue에서 <router-view />를 사용하면 그 자식인 여기 HomeBody.vue가 한번만 마운트되고 
       그 다음에 router.push해도 다시 마운트(아예 호출도) 안됨 : onMounted가 한번만 호출되고 끝.
    2. 그런데, <router-view :key="$route.fullPath"></router-view>와 같이 :key속성을 사용하면 router.push할 때마다 다시 마운트됨
    3. 그런데, Main.vue에서도 :key를 사용하면 Home.vue에서 router.push할 때에도 Main.vue의 onMounted가 호출되어 문제가 됨
    4. 따라서, 현재 구조에서는 여기 손자인 HomeBody.vue를 호출하는 자식인 Home.vue에서만 :key를 적용하면
       슬랙과 똑같이 채널노드를 클릭할 때마다 라우팅되도록 할 수 있음
       - 만일 손자 아래 증손자가 필요하고 그것도 라우팅으로 처리하려면 매우 복잡한 핸들링이 필요하므로
       - 아예 증손자는 만들지 말든지 아니면 만들어도 라우틴이 아닌 비동기컴포넌트 호출(defineAsyncComponent)하기로 함
       - 슬랙과 똑같이 만드는 목표이기 때문에 이런 라우팅을 했으며 그게 아니라면 애초부터 defineAsyncComponent()를 사용했을 것임
       - 슬랙은 그 이유가 URL로 독자적으로 해당 채널을 부르는 페이지를 제공하려 했을 것인데 그것도 defineAsyncComponent()으로 안될 게 없을 것임
    5. back()시 초기화되는 Vue의 특성상 back()시 이전 채널 선택 상태 복원, 이전 메시지 위치로 스크롤 등의 구현은 반드시 구현 필요
       - <KeepAlive>가 Component의 이전 상태를 그대로 유지해 준다는데 파악 및 테스트가 필요함 
       - 사용자가 마지막으로 선택한 채널, 콤보박스 등은 localStorage로 구현되어 있는데 문제없는지 다시 테스트해보기로 함 */

    /* 위와 같이 처리했는데, HomeBody.vue에서 Endless Scroll을 구현후 Back()시 초기상태로 되돌아가므로
       해당 스크롤 포지션까지 돌아 가는 것을 구현하려면 <keep-alive>가 반드시 필요하게 됨
       1. App.vue, Home.vue, HomeBody.vue 모두 아래와 같이 구현하니 잘되나 안되는 부분도 다음 항목처럼 발생 (해결 필요)
            <router-view v-slot="{ Component }">
                <keep-alive>
                    <component :is="Component" :key="$route.fullPath" /> :key속성을 router-view가 아닌 component에 넣어야 잘 동작함
                </keep-alive>
            </router-view>
        2. 위에서 안되는 부분
           1) login후 /main에서 멈춤 (화면 블랭크) 2) 채널 클릭시 펼쳐진 다른 그룹은 접혀짐 3) back()시 노드 선택 색상이 안움직이는데 변경 필요
        3. 제일 중요한 부분은 채널 클릭시 HomeBody.vue의 onMounted()가 여러번 누적적으로 증가 실행되어, named view로 해결 글도 있긴 한데 구조적으로 어려워,
           App.vue, Home.vue는 기존대로 <router-view />로 다시 돌리고, HomeBody.vue만 <keep-alive 위처럼 적용하니 일단 누적/중복호출은 없어져서
           이 환경을 기본으로 문제들을 해결해 나가기로 함 (데이터 가져오기는 <keep-alive>가 지켜주나 스크롤포지션은 안지켜주는데 그 부분은 코딩으로 해결하면 됨)
           1) back()시 노드 선택 색상이 안움직이는데 변경 필요 - router.beforeEach((to, from)로 해결 완료
        4. 채널내 라우팅은 해결했으나 홈 >> DM >> Back()시 HomeBody.vue의 상태 복원은 안되고 있음. :key="$route.fullPath" 제거후 누적/중복호출 해결. 상태 복원도 잘 됨
            <router-view v-slot="{ Component }">
                <keep-alive>
                    <component :is="Component" />
                </keep-alive>
            </router-view>
           1) 홈 >> DM >> Back()시 Main.vue의 홈 선택 복원은 안되고 있음 : router.beforeEach((to, from)로 해결 완료
           2) 홈 클릭시 HomeBody.vue 블랭크 페이지 나옴 해결 필요 (이미 히스토리에 있으므로 안나오는데 슬랙은 그 상태로 다시 보여줌) : gst.selSideMenuTimeTag로 해결 완료
        5. 결론적으로, App.vue, Main.vue, Home.vue에 있는 <router-view>의 모습이 각각 다르며 
           router의 index.js와 각 watch 메소드를 이용해 Back() 또는 기존 URL 클릭시 캐시를 부르거나 상태복원하는 것으로 구현 완료함
    */

    onMounted(async () => { //Main.vue와는 달리 라우팅된 상태에서 Back()을 누르면 여기가 실행됨
        try { //:key속성이 적용되는 <router-view 이므로 onMounted가 router.push마다 실행됨을 유의 //console.log("########homebody.vue")
            gst.selChanId = route.params.chanid
            gst.selGrId = route.params.grid
            await getList({ grid: gst.selGrId, chanid: gst.selChanId })  
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    //grid, chanid는 기본 param
    //1) lastMsgMstCdt : 메시지 작성후 맨 아래에 방금 작성한 메시지 추가할 때 사용 (서버데이터는 기본과 동일하게 가져옴)
    async function getList(param) {
        try {
            const res = await axios.post("/chanmsg/qry", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            const lastMsgMstCdt = param.lastMsgMstCdt
            grnm.value = rs.data.chanmst.GR_NM
            channm.value = rs.data.chanmst.CHANNM
            chanimg.value = (rs.data.chanmst.STATE == "P") ? "violet_lock.png" : "violet_channel.png"
            document.title = channm.value + "[채널]"
            chanmemUnder.value = [] //대신에 <div v-for="idx in MAX_PICTURE_CNT" chandtl[idx-1]로 사용가능한데 null 발생해 일단 대안으로 사용중
            for (let i = 0; i < rs.data.chandtl.length; i++) {
                const row = rs.data.chandtl[i]                
                if (row.PICTURE == null) {
                    row.url = null
                } else {
                    const uInt8Array = new Uint8Array(row.PICTURE.data)
                    const blob = new Blob([uInt8Array], { type: "image/png" })
                    const blobUrl = URL.createObjectURL(blob)
                    row.url = blobUrl
                }
                chandtlObj.value[row.USERID] = row //chandtl은 array로 쓰이는 곳이 훨씬 많을테고 메시지작성자의 blobUrl은 object로 관리하는 것이 효율적이므로 별도 추가함
                if (i < MAX_PICTURE_CNT) chanmemUnder.value.push({ url: row.url })
            }
            chandtl.value = rs.data.chandtl
            const msgArr = rs.data.msglist
            if (msgArr.length > 0) {
                for (let i = 0; i < msgArr.length; i++) { //if (row.msgimg.length > 0) debugger
                    const row = msgArr[i]
                    for (let item of row.msgimg) {
                        if (!item.BUFFER) continue //임시코딩 - 테스트 - 나중에 제거
                        const uInt8Array = new Uint8Array(item.BUFFER.data)
                        const blob = new Blob([uInt8Array], { type: "image/png" })
                        const blobUrl = URL.createObjectURL(blob)
                        item.url = blobUrl
                        item.hover = false
                        item.cdt = item.CDT
                    } //if (row.msgfile.length > 0) debugger
                    for (let item of row.msgfile) {
                        item.hover = false
                        item.name = item.BODY
                        item.size = item.FILESIZE
                        item.cdt = item.CDT
                    }
                    const curAuthorId = row.AUTHORID
                    const curCdt = row.CDT.substring(0, 19)
                    if (i == 0) {
                        row.stickToPrev = false
                    } else {
                        if (msgArr[i - 1].AUTHORID != curAuthorId) {
                            row.stickToPrev = false
                        } else {
                            const prevCdt = msgArr[i - 1].CDT.substring(0, 19)
                            const secondDiff = hush.util.getDateTimeDiff(prevCdt, curCdt)
                            const minuteDiff = parseInt(secondDiff / 60)
                            row.stickToPrev = (minuteDiff <= 1) ? true : false
                        }
                    }
                    if (i == msgArr.length - 1) {
                        row.hasSticker = false
                    } else {
                        if (curAuthorId != msgArr[i + 1].AUTHORID) {
                            row.hasSticker = false
                        } else {
                            const nextCdt = msgArr[i + 1].CDT.substring(0, 19)                            
                            const secondDiff = hush.util.getDateTimeDiff(curCdt, nextCdt)
                            const minuteDiff = parseInt(secondDiff / 60)
                            row.hasSticker = (minuteDiff <= 1) ? true : false
                        }
                    }
                }
                const lastMsgMstCdtThisTime = msgArr[msgArr.length - 1].CDT
                if (lastMsgMstCdtThisTime > savLastMsgMstCdt) savLastMsgMstCdt = lastMsgMstCdtThisTime
                if (lastMsgMstCdt) { //1) 설명 참조
                    msglist.value = [...msglist.value, ...msgArr]
                } else {
                    msglist.value = msgArr
                }
            }
            if (lastMsgMstCdt) {
                //1) 설명 참조
            } else {
                imgBlobArr.value = []
                for (let item of rs.data.tempimagelist) {
                    const uInt8Array = new Uint8Array(item.BUFFER.data)
                    const blob = new Blob([uInt8Array], { type: "image/png" })
                    const blobUrl = URL.createObjectURL(blob)
                    imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: item.CDT })
                }
                fileBlobArr.value = []
                for (let item of rs.data.tempfilelist) {
                    fileBlobArr.value.push({ hover: false, name: item.BODY, size: item.FILESIZE, cdt: item.CDT })
                }
            }
            await nextTick()
            scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight }) //, behavior: 'smooth'
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function displayDt(dtStr, tmOnly) { //vue의 computed method 이용할 경우 아규먼트 전달방법을 아직 파악하지 못해 일반 함수로 처리함
        if (dtStr.length < 19) return null
        const arr = dtStr.split(" ")
        if (tmOnly) {
            return arr[1].substring(0, 5)
        } else {
            const hday = hush.util.getDayFromDateStr(arr[0])
            return arr[0] + " (" + hday + ") " + arr[1].substring(0, 5)
        }
    }

    function msgRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        
    }

    function rowEnter(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = true
    }

    function rowLeave(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = false
    }

    function imgLoaded(e, row) {
        row.realWidth = e.currentTarget.naturalWidth
        row.readHeight = e.currentTarget.naturalHeight
    }

    async function uploadImage(e) { //from paste event
        try {
            e.preventDefault() //tage의 .prevent가 안먹혀서 여기서 처리
            const pastedData = e.clipboardData.items //e.originalEvent.clipboardData.items
            if (pastedData.length == 0) return
            const clipboardItem = pastedData[0]
            if (clipboardItem.type.includes("image")) { //예) image/png
                const blob = clipboardItem.getAsFile() //서버에 보낼 데이터
                const blobUrl = URL.createObjectURL(blob) //화면에 보여줄 데이터
                // if (blob.size > hush.cons.max_size_to_sublink) { //see get_sublink.js
                //     hush.msg.toast("이미지가 너무 큽니다 : " + blob.size + "<br>max : " + hush.util.formatBytes(hush.cons.max_size_to_sublink) + "(" + hush.cons.max_size_to_sublink + "bytes)")
                //     return
                // }
                const fd = new FormData()
                fd.append("chanid", gst.selChanId)
                fd.append("kind", "I")
                fd.append("body", "") //width x height 미리 넣을 필요없어 보이며 대신 빈칸으로 넣어야 함
                fd.append("filesize", blob.size)
                fd.append("file", blob)
                uploadImageProgress.value = { url: blobUrl, percent : 0 }
                const res = await axios.post("/chanmsg/uploadBlob", fd, { 
                    headers: { 
                        'Content-Type': 'multipart/form-data' 
                    }, onUploadProgress: async (e) => {
                        const percent = (e.loaded * 100) / e.total                        
                        uploadImageProgress.value.percent = Math.round(percent)
                    }
                })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                imgBlobArr.value.push({ hover: false, url: blobUrl, cdt: rs.data.cdt })
            } else if (clipboardItem.type.includes("text")) {
                clipboardItem.getAsString(function(str) {
                    // const _arr = str.split(hush.cons.deli)
                    // if (_arr[0] == "btn_copy_cell") { //e.preventDefault() here has no effect                                    
                    //     g_in_chat.val(g_in_chat.val().replace(str, ""))
                    //     if (g_in_chat.val().trim() != "") {
                    //         alert("이미 작성중인 데이터가 있습니다.")
                    //         return
                    //     }                                                        
                    //     const rq = { msgid : _arr[3] }
                    //     if (hush.webview.ios) { 
                    //     } else if (hush.webview.and) { //it's text
                    //         setTimeout(function() {
                    //             AndroidCom.send(hush.cons.sock_ev_qry_msgcell, JSON.stringify(rq), g_roomid, null, true)
                    //         }, hush.cons.sec_for_webview_func) //비동기로 호출해야 동작
                    //     } else {
                    //         hush.sock.send(g_socket, hush.cons.sock_ev_qry_msgcell, rq, g_roomid)
                    //     }
                    // } else {
                    //     calcBytes()
                    // }
                })
            }                        
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    } 
    
    async function delImage(msgid, idx) { //msgid = temp or real msgid
        try {
            const cdt = imgBlobArr.value[idx].cdt
            const res = await axios.post("/chanmsg/delBlob", { 
                msgid: msgid, chanid: gst.selChanId, kind: "I", cdt: cdt, name: ""
            })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            imgBlobArr.value.splice(idx, 1)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function showImage(row) { //msgid, idx) { //msgid = temp or real msgid
        try {
            imgPopupUrl.value = row.url
            imgPopupStyle.value = { width: row.realWidth + "px", height: row.realHeight + "px" }
            imgPopupRef.value.open()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function keyUpEnter(e) {
        if (e.ctrlKey) {
            saveMsg() //나중에 Ctrl+Enter를 saveMsg() 할 수 있도록 옵션 제공하기
        } else {
            //일단 줄바꿈으로 동작하게 하기
        }
    }

    async function saveMsg() { //파일 및 이미지 업로드만 FormData 사용하고 nest.js에서는 multer npm으로 처리
        try { //파일 및 이미지가 있다면 미리 업로드된 상태임
            const rq = { 
                crud: "C", chanid: gst.selChanId, msgid: null, body: document.getElementById('msgContent').innerHTML,
                num_file: fileBlobArr.value.length, num_image: imgBlobArr.value.length
            }
            const res = await axios.post("/chanmsg/saveMsg", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            await getList({ grid: gst.selGrId, chanid: gst.selChanId, lastMsgMstCdt: savLastMsgMstCdt }) //저장한 메시지 추가
            msgbody.value = "111" //https://yamyam-naengmyeon-donkats.tistory.com/35 vue HTML 데이터 바인딩 (sanitize-html)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function uploadFile(e) {
        try {
            const files = e.target.files
            if (fileBlobArr.value.length + files.length > gst.cons.uploadMaxCount) {
                gst.util.setToast("업로드 파일 갯수는 메시지별로 " + gst.cons.uploadMaxCount + "개(기존 파일 포함)까지만 가능합니다.", 5, true)
                return
            }            
            for (let i = 0; i < files.length; i++) {
                const size = files[i].size
                if (size > gst.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 파일 크기 제한은 " + hush.util.formatBytes(gst.cons.uploadLimitSize) + "입니다.\n" + files[i].name + " => " + hush.util.formatBytes(size), true)
                    return
                }
                const exist = fileBlobArr.value.filter(x => x.name == files[i].name)
                if (exist.length > 0) {
                    gst.util.setToast("이미 같은 이름의 파일이 존재합니다.\n" + files[i].name, 5, true)
                    return
                }                
            }
            uploadFileProgress.value = []
            const filesToUpload = []            
            for (let i = 0; i < files.length; i++) {
                const fd = new FormData()
                fd.append("chanid", gst.selChanId)
                fd.append("kind", "F")
                fd.append("body", files[i].name)
                fd.append("filesize", files[i].size)
                fd.append("file", files[i])
                uploadFileProgress.value.push({ name: files[i].name, size: files[i].size, percent : 0 }) //실패시 filesToUpload에 추가된 걸 빼지 않으려고 별도로 만든 것임
                const res = await axios.post("/chanmsg/uploadBlob", fd, { 
                    headers: { 
                        'Content-Type': 'multipart/form-data' 
                    }, onUploadProgress: async (e) => { //파일이 작으면 보이지도 않는데 나중에 파일시스템으로 이관하면 필요할 것임 (현재 구현 및 테스트 완료 상태임)
                        const percent = (e.loaded * 100) / e.total                        
                        uploadFileProgress.value[i].percent = Math.round(percent)
                    }
                })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                filesToUpload.push({ hover: false, name: files[i].name, size: files[i].size, cdt: rs.data.cdt })
            }
            fileBlobArr.value = [...fileBlobArr.value, ...filesToUpload]
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function delFile(msgid, idx) { //msgid = temp or real msgid
        try {
            const name = fileBlobArr.value[idx].name
            const cdt = fileBlobArr.value[idx].cdt
            const res = await axios.post("/chanmsg/delBlob", { 
                msgid: msgid, chanid: gst.selChanId, kind: "F", cdt: cdt, name: name
            })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            fileBlobArr.value.splice(idx, 1)
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function downloadFile(msgid, row) { //msgid = temp or real msgid
        try {
            const query = "?msgid=" + msgid + "&chanid=" + gst.selChanId + "&kind=F&cdt=" + row.cdt + "&name=" + row.name
            axios.get("/chanmsg/readBlob" +query, { 
                responseType: "blob"
            }).then(res => { //비즈니스로직 실패시 오류처리에 대한 부분 구현이 현재 어려움 (procDownloadFailure in common.ts 참조)
                //https://stackoverflow.com/questions/55218597/is-it-good-to-access-dom-in-vue-js
                //index.html의 <body><div id="app">와 main.js의 app.mount('#app')를 보면 알 수 있듯이 vue realm은 app이 루트엘레먼트가 되서
                //아래 document.body.appendChild(link)는 app의 밖이므로 문제없어 보임. 다만, 처리후 삭제하는 코딩은 callback/promise가 필요해 보이는데
                //더 간편하게 처리하려면 차라리 시작할 때 기존 정해진 아이디를 지우는 게 나아 보이긴 함
                const tagId = "btn_download"
                const elem = document.getElementById(tagId)
                if (elem) elem.remove()
                const url = window.URL.createObjectURL(new Blob([res.data]))
                const link = document.createElement('a')
                link.id = tagId
                link.href = url
                link.setAttribute('download', row.name)                
                document.body.appendChild(link)
                link.click()
                gst.util.setToast("")                
            }).catch(exception => {
                gst.util.setToast("")
                gst.util.setSnack("파일 다운로드 실패\n" + exception.toString(), true)
            })
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function test() {
        return
        const res = await axios.post("/chanmsg/qry", { grid : gst.selGrId, chanid : gst.selChanId })
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return            
        grnm.value = rs.data.chanmst.GR_NM
        channm.value = rs.data.chanmst.CHANNM
        document.title = channm.value
        msglist.value = [...msglist.value, ...rs.data.msglist]
    }
</script>

<template>
    <div class="chan_center">
        <div class="chan_center_header" @click="test" style="cursor:pointer">
            <div class="chan_center_header_left">
                <img class="coImg18" :src="gst.html.getImageUrl(chanimg)" style="margin-right:5px">
                <div class="coDotDot">{{ channm }} [{{ grnm }}] - {{ gst.selChanId }}</div>
            </div>
            <div class="chan_center_header_right">
                <div class="topMenu" style="padding:3px;display:flex;align-items:center;border:1px solid lightgray;border-radius:5px;font-weight:bold">
                    <div v-for="(row, idx) in chanmemUnder" style="width:24px;height:24px;display:flex;align-items:center;margin-right:2px">
                        <img v-if="row.url" :src="row.url" style='width:100%;height:100%;border-radius:12px'>
                        <img v-else :src="gst.html.getImageUrl('user.png')" style='width:100%;height:100%'>
                    </div>
                    <span>{{ chandtl.length }}</span>
                </div>
                <div class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                    <img class="coImg20" :src="gst.html.getImageUrl('dimgray_option_vertical.png')">
                </div>                
            </div>
        </div>
        <div class="chan_center_nav">
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px 5px 0;border-bottom:3px solid black;border-radius:0">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                <span style="margin-left:5px;font-weight:bold">메시지</span> 
            </div>
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_file.png')">
                <span style="margin-left:5px">파일</span> 
            </div>
        </div> 
        <div class="chan_center_body" ref="scrollArea">
            <div v-for="(row, idx) in msglist" :id="row.MSGID" class="msg_body procMenu"  
                :style="row.hasSticker ? {} : { borderBottom: '1px solid lightgray' }"               
                @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => msgRight(e, row)">
                <div style="display:flex;align-items:center" v-show="!row.stickToPrev">
                    <img v-if="chandtlObj[row.AUTHORID] && chandtlObj[row.AUTHORID].url" :src="chandtlObj[row.AUTHORID].url" class="coImg32" style="border-radius:16px">
                    <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg32">
                    <span style="margin-left:9px;color:dimgray">{{ row.AUTHORNM }} {{ displayDt(row.CDT) }} </span>
                </div>
                <div style="display:flex;margin:10px 0">
                    <div style="width:40px;display:flex;align-items:center;color:dimgray">
                        <span v-show="row.stickToPrev && row.hover">{{ displayDt(row.CDT, true) }}</span>
                    </div>
                    <div v-html="row.BODY"></div>
                </div>
                <div class="msg_body_sub">
                    <div v-for="(row1, idx1) in row.msgdtl" class="msg_body_sub1" :title="row1.NM">
                        <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')"> <span style="margin-left:3px">{{ row1.CNT}}</span>
                    </div>
                    <div v-for="(row2, idx2) in row.reply" style="margin-right:0px;padding:0px;display:flex;align-items:center" :title="row2.AUTHORNM">
                        <img class="coImg18" :src="gst.html.getImageUrl('user.png')">
                    </div>
                    <div v-if="row.reply.length > 0" style="margin:0 5px;display:flex;align-items:center">
                        댓글:<span>{{ row.reply.length }}</span>개 (최근:<span>{{ row.reply[0].DT }}</span>)
                    </div>
                </div>
                <div v-if="row.msgimg.length > 0" class="msg_body_sub">
                    <div v-for="(row5, idx5) in row.msgimg" @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="showImage(row5)" class="msg_image_each">
                        <img :src="row5.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row5)">
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" >
                        </div>
                    </div>                
                </div>
                <div v-if="row.msgfile.length > 0" class="msg_body_sub">
                    <div v-for="(row5, idx5) in row.msgfile" @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="downloadFile(row.MSGID, row5)" class="msg_file_each">
                        <div><span style="margin-right:3px">{{ row5.name }}</span>(<span>{{ hush.util.formatBytes(row5.size) }}</span>)</div>
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" >
                        </div>
                    </div>
                </div>
                <div v-show="row.hover" class="msg_proc">
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('emo_watch.png')" title="알아보는중"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('emo_check.png')" title="접수완료"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('emo_done.png')" title="완료"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드에 댓글 달기"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_later.png')" title="나중에"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기"></span>
                </div>
            </div>
        </div>
        <div class="chan_center_footer">
            <div class="editor_header">
                <div class="saveMenu" @click="saveMsg">
                    <img class="coImg24" :src="gst.html.getImageUrl('white_send.png')" title="발송">
                </div>
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘 추가">
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_link.png')" title="링크 추가">
                <input id="file_upload" type=file multiple hidden @change="uploadFile" />
                <label for="file_upload"><img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일 추가"></label>
            </div>
            <!--<div id="msgBody" class="editor_body" contenteditable="true" spellcheck="false" v-html="editData.edit" @input="updateStyling($event.target)"></div> 
                https://www.jkun.net/702-->
            <div id="msgContent" class="editor_body" contenteditable="true" spellcheck="false" 
                v-html="msgbody" @paste="uploadImage" @keyup.enter="keyUpEnter">
            </div>
            <div v-if="imgBlobArr.length > 0" class="msg_body_blob">
                <div v-for="(row, idx) in imgBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="showImage(row)" class="msg_image_each">
                    <img :src="row.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row)">
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delImage('temp', idx)">
                    </div>
                </div>                
            </div>
            <div v-if="fileBlobArr.length > 0" class="msg_body_blob">
                <div v-for="(row, idx) in fileBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="downloadFile('temp', row)" class="msg_file_each">
                    <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ hush.util.formatBytes(row.size) }}</span>)</div>
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delFile('temp', idx)">
                    </div>
                </div><!-- 아래 진행바는 db에 파일저장시엔 용량제한이 있으므로 실제 육안으로는 보이지 않고 파일시스템 저장 적용시 대용량에 한해서 보이게 될 것임 -->
                <div v-for="(row, idx) in uploadFileProgress" v-show="row.percent > 0 && row.percent < 100" class="msg_file_each">
                    <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ row.size }}</span>)</div>
                    <div class="msg_file_seemore">
                        <span style="padding:0 5px;color:red">{{ row.percent }}%</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="chan_right">
        <div class="chan_right_header">
            <div class="chan_right_header_left">
                   
            </div>
            <div class="chan_right_header_right">
                
            </div>
        </div>
        <div class="chan_right_body">
            
        </div>
        <div class="chan_right_footer">
            
        </div>
    </div>   
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
    <popup-common ref="imgPopupRef"><!-- <popup-common ref="imgPopupRef" :objUrl="objUrl"></popup-common> -->
        <div>
            <img :src="imgPopupUrl" :style='imgPopupStyle'>
        </div>
    </popup-common>
</template>

<style scoped>    
    .chan_center {
        width:calc(100% - 20px);height:100%;padding: 0 0 0 10px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;justify-content:space-between;overflow:hidden
    }
    .chan_center_header_left {
        width:50%;height:100%;display:flex;align-items:center;
        font-size:18px;font-weight:bold
    }
    .chan_center_header_right {
        width:50%;height:100%;display:flex;align-items:center;justify-content:flex-end
    }
    .chan_center_nav {
        width:100%;min-height:30px;display:flex;align-items:center;
        border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .msg_body {
        position:relative;display:flex;flex-direction:column;margin:5px 0 0 0;
    }
    .msg_body_sub {
        display:flex;margin:0 0 0 40px;display:flex;flex-wrap:wrap;justify-content:flex-start
    }
    .msg_body_sub1 {
        margin-right:10px;padding:5px;display:flex;background:whitesmoke;border-radius:8px
    }
    .msg_body_blob {
        margin-top:10px;display:flex;flex-wrap:wrap;justify-content:flex-start;background:whitesmoke
    }
    .msg_file_each {
        position:relative;height:30px;margin:10px 10px 0 0;padding:0 5px;display:flex;align-items:center;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_file_seemore {
        position:absolute;top:0;right:0px;height:30px;display:flex;align-items:center;background:beige
    }
    .msg_file_del {
        position:absolute;top:-10px;right:-10px;width:18px;height:18px;border-radius:9px;display:flex;align-items:center;background:beige
    }
    .msg_image_each {
        position:relative;width:50px;height:50px;margin:10px 10px 0 0;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_proc {
        position:absolute;height:20px;right:3px;top:1px;padding:5px 10px;z-index:9999;
        display:flex;align-items:center;
        background:white;border:1px solid lightgray;border-radius:5px
    }
    .chan_center_footer {
        width:100%;margin:auto 0 10px 0;
        display:flex;flex-direction:column;
        border:1px solid lightgray;border-radius:5px;
    }
    .editor_header {
        width:100%;height:40px;
        display:flex;align-items:center;
        background:whitesmoke;
    }
    .editor_body {
        width:calc(100% - 10px);min-height:40px;max-height:300px;padding:5px;overflow:hidden       
    }
    .chan_right {
        width:400px;height:100%;padding: 0 20px;
        display:none;flex-direction:column;
    }
    .chan_right_header {
        width:100%;height:70px;display:flex;justify-content:space-between;
    }
    .chan_right_header_left {
        width:70%;height:100%;display:flex;align-items:center;
    }
    .chan_right_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;
    }
    .chan_right_body {
        width:100%;height:100%;display:flex;flex-direction:column;
    }
    .chan_right_footer {
        width:100%;height:150px;display:flex;
    }
    .chan_side_top {
        width:100%;height:50px;display:flex;justify-content:space-between;
    }
    .chan_side_top_left {
        width:50%;height:100%;padding-left:10px;display:flex;align-items:center;
    }
    .chan_side_top_right {
        width:50%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
    }
    .chan_side_main {
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto;
    }
    .node {
        width:calc(100% - 30px);min-height:36px;padding:0 10px;margin:0 5px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--text-white-color);border-radius:5px;cursor:pointer;
    }
    .nodeRight { display:flex;align-items:center;justify-content:flex-end; }
    .topMenu { border-radius:5px;cursor:pointer }
    .topMenu:hover { background:whitesmoke;font-weight:bold }
    .procMenu { padding:5px;margin-right:10px;border-radius:5px;cursor:pointer }
    .procMenu:hover { background:whitesmoke }
    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .editorMenu:active { background:lightsteelblue }
    .saveMenu { display:flex;align-items:center;padding:3px 5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px }
    .saveMenu:hover { background:lightsteelblue }
    .saveMenu:active { background:darkblue }
    .nodeSel { background:var(--second-select-color);color:var(--primary-color); }
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px; /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
    
</style>
