<script setup>
    import { ref, onMounted, nextTick, useTemplateRef } from 'vue' 
    import { useRoute } from 'vue-router'
    import axios from 'axios'
    import { debounce } from 'lodash'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import PopupCommon from "/src/components/PopupCommon.vue"
    //import HomeRight from "/src/views/HomeRight.vue"
    
    const gst = GeneralStore()
    const route = useRoute()

    let thread = ref({ msgid: null })

    const scrollArea = ref(null)
    let popupRefKind = ref('') //아래 ~PopupRef의 종류 설정
    const imgPopupRef = ref(null), imgPopupUrl = ref(null), imgPopupStyle = ref({}) //이미지팝업 관련
    const linkPopupRef = ref(null), linkText = ref(''), linkUrl = ref('')
    
    const MAX_PICTURE_CNT = 11
    let grnm = ref(''), channm = ref(''), chanimg = ref('')
    let chandtl = ref([]), chanmemUnder = ref([]), chandtlObj = ref({})
    let msglist = ref([])
    let editMsgId = ref(''), prevEditData = "", showHtml = ref(false), msgbody = ref("<p>구름에 \"달 가듯이\" 가는 나그네<br>술익는 마을마다 <span style='color:red;font-weight:bold'>타는 저녁놀</span></p>")
    let uploadFileProgress = ref([]), uploadImageProgress = ref([]) //파일, 이미지 업로드시 진행바 표시
    let linkArr = ref([]), fileBlobArr = ref([]), imgBlobArr = ref([]) //파일객체(ReadOnly)가 아님. hover 속성 등 추가 관리 가능

    let savFirstMsgMstCdt = "", savLastMsgMstCdt = "9999-99-99"
    let onGoingGetList = false, prevScrollY
    
    //##0 웹에디터 https://ko.javascript.info/selection-range
    //https://velog.io/@longroadhome/%EB%AA%A8%EB%8D%98JS-%EB%B8%8C%EB%9D%BC%EC%9A%B0%EC%A0%80-Range%EC%99%80-Selection
    //https://stefan.petrov.ro/inserting-an-element-at-cursor-position-in-a-content-editable-div/ => 목적이 다르고 헛점도 많이 보이지만 참고할 만한 내용도 많음
    //아래 변수는 storeCursorPosition()의 주석 참조
    let prevRange //let cursorPos = { node: null, startOffset: 0, endOffset: 0 } curPos 말고 prevRange로 기억하면 훨씬 간편해서 막음 (코딩은 그대로 둠)
    let editorIn = ref(false), editorBlurDt = Date.now()
    let inEditor = useTemplateRef('editorRef') //editor = document.getElementById('msgContent') editor 대신 inEditor (템플릿 참조) 사용

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
            await getList({ grid: gst.selGrId, chanid: gst.selChanId, lastMsgMstCdt: savLastMsgMstCdt })  
            inEditor.value.focus()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function chanCtxMenu(e) {
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {

            }},
            { nm: "채널정보 보기", func: function(item, idx) {
                
            }},
            { nm: "채널링크 복사", func: function(item, idx) {
                
            }},
            { nm: "채널 설정", func: function(item, idx) {
                
            }},
            { nm: "알림 변경", func: function(item, idx) {
                
            }},
            { nm: "즐겨찾기", func: function(item, idx) {
                
            }},
            { nm: "채널 나가기", color: 'red', func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
    }

    function chanProperty() {
        alert("hahaha")
    }

    function chanMsg(kind) {
        alert("hahaha")
    }

    async function qryPrev() {
        await getList({ grid: gst.selGrId, chanid: gst.selChanId, lastMsgMstCdt: savLastMsgMstCdt }) //Endless Scrolling
    }

    //grid, chanid, lastMsgMstCdt는 기본 param
    //1) lastMsgMstCdt : Endless Scrolling 관련
    //2) firstMsgMstCdt : 메시지 작성후 화면 맨 아래에 방금 작성한 메시지 추가할 때 사용
    async function getList(param) {
        if (onGoingGetList) return
        try {
            onGoingGetList = true
            const lastMsgMstCdt = param.lastMsgMstCdt
            const firstMsgMstCdt = param.firstMsgMstCdt //lastMsgMstCdt와 공존하면 안됨
            let idTop
            if (lastMsgMstCdt && lastMsgMstCdt != gst.cons.cdtAtFirst) {
                const eleTop = getTopMsgBody() //1) 경우에 데이터 가져와서 뿌린 후 그 이전 위치로 가기 위해 저장한 것임
                idTop = eleTop.id
            }
            const res = await axios.post("/chanmsg/qry", param)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) {
                onGoingGetList = false
                return
            }            
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
            if (msgArr.length > 0) { //msgArr[0]가 가장 최근일시임 (CDT 내림차순 조회 결과)
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
                    for (let item of row.msglink) {
                        item.hover = false                        
                        item.cdt = item.CDT
                        const arr = item.BODY.split(gst.cons.deli)
                        if (arr.length == 1) {
                            item.text = item.BODY
                            item.url = item.BODY
                        } else {
                            item.text = arr[0]
                            item.url = arr[1]
                        }
                    }
                    const curAuthorId = row.AUTHORID
                    const curCdt = row.CDT.substring(0, 19)
                    if (i == msgArr.length - 1) {
                        row.stickToPrev = false
                    } else {
                        if (curAuthorId != msgArr[i + 1].AUTHORID) { //i보다 i + 1이 일시가 더 오래된 것임
                            row.stickToPrev = false
                        } else {
                            const prevCdt = msgArr[i + 1].CDT.substring(0, 19)
                            const secondDiff = hush.util.getDateTimeDiff(prevCdt, curCdt)
                            const minuteDiff = parseInt(secondDiff / 60)
                            row.stickToPrev = (minuteDiff <= 1) ? true : false
                        }
                    }
                    if (i == 0) {
                        row.hasSticker = false
                    } else {
                        if (curAuthorId != msgArr[i - 1].AUTHORID) { //i보다 i - 1이 일시가 더 최근임
                            row.hasSticker = false
                        } else {
                            const nextCdt = msgArr[i - 1].CDT.substring(0, 19)
                            const secondDiff = hush.util.getDateTimeDiff(curCdt, nextCdt)
                            const minuteDiff = parseInt(secondDiff / 60)
                            row.hasSticker = (minuteDiff <= 1) ? true : false
                        }
                    }
                    if (firstMsgMstCdt) {
                        if (i == 0) {
                            msglist.value.push(row)
                        } else {
                            msglist.value.splice(msgArr.length - i, 0, row)    
                        }                        
                    } else {
                        msglist.value.splice(0, 0, row)
                    }
                    if (row.CDT > savFirstMsgMstCdt) savFirstMsgMstCdt = row.CDT
                    if (row.CDT < savLastMsgMstCdt) savLastMsgMstCdt = row.CDT
                }
            }
            if (firstMsgMstCdt) {
                //2) 설명 참조
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
                linkArr.value = []
                for (let item of rs.data.templinklist) {
                    let text, url
                    const arr = item.BODY.split(gst.cons.deli)
                    if (arr.length == 1) {
                        text = item.BODY
                        url = item.BODY
                    } else {
                        text = arr[0]
                        url = arr[1]
                    }
                    linkArr.value.push({ hover: false, text: text, url: url, cdt: item.CDT })
                }
            }
            await nextTick()
            if (!lastMsgMstCdt || lastMsgMstCdt == gst.cons.cdtAtFirst) {
                scrollArea.value.scrollTo({ top: scrollArea.value.scrollHeight }) //, behavior: 'smooth'
            } else {
                if (msgArr.length > 0) {
                    const ele = document.getElementById(idTop)
                    if (ele) scrollArea.value.scrollTo({ top: ele.offsetTop - ele.offsetHeight - 10}) //10은 마진/패딩 등 알파값 
                }
            }
            onGoingGetList = false            
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function memProfile(e, row) {
        //alert(JSON.stringify(row))
        gst.ctx.data.header = row.AUTHORNM
        gst.ctx.menu = [
            { nm: "메시지 보내기", func: function(item, idx) {
                
            }},
            { nm: "VIP로 설정", func: function(item, idx) {
                
            }},
            { nm: "퇴장 시키기", color: 'red', func: function(item, idx) {
                
            }}
        ]
        gst.ctx.show(e)
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

    function rowRight(e, row, index) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "반응 추가", img: "dimgray_emoti.png", func: function(item, idx) {
                alert(JSON.stringify(row))
            }},
            { nm: "스레드(댓글)", img: "dimgray_thread.png", func: function(item, idx) {
                
            }},
            { nm: "메시지 전달", img: "dimgray_forward.png", func: function(item, idx) {
                
            }},
            { nm: "나중을 위해 저장", img: "dimgray_later.png", deli: true, func: function(item, idx) {
                
            }},
            { nm: "읽지않음으로 표시", func: function(item, idx) {
                alert(item.nm+"@@@@"+idx)
            }},
            { nm: "리마인더 받기", child: [
                { nm: "1시간 후", func: function(item, idx) { 
                    alert(item.nm+"@@@@"+idx)
                }},
                { nm: "내일", func: function(item, idx) { 
                    
                }},
                { nm: "다음 주", func: function(item, idx) { 
                    
                }},
                { nm: "사용자 지정", func: function(item, idx) { 
                    
                }}                
            ]},
            { nm: "새 댓글시 알림 받기", func: function(item, idx) {
                
            }},
            { nm: "채널에 고정", func: function(item, idx) {
                
            }},
            { nm: "링크로 복사", func: function(item, idx) {
                
            }},
            { nm: "메시지 편집", func: function(item, idx) {
                editMsgId.value = row.MSGID
                prevEditData = document.getElementById('msgContent').innerHTML
                if (prevEditData.trim() != "") {
                    gst.util.setToast("에디터에 이미 편집중인 데이터가 있습니다.")
                    return
                }
                msgbody.value = row.BODY
            }},
            { nm: "메시지 삭제", color: "red", func: async function(item, idx) {
                try {
                    //if (!window.confirm("삭제후엔 복구가 불가능합니다. 진행할까요?")) return
                    const res = await axios.post("/chanmsg/delMsg", { 
                        msgid: row.MSGID, chanid: gst.selChanId
                    })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs) return
                    msglist.value.splice(index, 1) //해당 메시지 배열 항목 삭제해야 함 (일단 삭제하는 사용자 화면 기준만 해당)
                } catch (ex) { 
                    gst.util.showEx(ex, true)
                }
            }}
        ]
        gst.ctx.show(e)
    }

    function rowEnter(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = true
    }

    function rowLeave(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = false
    }

    const onScrollEnd = debounce(async (e) => { //2) 관련
        const sTop = scrollArea.value.scrollTop
        const which = (prevScrollY && sTop < prevScrollY) ? "up" : "down"
        prevScrollY = sTop //console.log(sTop+"@@@@@@@@@@@"+which)
        if (which == "up" && sTop < 100) { 
            //0으로 조건을 걸면 up 체크할 필요없지만 일단 그냥 두기로 함 (debounce도 필요없어 보임)
            //처음엔 sTop < 250 정도로 했으나 debound로도 안먹히고 두번 실행될 때가 있어서 일단 안전하게 sTop == 0으로 처리함
            await qryPrev()
        }
    }, 500)

    const getTopMsgBody = () => { //2) 관련 : 육안으로 보이는 맨 위 MSGID의 div(msgbody 및 procMenu 클래스 보유) 찾기
        const rect = hush.util.getRect("#chan_center_body")
        const xx = rect.left + 1 //MSGID를 갖고 있는 div는 margin/padding이 각각 5px이므로 xx, yy에 그 안의 값을 더하면 구할 수 있음
        let yy = rect.top + 6
        const ele = document.elementFromPoint(xx, yy)
        return ele
    }

    async function delBlob(kind, msgid, idx, index) { //msgid = temp or real msgid
        try { //index는 메시지 배열의 항목 인덱스. idx는 그 항목내 file or image or link array의 인덱스
            let cdt = ""
            if (kind == "F") {
                cdt = (msgid == "temp") ? fileBlobArr.value[idx].cdt : msglist.value[index].msgfile[idx].cdt
            } else if (kind == "I") {
                cdt = (msgid == "temp") ? imgBlobArr.value[idx].cdt : msglist.value[index].msgimg[idx].cdt
            } else if (kind == "L") {
                cdt = (msgid == "temp") ? linkArr.value[idx].cdt : msglist.value[index].msglink[idx].cdt
            }
            const res = await axios.post("/chanmsg/delBlob", { 
                msgid: msgid, chanid: gst.selChanId, kind: kind, cdt: cdt
            })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (kind == "F") {
                if (msgid == "temp") {
                    fileBlobArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msgfile.splice(idx, 1)
                }
            } else if (kind == "I") {
                if (msgid == "temp") {
                    imgBlobArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msgimg.splice(idx, 1)
                }
            } else if (kind == "L") {
                if (msgid == "temp") {
                    linkArr.value.splice(idx, 1)
                } else {
                    msglist.value[index].msglink.splice(idx, 1)
                }
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function imgLoaded(e, row) {
        row.realWidth = e.currentTarget.naturalWidth
        row.readHeight = e.currentTarget.naturalHeight
    }

    async function pasteData(e) { //from paste event
        try {
            if (editMsgId.value) {
                gst.util.setToast("편집중인 메시지에는 이미지 붙이기가 불가능합니다.", 3)
                return
            }
            e.preventDefault() //tage의 .prevent가 안먹혀서 여기서 처리
            const pastedData = e.clipboardData.items //e.originalEvent.clipboardData.items
            if (pastedData.length == 0) return
            if (pastedData[0].type.includes("image")) { //예) image/png
                const clipboardItem = pastedData[0]
                const blob = clipboardItem.getAsFile() //서버에 보낼 데이터
                const blobUrl = URL.createObjectURL(blob) //화면에 보여줄 데이터
                if (blob.size > gst.cons.uploadLimitSize) {
                    gst.util.setSnack("업로드 이미지 크기 제한은 " + hush.util.formatBytes(gst.cons.uploadLimitSize) + "입니다.\n" + "현재 => " + hush.util.formatBytes(blob.size), true)
                    return
                }
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
            } else if (pastedData[0].type == "text/plain" || (pastedData.length >= 2 && pastedData[1].type == "text/html")) {
                const idx = (pastedData.length >= 2 && pastedData[1].type == "text/html") ? 1 : 0
                //1 : 클립보드에 text뿐만 아니라 html 데이터를 제공하므로 기본적으로 html을 적용시키는 것이 맞을 것임 
                //0 : html이 아닌 순수 text라고 봐야 함
                const clipboardItem = pastedData[idx]
                const type = clipboardItem.type
                clipboardItem.getAsString(function(str) { //const html = sanitizeHTML(str) //document.execCommand('insertHTML', false, (html))
                    insertPastedToEditor(type, str) //여기에 clipboardItem.type으로 참조하면 안읽히므로 위에서 미리 get
                })
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    } 
    
    function showImage(row) { //msgid = temp or real msgid
        try {
            popupRefKind.value = 'image'
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
        try { //파일,이미지,링크가 있다면 미리 업로드된 상태이며 crud가 C일 때만 업로드 되며 U일 때는 슬랙과 동일하게 업로드되지 않음 (본문만 수정저장됨)
            msgbody.value = document.getElementById('msgContent').innerHTML //이 행이 없으면 발송 2회차부터 msgbody가 계속 본문에 남아 있음
            let crud = (editMsgId.value) ? "U" : "C"
            const rq = { 
                crud: crud, chanid: gst.selChanId, msgid: editMsgId.value, body: msgbody.value, //document.getElementById('msgContent').innerHTML,
                num_file: (editMsgId.value) ? 0 : fileBlobArr.value.length, 
                num_image: (editMsgId.value) ? 0 : imgBlobArr.value.length, 
                num_link: (editMsgId.value) ? 0 : linkArr.value.length
            }
            const res = await axios.post("/chanmsg/saveMsg", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            if (crud == "C") {
                await getList({ grid: gst.selGrId, chanid: gst.selChanId, firstMsgMstCdt: savFirstMsgMstCdt }) //저장한 메시지 추가
            } else {
                const item = msglist.value.find(function(row) { return row.MSGID == editMsgId.value })
                item.BODY = msgbody.value
                item.UDT = rs.data.udt
            }
            msgbody.value = ""            
            editMsgId.value = null
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function cancelMsg() {
        msgbody.value = prevEditData
        editMsgId.value = null
    }

    function msgCopied(e) { //procMenu:hover 때문에 메시지를 복사하면 바탕색이 변하는데 아래에서 그걸 원래 배경색으로 환원시킴
        e.currentTarget.style.background = "white"
    }

    async function uploadLink(kind, text) {
        try {
            popupRefKind.value = kind
            linkText.value = text ?? ""
            linkPopupRef.value.open()
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function editorFocused(bool) {
        editorIn.value = bool
        if (!bool) editorBlurDt = Date.now()
    }

    function chkEditorFocus() {
        const ms = Date.now() - editorBlurDt
        if (ms <= 250) return true //에디터 포커스 상태에서 이모티, B, S 등의 이미지(버튼)을 누르면 그 차이가 100단위의 MiliSec 나오는데 여유있게 250으로 줌
        return false //250 넘어가면 에디터 포커스 상태에서 이미지(버튼)을 바로 누른 게 아니라는 의미임
        //위와 같이 체크하는 이유는 selection or range에서는 현재 커서가 있는 노드를 찾을 수 없음 (parentNode를 모두 뒤져도 없음)
        //1) 그래서, 에디터의 focusin/blur event로 하고자 했으나 그 상태값만으로는 체크가 어려움 : 이미지(버튼)을 누르는 순간 blur됨
        //2) blur되어도 클릭하는 순간의 갭이 짧기때문에 그걸 체크해서 disabled/enabled 효과를 내는 것임
        //참고로, let currentNode = window.getSelection().focusNode에서 parent로 올라가면 에디터 노드를 만날 수 있음
    }

    function addEmoti() {
        if (!chkEditorFocus()) return
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) 
        //selection.removeAllRanges()
        const node1 = range.commonAncestorContainer
        let node = document.createElement('span')
        //node.textContent = "<span style='color:green;font-weight:bold'>고고고</span>"
        node.innerHTML = "<span style='color:green;font-weight:bold'>고고고</span>"
        //let selection = window.getSelection() //document.getSelection()
        // selection.empty()
        //let range = selection.getRangeAt(0)
        //selection.removeRange(range)        
        //selection.removeAllRanges()
        range.deleteContents()
        range.insertNode(node)
        selection.removeAllRanges()
    }

    function makeLink() { //문자를 링크로 변환하는 것이며 addlink(별도 추가)와는 다름
        if (!chkEditorFocus()) return
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) 
        let content = range.cloneContents()
        let node = document.createElement('span')
        node.append(content) //content에 html로 읽어오는 메소드는 없고 cloneContents()로만 가능한데 append 하지 않으면 읽지 못함
        const text = node.innerHTML
        node.remove()
        storeCursorPosition()
        uploadLink('makelink', text)
    }

    function wordStyle(type) {
        if (!chkEditorFocus()) return
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) 
        debugger
        const bool = isSelectionInTag('B')
        //const bool1 = isSelectionInTag('B')
        //let content1 = range.cloneContents()
        //let node1 = document.createElement("span")
        //node1.append(content1)
        //console.log(node1.innerHTML+"@@@")

        let content = range.cloneContents()
        let node = document.createElement(type)
        node.append(content)
        range.deleteContents()
        range.insertNode(node)
        inEditor.value.focus()
        //msgbody.value = document.getElementById('msgContent').innerHTML //데이터가 필요시 처리하면 됨
        return
    }
    
    async function okPopup(kind) {
        if (kind == "addlink" || kind == "makelink") {
            const regexp = new RegExp("^https?://")
            if (regexp.test(linkText.value) || regexp.test(linkUrl.value)) { //2개 필드중 하나라도 링크가 있으면 OK
                if (linkText.value.trim() == "") {
                    linkText.value = linkUrl.value.trim()
                } else if (linkUrl.value.trim() == "") {
                    linkUrl.value = linkText.value.trim()
                } else {
                    if (regexp.test(linkText.value) && !regexp.test(linkUrl.value)) {
                        gst.util.setSnack("http(s)://로 시작되는 링크가 필요합니다.", true)
                        return
                    }
                }
            } else {
                gst.util.setSnack("http(s)://로 시작되는 링크가 필요합니다.", true)
                return
            }
            if (kind == "addlink") {
                const rq = { chanid: gst.selChanId, kind: "L", body: linkText.value + gst.cons.deli + linkUrl.value }
                const res = await axios.post("/chanmsg/uploadBlob", rq)
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                linkArr.value.push({ hover: false, text: linkText.value, url: linkUrl.value, cdt: rs.data.cdt })
            } else {
                inEditor.value.focus()
                const range = restoreCursorPosition()
                let node = document.createElement('a')
                node.setAttribute("href", linkUrl.value)
                node.setAttribute("target", "_blank")
                node.style.color = "steelblue"
                node.append(linkText.value)
                range.deleteContents()
                range.insertNode(node)
                range.collapse(false)
                //msgbody.value = document.getElementById('msgContent').innerHTML //데이터가 필요시 처리하면 됨
            }
            linkText.value = ""
            linkUrl.value = ""
            linkPopupRef.value.close()
        }
    }

    function openLink(url) { 
        window.open(url, "_blank") //popup not worked for 'going back' navigation
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

    async function toggleAction(msgid, kind) {
        try {
            const rq = { chanid: gst.selChanId, msgid: msgid, kind: kind }
            const res = await axios.post("/chanmsg/toggleAction", rq)
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    function blobSetting(e, row, idx, row5, idx5) { //row와 idx는 메시지 배열 항목 및 인덱스. row5와 idx5는 file,image,link의 배열 항목 및 인덱스
        let target = ""
        if (row5.KIND == "F") {
            target = "파일"
        } else if (row5.KIND == "I") {
            target = "이미지"
        } else if (row5.KIND == "L") {
            target = "링크"
        }
        gst.ctx.data.header = ""
        gst.ctx.menu = [
            { nm: "링크로 복사", func: function() {
                
            }},
            { nm: "나중을 위해 저장", func: function() {
                
            }},
            { nm: target + " 삭제", color: 'red', func: function() {
                delBlob(row5.KIND, row.MSGID, idx5, idx)
            }}
        ]
        if (row.KIND == "I") {
            gst.ctx.menu.splice(0, 0, { nm: "이미지(원본) 복사", func: function() {
                //이미지 원본 사이즈는 처음 이미지 저장후 load 완료싯점에 다시 한번 서버 호출해 width x height 저장하기로 함
            }})
        }
        gst.ctx.show(e)
    }
    
    async function test() {
        msgbody.value = document.getElementById('msgContent').innerHTML
        return
        const res = await axios.post("/chanmsg/qry", { grid : gst.selGrId, chanid : gst.selChanId })
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return            
        grnm.value = rs.data.chanmst.GR_NM
        channm.value = rs.data.chanmst.CHANNM
        document.title = channm.value
        msglist.value = [...msglist.value, ...rs.data.msglist]
    }
    
    ///////////////////////////////////////////////////////////////////////////아래는 thread 관련임
    function openThread(msgid) {
        thread.value.msgid = msgid
    }

    ///////////////////////////////////////////////////////////////////////////##0 아래는 에디터 관련임
    //https://velog.io/@msdio/window%EC%9D%98-Selection%EA%B3%BC-range%EC%97%90-%EB%8C%80%ED%95%B4%EC%84%9C-%EC%95%8C%EC%95%84%EB%B3%B4%EC%9E%90
    //selection 타입 : none, range, caret. range는 유저가 선택한(드래그한) 범위 / caret은 범위가 아닌 특정 위치의 커서
    //collapse : 선택된 상태에서 선택해제 (range 상태에서 caret 상태로 변경)
    //anchorNode / anchorOffset : selection이 시작되는 위치의 노드/offset을 반환. 일반 텍스트의 노드 이름은 "text"
    //focusNode / focusOffset : selection이 끝나는 위치의 노드/offset을 반환
    //anchor는 시작점, focus는 끝나는 지점을 나타냄. 드래그를 앞→뒤가 아니라 뒤→앞으로 했다면, anchor와 focus는 반대가 됨

    //B(Bold), S(Strike) 등은 팝업이 없어 cursorPos를 기억할 필요가 없으므로 editorIn과 editorBlurDt를 이용해 처리하고
    //팝업이 있어 selection을 잃어버리는 makelink(링크로변환) 등은 prevRange를 사용해야 함 (with storeCursorPosition/restoreCursorPosition)
    function storeCursorPosition() {
        let selection = window.getSelection()
        if (selection.rangeCount == 0) return
        const range = selection.getRangeAt(0) //크롬은 텍스트 드래그가 한번만 가능. 파폭은 Ctrl+드래그(윈도우)로 여러 개 범위 선택
        //cursorPos.node = range.startContainer
        //cursorPos.startOffset = range.startOffset
        //cursorPos.endOffset = range.endOffset
        prevRange = range
    }
                
    function restoreCursorPosition() {
        //let range = null //document.createRange()
        //range.setStart(cursorPos.node, cursorPos.startOffset)
        //range.setEnd(cursorPos.node, cursorPos.endOffset)
        const range = prevRange
        let selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
        return range
    }

    function insertPastedToEditor(type, str) {
        let selection = window.getSelection() //현재 커서 위치나 선택한 범위를 나타냄
        if (selection.rangeCount == 0) return //이 함수가 에디터에 붙이기할 때만을 전제로 하므로 체크는 의미없으나 그대로 두기로 함 
        const range = selection.getRangeAt(0) 
        if (type == "text/html") {
            let node = document.createElement('span')
            node.innerHTML = str
            range.deleteContents()
            range.insertNode(node)
            range.collapse(false)
            inEditor.value.focus()
            //msgbody.value = document.getElementById('msgContent').innerHTML //처리할 필요가 있을 때 추가하기로 함
            return true
        } else if (type == "text/plain") {
            range.deleteContents()
            range.insertNode(document.createTextNode(str))
            range.collapse(false)
            inEditor.value.focus()
            //msgbody.value = document.getElementById('msgContent').innerHTML //처리할 필요가 있을 때 추가하기로 함
            return true
        } else {
            gst.util.setToast("복사/붙이기는 Text/Html/Image만 지원 가능합니다.", 3)
            return false
        }
    }

    function isSelectionInTag(tag) {
        let currentNode = window.getSelection().focusNode
        while (currentNode && (currentNode.nodeName == '#text' || currentNode.id != 'msgContent')) {
            if (currentNode.tagName === tag) return true
            currentNode = currentNode.parentNode;		
        }
        return false
    }

    function htmlView() {
        showHtml.value = true
        msgbody.value = document.getElementById('msgContent').innerHTML
    }
</script>

<template>
    <div class="chan_center">
        <div class="chan_center_header">
            <div class="chan_center_header_left">
                <img class="coImg18" :src="gst.html.getImageUrl(chanimg)" style="margin-right:5px"><!-- - {{ gst.selChanId }}-->
                <div class="coDotDot maintainContextMenu" @click="chanCtxMenu">{{ channm }} [{{ grnm }}]</div>
            </div>
            <div class="chan_center_header_right">
                <div class="topMenu" style="padding:3px;display:flex;align-items:center;border:1px solid lightgray;border-radius:5px;font-weight:bold"
                    @click="chanProperty('member')">
                    <div v-for="(row, idx) in chanmemUnder" style="width:24px;height:24px;display:flex;align-items:center;margin-right:2px">
                        <img v-if="row.url" :src="row.url" style='width:100%;height:100%;border-radius:12px'>
                        <img v-else :src="gst.html.getImageUrl('user.png')" style='width:100%;height:100%'>
                    </div>
                    <span>{{ chandtl.length }}</span>
                </div>
                <div class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                    <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click="chanCtxMenu">
                </div>
            </div>
        </div>
        <div class="chan_center_nav" id="chan_center_nav">
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px 5px 0;border-bottom:3px solid black;border-radius:0" @click="chanMsg('M')">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                <span style="margin-left:5px;font-weight:bold">메시지</span> 
            </div>
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px" @click="chanMsg('F')">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_file.png')">
                <span style="margin-left:5px">파일</span> 
            </div>
        </div> 
        <div class="chan_center_body" id="chan_center_body" ref="scrollArea" @scrollend="onScrollEnd">
            <div v-for="(row, idx) in msglist" :id="row.MSGID" class="msg_body procMenu"  
                :style="row.hasSticker ? {} : { borderBottom: '1px solid lightgray' }"               
                @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @mousedown.right="(e) => rowRight(e, row, idx)">
                <div style="display:flex;align-items:center;cursor:pointer" v-show="!row.stickToPrev">
                    <img v-if="chandtlObj[row.AUTHORID] && chandtlObj[row.AUTHORID].url" :src="chandtlObj[row.AUTHORID].url" 
                        class="coImg32 maintainContextMenu" style="border-radius:16px" @click="(e) => memProfile(e, row)">
                    <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg32 maintainContextMenu" @click="(e) => memProfile(e, row)">
                    <span style="margin-left:9px;font-weight:bold">{{ row.AUTHORNM }}</span>
                    <span style="margin-left:9px;color:dimgray">{{ displayDt(row.CDT) }}</span>
                </div>
                <div style="display:flex;margin:10px 0">
                    <div style="width:40px;display:flex;align-items:center;color:dimgray;cursor:pointer">
                        <span v-show="row.stickToPrev && row.hover">{{ displayDt(row.CDT, true) }}</span>
                    </div>
                    <div v-html="row.BODY" @copy="(e) => msgCopied(e)"></div>                    
                </div>
                <div v-if="row.UDT" style="margin-left:40px;color:dimgray"><span>(편집: </span><span>{{ row.UDT.substring(0, 19) }})</span></div>
                <div class="msg_body_sub"><!-- 반응, 댓글 -->
                    <div v-for="(row1, idx1) in row.msgdtl" class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM" @click="toggleAction(row.MSGID, row1.KIND)">
                        <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                        <span style="margin-left:3px">{{ row1.CNT}}</span>
                    </div>
                    <div v-if="row.msgdtl.length > 0" class="msg_body_sub1">
                        <img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘">
                    </div>     
                    <div v-if="row.reply.length > 0" class="replyAct" @click="openThread(row.MSGID)">
                        <div v-for="(row2, idx2) in row.reply" style="margin-right:0px;padding:0px;display:flex;align-items:center">
                            <img v-if="chandtlObj[row2.AUTHORID] && chandtlObj[row2.AUTHORID].url" :src="chandtlObj[row2.AUTHORID].url" 
                                class="coImg18" style="border-radius:9px">
                            <img v-else :src="gst.html.getImageUrl('user.png')" class="coImg18">
                        </div>
                        <div v-if="row.reply.length < row.replyinfo[0].CNT_BY_USER" style="display:flex;align-items:center;margin-left:2px">
                            ..{{ row.replyinfo[0].CNT_BY_USER }}명
                        </div>
                        <div style="margin:0 5px;display:flex;align-items:center">
                            <span style="margin-right:4px;color:steelblue;font-weight:bold">댓글 </span>
                            <span style="color:steelblue;font-weight:bold">{{ row.replyinfo[0].CNT_EACH }}개</span>
                            <span style="margin:0 4px;color:dimgray">최근 :</span>
                            <span style="color:dimgray">{{ displayDt(row.replyinfo[0].CDT_MAX) }}</span>
                        </div>
                    </div>
                </div>
                <div v-if="row.msgimg.length > 0" class="msg_body_sub"><!-- 이미지 -->
                    <div v-for="(row5, idx5) in row.msgimg" class="msg_image_each" 
                        @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="showImage(row5)">
                        <img :src="row5.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row5)">
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                        </div>
                    </div>                
                </div>
                <div v-if="row.msgfile.length > 0" class="msg_body_sub"><!-- 파일 -->
                    <div v-for="(row5, idx5) in row.msgfile" class="msg_file_each" 
                        @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="downloadFile(row.MSGID, row5)">
                        <div style="height:100%;display:flex;align-items:center">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_download.png')">
                            <span style="margin:0 3px">{{ row5.name }}</span>(<span>{{ hush.util.formatBytes(row5.size) }}</span>)
                        </div>
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                        </div>
                    </div>
                </div>
                <div v-if="row.msglink.length > 0" class="msg_body_sub"><!-- 링크 -->
                    <div v-for="(row5, idx5) in row.msglink" class="msg_file_each"
                        @mouseenter="rowEnter(row5)" @mouseleave="rowLeave(row5)" @click="openLink(row5.url)">
                        <div style="height:100%;display:flex;align-items:center">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_addlink.png')">
                            <span style="margin:0 3px;color:#005192">{{ row5.text }}</span>
                        </div>
                        <div v-show="row5.hover" class="msg_file_seemore">
                            <img class="coImg20 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" @click.stop="(e) => blobSetting(e, row, idx, row5, idx5)">
                        </div>
                    </div>
                </div>
                <div v-show="row.hover" class="msg_proc">
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_watching.png')" title="알아보는중" @click="toggleAction(row.MSGID, 'watching')"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_checked.png')" title="접수완료" @click="toggleAction(row.MSGID, 'checked')"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('emo_done.png')" title="완료" @click="toggleAction(row.MSGID, 'done')"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘" @click="openEmoti(row.MSGID)"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드열기" @click="openThread(row.MSGID)"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달" @click="forwardMsg(row.MSGID)"></span>
                    <span class="procAct"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_later.png')" title="나중에" @click="procLater(row.MSGID)"></span>
                    <span class="procAct">
                        <img class="coImg18 maintainContextMenu" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기" @click="(e) => rowRight(e, row)">
                    </span>
                </div>
            </div>
        </div>
        <div class="chan_center_footer">
            <div class="editor_header">
                <div v-if="editMsgId" style="margin-left:10px;display:flex;align-items:center">
                    <div class="btn" @click="saveMsg" style="margin-right:10px">저장</div>
                    <div class="btn" @click="cancelMsg">취소</div>
                </div>
                <div v-else class="saveMenu" @click="saveMsg">
                    <img class="coImg20" :src="gst.html.getImageUrl('white_send.png')" title="발송">
                </div>
                <img v-if="!editMsgId" class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_addlink.png')" 
                    title="링크추가" @click="uploadLink('addlink')">
                <input v-if="!editMsgId" id="file_upload" type=file multiple hidden @change="uploadFile" />
                <label v-if="!editMsgId" for="file_upload">
                    <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일추가">
                </label>
                <div style="width:8px;height:20px;margin-left:12px;border-left:1px solid dimgray"></div>
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘추가" 
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="addEmoti()">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_makelink.png')" title="링크로변환"
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="makeLink()">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_bold.png')" title="굵게"
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="wordStyle('B')">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_strike.png')" title="취소"
                    :style="{ opacity: editorIn ? 1.0 : 0.5 }" @click="wordStyle('S')">
                <img class="coImg20 editorMenu" :src="gst.html.getImageUrl('dimgray_html.png')" title="HTMLView" 
                    @click="htmlView()"><!--개발자사용-->
            </div>
            <div id="msgContent" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" ref="editorRef" 
                @paste="pasteData" @keyup.enter="keyUpEnter" @focusin="editorFocused(true)" @blur="editorFocused(false)">
            </div>
            <div v-if="showHtml" class="editor_body" style="background:beige">{{ msgbody }}</div>
            <div v-if="imgBlobArr.length > 0 && !editMsgId" class="msg_body_blob">
                <div v-for="(row, idx) in imgBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="showImage(row)" class="msg_image_each">
                    <img :src="row.url" style='width:100%;height:100%' @load="(e) => imgLoaded(e, row)">
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('I', 'temp', idx)">
                    </div>
                </div>                
            </div>
            <div v-if="fileBlobArr.length > 0 && !editMsgId" class="msg_body_blob">
                <div v-for="(row, idx) in fileBlobArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="downloadFile('temp', row)" class="msg_file_each">
                    <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ hush.util.formatBytes(row.size) }}</span>)</div>
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('F', 'temp', idx)">
                    </div>
                </div><!-- 아래 진행바는 db에 파일저장시엔 용량제한이 있으므로 실제 육안으로는 보이지 않고 파일시스템 저장 적용시 대용량에 한해서 보이게 될 것임 -->
                <div v-for="(row, idx) in uploadFileProgress" v-show="row.percent > 0 && row.percent < 100" class="msg_file_each">
                    <div><span style="margin-right:3px">{{ row.name }}</span>(<span>{{ row.size }}</span>)</div>
                    <div class="msg_file_seemore">
                        <span style="padding:0 5px;color:red">{{ row.percent }}%</span>
                    </div>
                </div>
            </div>
            <div v-if="linkArr.length > 0 && !editMsgId" class="msg_body_blob">
                <div v-for="(row, idx) in linkArr" @mouseenter="rowEnter(row)" @mouseleave="rowLeave(row)" @click="openLink(row.url)" class="msg_file_each">
                    <div><span style="margin-right:3px;color:#005192">{{ row.text }}</span></div>
                    <div v-show="row.hover" class="msg_file_del">
                        <img class="coImg14" :src="gst.html.getImageUrl('close.png')" @click.stop="delBlob('L', 'temp', idx)">
                    </div>
                </div>
            </div>
        </div>
    </div>
    <div class="chan_right" v-show="thread.msgid">
        <!--<home-right :thread="thread" />-->
        <!-- <div class="chan_right_header">
            <div class="chan_right_header_left">
                   
            </div>
            <div class="chan_right_header_right">
                
            </div>
        </div>
        <div class="chan_right_body">
            
        </div>
        <div class="chan_right_footer">
            
        </div> -->
    </div>   
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
    <popup-common ref="imgPopupRef" :kind="popupRefKind">
        <div>
            <img :src="imgPopupUrl" :style='imgPopupStyle'>
        </div>
    </popup-common>
    <popup-common ref="linkPopupRef" :kind="popupRefKind" @ev-click="okPopup">
        <div style="display:flex;flex-direction:column">
            <input v-model="linkText" style="width:300px;height:24px;border:1px solid dimgray" placeholder="표시 텍스트" />
            <input v-model="linkUrl" style="width:300px;height:24px;margin-top:15px;border:1px solid dimgray" placeholder="링크 http(s)://" />
            <!-- <span style="margin-top:10px;color:dimgray">링크를 한 필드에만 넣어도 됩니다.</span> -->
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
        font-size:18px;font-weight:bold;cursor:pointer
    }
    .chan_center_header_right {
        width:50%;height:100%;display:flex;align-items:center;justify-content:flex-end;cursor:pointer
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
        display:flex;margin:0 0 0 40px;display:flex;flex-wrap:wrap;justify-content:flex-start;cursor:pointer
    }
    .msg_body_sub1 {
        margin-right:10px;padding:4px 8px;display:flex;align-items:center;background:#e6e7eb;border:1px solid #e6e7eb;border-radius:12px
    }
    .msg_body_sub1:hover {
        background:whitesmoke;border:1px solid dimgray
    }
    .msg_body_sub1:active {
        background:lightsteelblue;border:1px solid lightsteelblue
    }
    .msg_body_blob {
        margin-bottom:5px;padding-left:8px;display:flex;flex-wrap:wrap;justify-content:flex-start
    }
    .msg_file_each {
        position:relative;min-width:100px;height:30px;margin:10px 10px 0 0;padding:0 5px;display:flex;align-items:center;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_file_each:active { background:lightsteelblue }
    .msg_file_seemore {
        position:absolute;top:0;right:0;padding:0 3px;height:30px;display:flex;align-items:center;background:whitesmoke;border-radius:0px
    }
    .msg_file_del {
        position:absolute;top:-10px;right:-10px;width:18px;height:18px;border-radius:9px;display:flex;align-items:center;background:beige
    }
    .msg_image_each {
        position:relative;width:80px;height:80px;margin:10px 10px 0 0;border:1px solid lightgray;border-radius:3px;cursor:pointer
    }
    .msg_proc {
        position:absolute;height:20px;right:3px;top:1px;padding:5px 0 5px 10px;z-index:8888;
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
        width:calc(100% - 10px);min-height:40px;max-height:300px;padding:5px;overflow-y:scroll
    }
    .chan_right {
        width:800px;height:100%; /* 여기에 다시 HomeBody.vue가 들어오므로 chan_center class를 염두에 둬야 함 padding: 0 20px;display:none;flex-direction:column;*/
    }
    /*.chan_right_header {
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
    .nodeRight { display:flex;align-items:center;justify-content:flex-end; }*/
    .topMenu { border-radius:5px;cursor:pointer }
    .topMenu:hover { background:whitesmoke;font-weight:bold }
    .topMenu:active { background:var(--active-color);font-weight:bold }
    .replyAct { display:flex;align-items:center;cursor:pointer }
    .replyAct:hover { background:#e6e7eb;border-radius:12px }
    .replyAct:active { background:var(--active-color) }
    .procMenu { padding:5px;margin-right:10px;border-radius:5px;cursor:text }
    .procMenu:hover { background:whitesmoke }
    .procAct { padding:4px;margin-right:10px;border-radius:5px;background:white;cursor:pointer }
    .procAct:hover { background:lightgray }
    .procAct:active { background:var(--active-color) }
    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .editorMenu:active { background:var(--active-color) }
    .saveMenu { display:flex;align-items:center;padding:5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px }
    .saveMenu:hover { opacity:0.5 }
    .saveMenu:active { background:darkblue;opacity:1.0 }
    .btn { padding:3px 6px;display:flex;align-items:center;color:dimgray;border:1px solid dimgray;border-radius:5px;cursor:pointer }
    .btn:hover { background:lightgray}
    .btn:active { background:var(--active-color)}
</style>
