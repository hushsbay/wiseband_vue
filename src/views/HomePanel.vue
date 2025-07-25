<script setup>
    import { ref, onMounted, onActivated, nextTick } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import MemberList from '/src/components/MemberList.vue'
    import Resizer from "/src/components/Resizer.vue"
            
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    defineExpose({ procMainToMsglist, procMainToPanel })
    const props = defineProps({ fromPopupChanDm: String })
    const emits = defineEmits(["ev-click"])

    async function procMainToMsglist(kind, obj) { //단순 전달
        if (msglistRef.value && msglistRef.value.procMainToMsglist) { //없을 수도 있으므로 체크 필요
            await msglistRef.value.procMainToMsglist(kind, obj)
        }
    }

    async function procMainToPanel(kind, obj) {
        if (kind == "procRows") {
            await procRows()
        } else {
            handleEvFromMsgList({ kind: kind, chanid: obj.CHANID }) //기존 함수 가져다 쓰기
        }
    }

    function listRowClick(row) {
        emits("ev-click", "home", row.CHANID)
    }

    //1) Depth는 1,2 단계만 존재 : 1단계는 사용자그룹 (슬랙의 워크스페이스) 2단계는 채널
    //2) 트리노드는 펼치기/접기 상태 기억해 브라우저를 닫고 열어도 직전 상태를 유지 (예: 새로고침때도 기억)
    //3) 스크롤 위치도 2)와 마찬가지로 기억 => localStorage와 scrollIntoView() 이용해서 현재 클릭한 채널노드를 화면에 보이도록 하는 것으로 변경함

    let keepAliveRef = ref(null), listHome = ref([]), kind = ref('all'), chanRow = ref({}) //chanRow는 element를 동적으로 할당
    let memberlistRef = ref(null), msglistRef = ref(null)//, newRoomJustCreated = ref(false) //newRoomJustCreated 문제있음 - 개선방안 고민하기
    let mounting = true

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_chansidewidth ?? '300px') //localStorage 이름 유의
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')

    function handleFromResizer(chanSideVal, chanMainVal) {
        chanSideWidth.value = chanSideVal
        chanMainWidth.value = chanMainVal
    }
    //////////////////////////////////////////////////////////////////////////////////////

    onMounted(async () => {
        try {
            console.log("Home Mounted..... " + route.fullPath)
            if (!gst.util.chkOnMountedTwice(route, 'HomePanel')) return            
            setBasicInfo()
            if (localStorage.wiseband_lastsel_home) kind.value = localStorage.wiseband_lastsel_home
            await getList()
            if (props.fromPopupChanDm != "Y") { //fromPopupChanDm은 home과 dm만 해당
                console.log("Home Mounted.....click.... " + route.fullPath)
                chanClickOnLoop(true) //MsgList > PopupChanDm > HomePanel에서는 팝업이므로 실행되면 안됨
            } else {
                chanClickOnLoop(false)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        try {
            console.log("Home Activated..... " + route.fullPath)
            if (mounting) {
                mounting = false
            } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 바로 호출되고 onMounted()는 미호출됨
                setBasicInfo()
                if (route.path == "/main/home") { //사이드메뉴에서 클릭한 경우
                    if (props.fromPopupChanDm != "Y") { //fromPopupChanDm은 home과 dm만 해당
                        console.log("Home Activated.....click.... " + route.fullPath)
                        chanClickOnLoop(true) //MsgList > PopupChanDm > HomePanel에서는 팝업이므로 실행되면 안됨
                    } else {
                        chanClickOnLoop(false)
                    }
                } else {
                    //MsgList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
                }
                await procRows()
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    async function changeKind() {
        localStorage.wiseband_lastsel_home = kind.value
        await getList()
        chanClickOnLoop(true)
    }

    function setBasicInfo() {
        if (props.fromPopupChanDm == "Y") { //fromPopupChanDm은 home과 dm만 해당
            //MsgList > PopupChanDm > HomePanel에서는 팝업이므로 gst.selSideMenu가 변경되면 안됨
        } else {
            document.title = "WiSEBand 홈"
            gst.selSideMenu = "mnuHome" //MsgList.vue에 Blank 방지
        }
    }

    async function procRows() {
        await getList(true)
    }

    async function getList(forUpdate) {
        try { //모든 데이터 가져오기 (페이징/무한스크롤 없음)
            const res = await axios.post("/menu/qryChan", { kind : kind.value }) //my,other,all
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            if (!forUpdate) {
                listHome.value = rs ? rs.list : []
            } else {
                let len = listHome.value.length //기존 데이터
                const arr = rs.list //새로 읽어온 데이터   
                for (let i = 0; i < len; i++) {
                    const row = listHome.value[i]
                    //if (!row) break //중간에 항목 삭제가 있는데 len은 그대로 둘것이므로 체크해야 함
                    const idx = arr.findIndex((item) => {
                        return (item.GR_ID == row.GR_ID && item.CHANID == row.CHANID)
                    })
                    if (idx > -1) {
                        const item = arr[idx]
                        if (row.GRMST_UDT != item.GRMST_UDT || row.CHANMST_UDT != item.CHANMST_UDT || row.mynotyetCnt != item.mynotyetCnt) {
                            procChanRowImg(item)
                            listHome.value[i] = item //MsgList에 반영되어야 함 OK
                        }
                        item.checkedForUpdate = true //새로운 배열에서 구배열과의 비교를 완료했다는 표시 (아래에서 이것 빼고 추가할 것임)
                    } else { //구배열의 항목이 새배열에 없으면 아예 삭제해야 함
                        //listHome.value.splice(i, 1) //MsgList에 해당 채널이 떠 있다면 그것도 막아야 함 OK
                        row.checkedForDelete = true
                    }
                }
                let deleteFound = false
                len = listHome.value.length
                for (let i = len - 1; i >= 0; i--) {
                    const row = listHome.value[i]
                    if (row.checkedForDelete) {
                        deleteFound = true
                        break
                    }
                }
                if (deleteFound) {
                    refreshPanel() //dm처럼 배열항목을 삭제하면 베스트지만 트리구조로 복잡하게 얽혀 있어 단순하게 전체 새로고침
                } else {
                    chanClickOnLoop(true)
                    let newFound = false
                    len = arr.length
                    for (let i = len - 1; i >= 0; i--) { //dm에서는 순서가 의미있으나 여기서는 refreshPanel()이므로 의미없음
                        const item = arr[i]
                        if (!item.checkedForUpdate) {
                            newFound = true
                            break
                        }
                    }
                    if (newFound) refreshPanel() //dm처럼 배열항목을 추가하면 베스트지만 트리구조로 복잡하게 얽혀 있어 단순하게 전체 새로고침
                }
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function chanClickOnLoop(clickNode, chanid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 false. chanid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        try {
            const arr = (!localStorage.wiseband_exploded_grid) ? [] : localStorage.wiseband_exploded_grid.split(",")
            let chanidToChk = chanid ? chanid : localStorage.wiseband_lastsel_chanid
            let foundIdx = -1
            listHome.value.forEach((item, index) => { //depth1,2 모두 GR_ID 가지고 있음
                if (arr) { //onMounted때만 해당
                    item.exploded = (arr.indexOf(item.GR_ID) == -1) ? false : true
                    procChanRowImg(item)
                }
                if (item.CHANID == chanidToChk) {
                    const grIdx = listHome.value.findIndex(grItem => grItem.DEPTH == "1" && grItem.GR_ID == item.GR_ID)
                    if (grIdx > -1) { //채널아이디의 그룹이 펼쳐지지 않았으면 펼치기
                        const grRow = listHome.value[grIdx]
                        grRow.exploded = false
                        chanClick(grRow, grIdx)
                    }
                    gst.util.scrollIntoView(chanRow, item.CHANID)
                    chanClick(item, index, clickNode, chanid)
                    foundIdx = index
                }
            })
            if (foundIdx == -1) { //최초 실행시 그룹과 채널이 선택이 없는 경우 맨 처음 그룹과 채널을 선택하게 함 (그룹은 있고 채널은 없는 경우는 문제 없겠지만 그룹조차도 없는 경우는 html로 안내하기)
                const len = listHome.value.length
                if (len == 0) { //패널에 데이터가 없음
                    chanidToChk = chanidToChk ?? hush.cons.state_nodata
                    gst.util.goMsgList('home_body', { chanid: chanidToChk, msgid: hush.cons.state_nodata })
                    return
                }
                for (let i = 0; i < len; i++) {
                    const item = listHome.value[i]
                    if (item.CHANID == null) continue //그룹은 있는데 그 아래 채널이 없는 경우 한 행 '없음'이라고 표시됨
                    item.exploded = (item.CHANID == "") ? false : true
                    chanClick(item, i, true)
                    if (item.CHANID) break //사용자그룹(1단계)노드를 처리하고 채널(2단계)노드를 만나면 처리후 break
                }
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function chanClick(row, idx, clickNode, chanid) { //depth 1,2를 미리 filter해서 하지 말기
        try {
            if (row.DEPTH == "1") { //접기 or 펼치기
                row.exploded = (row.exploded) ? false : true
                procChanRowImg(row)
                for (let i = idx + 1; i < listHome.value.length; i++) {
                    if (listHome.value[i].DEPTH == "1") break
                    listHome.value[i].exploded = row.exploded
                }                
                const arr = [] //브라우저 재실행해도 접기/펼치기 상태 기억해서 그대로 표시하기
                listHome.value.forEach((item) => {
                    if (item.DEPTH == "1" && item.exploded) arr.push(item.GR_ID)
                })
                localStorage.wiseband_exploded_grid = arr.length == 0 ? "" : arr.join(',')                
            } else {
                listHome.value.forEach((item) => {
                    if (item.DEPTH == "2") {
                        item.sel = false
                        item.hover = false
                        procChanRowImg(item)
                    }
                })
                if (row.CHANID == null) return //그룹은 있는데 그 아래 채널이 없는 경우 한 행 '없음'이라고 표시됨
                if (chanid) { //Back() 경우
                    const row1 = listHome.value.find((item) => item.CHANID == chanid)
                    if (row1) {
                        row1.sel = true
                        procChanRowImg(row1)
                        localStorage.wiseband_lastsel_chanid = chanid
                    }
                } else {
                    row.sel = true
                    procChanRowImg(row)
                    localStorage.wiseband_lastsel_chanid = row.CHANID
                    if (props.fromPopupChanDm == "Y") { //fromPopupChanDm은 home과 dm만 해당
                        listRowClick(row)
                    } else {
                        if (clickNode) gst.util.goMsgList('home_body', { chanid: row.CHANID })
                    }
                }
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function procChanRowImg(item) { //svg는 이미지 컬러링이 가능하나 핸들링이 쉽지 않아 png로 별도 이미지 교체로 처리
        if (item.DEPTH == "1") {
            item.nodeImg = item.exploded ? hush.cons.color_light + "expanded.png" : hush.cons.color_light + "collapsed.png"
            item.notioffImg = ""
            item.bookmarkImg = ""
            item.otherImg = ""
        } else {
            if (item.CHANID == null) {
                item.nodeImg = hush.cons.color_light + "channel.png"
                item.notioffImg = ""
                item.bookmarkImg = ""
                item.otherImg = ""
                item.CHANNM = "없음"
            } else {
                item.nodeImg = (item.STATE == "A") ? "channel.png" : "lock.png"
                item.notioffImg = (item.NOTI == "X") ? "notioff.png" : ""
                item.bookmarkImg = (item.BOOKMARK == "Y") ? "bookmark.png" : ""
                item.otherImg = (item.OTHER == "other") ? "person.png" : ""
                const color = item.sel ? hush.cons.color_dark : hush.cons.color_light
                item.nodeImg = color + item.nodeImg
                if (item.notioffImg) item.notioffImg = color + item.notioffImg
                if (item.bookmarkImg) item.bookmarkImg = color + item.bookmarkImg
                if (item.otherImg) item.otherImg = color + item.otherImg
            }
        }
    }

    function procExpCol(type) { //모두필치기,모두접기
        const exploded = (type == "E") ? true : false
        for (let i = 0; i < listHome.value.length; i++) {
            listHome.value[i].exploded = exploded
            procChanRowImg(listHome.value[i])
        }
    }

    async function toggleChanOption(kind, job, row) {
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            const rq = { chanid: row.CHANID, kind: kind, job: job } //kind는 현재 상태, job은 바꿀 상태
            const res = await axios.post("/chanmsg/toggleChanOption", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            const item = listHome.value.find((item) => item.CHANID == row.CHANID)
            if (item) {
                if (kind == "noti") {
                    item.NOTI = job
                } else if (kind == "bookmark") {
                    item.BOOKMARK = job
                }
                procChanRowImg(item)
            }
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        //const img = row.nodeImg.replace(hush.cons.color_light, hush.cons.color_dark)        
        //const nm = !row.CHANID ? row.GR_NM : row.CHANNM
        //gst.ctx.data.header = "<img src='/src/assets/images/" + img + "' class='coImg18' style='margin-right:5px'>" + "<span>" + nm + "</span>"
        gst.ctx.data.header = ""
        if (!row.CHANID) {
            gst.ctx.menu = [
                { nm: "채널 만들기", func: function(item, idx) {
                    memberlistRef.value.open("chan", row.GR_ID, "new")
                }}
            ]
        } else {
            const notiStr = (row.NOTI == "X") ? "켜기" : "끄기"
            const bookmarkStr = (row.BOOKMARK == "Y") ? "해제" : "표시"
            const disableStr = (row.STATE == "P") ? true : false
            //const disableRefresh = (!row.sel) ? true : false
            gst.ctx.menu = [                
                /* 아래는 아직 미사용 : 정확히 어디에 사용할 지 아직 미결정. 주요 소스이므로 지우지 말 것 (향후 실시간 반영때 다시 고민. 현재는 아래 개선점도 있음)
                { nm: "메시지목록 새로고침", disable: disableRefresh, func: async function(item, idx) { //disable의 의미는 선택된 노드가 route.fullPath와 동일한 채널임을 보장함
                    gst.util.setToast("reloading " + row.CHANNM)
                    const ka = keepAliveRef.value._.__v_cache //const mapChild = ka.get(route.fullPath)
                    ka.delete(route.fullPath)
                    gst.util.goMsgList('home_body', { chanid: row.CHANID, msgid: "nocache" }) //동일한 주소 클릭시 라우팅 그대로 있으므로 갈아끼워야 함 (향후 개선하기로 함)
                    setTimeout(function() { gst.util.goMsgList('home_body', { chanid: row.CHANID }, true) }, 1000)
                }},*/
                { nm: "새창에서 열기", func: async function(item, idx) {
                    let url = await gst.util.getUrlForOneMsgNotYet(row.CHANID)
                    window.open(url + "?appType=home")
                }}, //"홈에서 열기" : 슬랙은 자식에게 처리된 경우 해당 부모 메시지에 자식들이 딸린 UI(withreply)여서 필요할 수 있으나 WiSEBand는 부모/자식 모두 동일한 UI이므로 굳이 필요없음
                { nm: "채널 관리", deli: true, img: "color_slacklogo.png", func: function(item, idx) {
                    memberlistRef.value.open("chan", row.GR_ID, row.CHANID, row.CHANNM, row.nodeImg)
                }},
                { nm: "알림 " + notiStr, func: function(item, idx) { 
                    const job = (row.NOTI == "X") ? "" : "X"
                    toggleChanOption("noti", job, row)
                }},
                { nm: "북마크 " + bookmarkStr, func: function(item, idx) { 
                    const job = (row.BOOKMARK == "Y") ? "" : "Y"
                    toggleChanOption("bookmark", job, row)
                }},
                { nm: "채널 링크 복사", disable: disableStr, func: function(item, idx) { //공개채널은 해당 그룹내 복사해서 보내면 클릭해서 볼 수 있으므로 활성화. 비공개(STATE=P)채널은 복사해도 쓸 일이 없음
                    const url = location.protocol + "//" + location.host + "/body/msglist/" + row.CHANID + "/0?appType=home"
                    navigator.clipboard.writeText(url).then(() => { //http://localhost:5173/body/msglist/20250122084532918913033403/0
                        gst.util.setToast("채널 링크가 복사되었습니다.")
                    }).catch(() => {
                        gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                    })
                }}
            ]            
        }
        gst.ctx.show(e)
    }

    function mouseEnter(row) {
        if (row.sel) return
        row.hover = true
    }

    function mouseLeave(row) {
        if (row.sel) return
        row.hover = false
    }

    async function refreshPanel() {
        await getList()
        chanClickOnLoop(true)
        //newRoomJustCreated.value = false
    }

    async function handleEvFromMsgList(param) {
        if (param.kind == "selectRow") {
            chanClickOnLoop(false, param.chanid) //뒤로가기는 clickNode = false
        } else if (param.kind == "updateNotyetCnt") { //사용자가 읽고 나서 갯수 새로 고침
            const row = listHome.value.find((item) => item.CHANID == param.chanid)
            if (row) {
                const res = await axios.post("/menu/qryKindCnt", { chanid: param.chanid, kind: "notyet" })
                const rs = gst.util.chkAxiosCode(res.data)
                if (!rs) return
                row.mynotyetCnt = rs.data.kindCnt
            } else { //refreshPanel() 사용시 MsgList도 다시 Mounted되므로 사용자 액션으로 누르지 않는 한 사용하지 말기
                procRows() //    newRoomJustCreated.value = true
            }
        } else if (param.kind == "refreshPanel") {  //방 나가기,삭제에서 사용
            await refreshPanel()
        //} else if (param.kind == "refreshRow") { //현재까지는 updateNotyetCnt만으로도 잘 처리해 옴
        //    await refreshPanel() //홈에서는 행 새로고침도 그냥 패널 전체 새로고침으로 처리하되 빈도가 높고 반복적인 곳은 사용하지 않기로 함 (향후 필요시 refreshRow 진짜 만들기)
        /*} else if (param.kind == "getMsgListFromMsgid") { //지우지 말 것 (향후 사용가능성) 리얼타임 반영으로 쌓인 중간에 이빨빠진 새 데이터 뿌리기
            //MsgList의 newParentAdded, newChildAdded 관련임. 여기는 자식이 아닌 아예 부모메시지만 넘어옴. 여기 풀려면 모든 패널에 추가해야 함
            gst.util.goMsgList('home_body', { chanid: param.chanid, msgid: param.msgid })*/
        /*} else if (param.kind == "forwardToSide") { //지우지 말 것 (향후 사용가능성) : MsgList okChanDmPopup() 참조
            evToSide(param.kind, param.menu) 향후 사용시 모든 패널에 evToSide 검토 필요 */
        }
    }

    async function handleEvFromMemberList(chanid, kind) { //MemberList에서 실행
        if (kind == "forwardToBody") {
            await msglistRef.value.procFromParent(kind)
        } else {
            await refreshPanel()
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: props.fromPopupChanDm ? '100%' : chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="kind" style="background:var(--second-color);color:var(--second-select-color);border:none" @change="changeKind">
                    <option value="my">내 채널</option>
                    <option value="other">다른 채널</option>
                    <option value="all">모든 채널</option>
                </select>
            </div>
            <!-- <div v-if="newRoomJustCreated" @click="refreshPanel" class="chan_side_top_right"
                style="padding:0 5px 10px 0;display:flex;align-items:center;justify-content:flex-end;color:yellow;cursor:pointer">
                <span style="margin-right:10px;font-weight:bold">새 채널 생성됨</span>
            </div> -->
            <div class="chan_side_top_right">
                <div style="padding:5px;border-radius:8px" @click="refreshPanel">
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_refresh.png')" title="새로고침">
                </div>
                <div style="padding:5px;border-radius:8px" @click="procExpCol('C')">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'collapseall.png')" title="모두접기기">
                </div>
                <div style="padding:5px;border-radius:8px" @click="procExpCol('E')">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'expandall.png')" title="모두펼치기">
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main">
            <div v-for="(row, idx) in listHome" :key="row.DEPTH == '1' ? row.GR_ID : row.CHANID" :ref="(ele) => { chanRow[row.DEPTH == '1' ? row.GR_ID : row.CHANID] = ele }" :keyidx="idx"
                @click="chanClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div v-show="row.DEPTH == '1' || (row.DEPTH == '2' && row.exploded)" :class="['node', row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']">
                    <div class="coDotDot" :title="row.DEPTH == '1' ? row.GR_NM : row.CHANNM" :style="{ paddingLeft: row.DEPTH == '1' ? '0' : '15px' }">
                        <img class="coImg14" :src="gst.html.getImageUrl(row.nodeImg)">
                        {{ row.DEPTH == '1' ? row.GR_NM : row.CHANNM }}
                    </div>
                    <div class="nodeRight">
                        <!--<span style="margin-right:5px;color:darkgray">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span>-->
                        <span :class="row.DEPTH == '1' || row.mynotyetCnt == 0 ? '' : 'coMyNotYet'">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span>
                        <img v-if="row.notioffImg" class="coImg14" style="margin-left:5px" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off">
                        <img v-if="row.bookmarkImg" class="coImg14" style="margin-left:5px" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크">
                        <img v-if="row.otherImg" class="coImg14" style="margin-left:5px" :src="gst.html.getImageUrl(row.otherImg)" title="다른 채널">
                    </div>
                </div>
            </div>
            <div v-if="listHome.length == 0" style="width:calc(100% - 20px);height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 그룹/채널 데이터가 없습니다.<br><br>
                    조직내 협의를 통해 그룹을 생성합니다.<br>
                    그룹 우클릭으로 채널을 생성합니다.<br>
                    DM은 그룹 없이 방을 만들 수 있습니다.
                </div>
            </div>
        </div>        
    </div>
    <resizer nm="chan" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listHome.length > 0 && !$route.fullPath.endsWith('/main/home')" id="chan_body" :style="{ minWidth: chanMainWidth, maxWidth: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive ref="keepAliveRef">
                <component :is="Component" :key="$route.fullPath" ref="msglistRef" @ev-to-panel="handleEvFromMsgList"/>
            </keep-alive>
        </router-view>
    </div>
    <div v-else id="chan_body" :style="{ width: chanMainWidth }" style="display:flex;justify-content:center;align-items:center">
        <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
    </div>
    <member-list ref="memberlistRef" @ev-from-member="handleEvFromMemberList"></member-list>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>    
    .chan_side {
        height:100%; /* width는 resizing처리됨 */
        display:flex;flex-direction:column;background:var(--second-color);border-top-left-radius:10px;border-bottom-left-radius:10px;
    }
    .chan_side_top {
        width:100%;height:50px;display:flex;justify-content:space-between;
    }
    .chan_side_top_left {
        width:40%;height:100%;padding-left:10px;display:flex;align-items:center;
    }
    .chan_side_top_right {
        width:60%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
    }
    .chan_side_main {
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto;  
    }
    .node { /* min-height:36px */
        width:calc(100% - 30px);min-height:36px;padding:0 10px;margin:0 5px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--second-select-color);border-radius:5px;cursor:pointer;
    }
    .nodeRight { display:flex;align-items:center;justify-content:flex-end }
    .coImg20:hover { background:var(--second-hover-color); }
    .coImg20:active { background:var(--active-color);border-radius:9px }
    .nodeHover { background:var(--second-hover-color) }
    .nodeSel { background:var(--second-select-color);color:var(--primary-color) }
</style>
