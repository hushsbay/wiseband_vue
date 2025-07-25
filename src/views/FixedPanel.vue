<script setup>
    import { ref, onMounted, onActivated, onUnmounted, nextTick } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    import MemberPiceach from "/src/components/MemberPiceach.vue"
    import Resizer from "/src/components/Resizer.vue"
        
    const router = useRouter()
    const route = useRoute()
    const gst = GeneralStore()

    defineExpose({ procMainToMsglist, procMainToPanel })
    
    async function procMainToMsglist(kind, obj) { //단순 전달
        if (msglistRef.value && msglistRef.value.procMainToMsglist) { //없을 수도 있으므로 체크 필요
            await msglistRef.value.procMainToMsglist(kind, obj)
        }
    }

    async function procMainToPanel(kind, obj) {
        if (kind == "procRows") {
            await procRows()
        }
    }

    let observerBottom = ref(null), observerBottomTarget = ref(null), afterScrolled = ref(false)

    let keepAliveRef = ref(null)
    const msglistRef = ref(null)    
    let scrollArea = ref(null), listFixed = ref([]), cntFixed = ref(0), msgRow = ref({}) //msgRow는 element를 동적으로 할당
    let savPrevMsgMstCdt = hush.cons.cdtAtLast //가장 큰 일시(9999-99-99)로부터 시작해서 스크롤이 내려갈 때마다 점점 작은 일시가 저장됨
    let mounting = true, onGoingGetList = false

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_fixedsidewidth ?? '300px') //localStorage 이름 유의
    let chanMainWidth = ref('calc(100% - ' + chanSideWidth.value + ')')

    function handleFromResizer(chanSideVal, chanMainVal) {
        chanSideWidth.value = chanSideVal
        chanMainWidth.value = chanMainVal
    }
    //////////////////////////////////////////////////////////////////////////////////////

    const observerBottomScroll = () => {
        observerBottom.value = new IntersectionObserver(async (entry) => {
            if (entry[0].isIntersecting) {
                await getList()
            } else {
                return
            }
        })
        observerBottom.value.observe(observerBottomTarget.value)
    }

    onMounted(async () => {
        try {
            gst.util.chkOnMountedTwice(route, 'FixedPanel')
            setBasicInfo()
            await getList(true)            
            fixedClickOnLoop(true)
            observerBottomScroll()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        try {
            if (mounting) {
                mounting = false
            } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 바로 호출되고 onMounted()는 미호출됨
                setBasicInfo()
                if (route.path == "/main/fixed") { //사이드메뉴에서 클릭한 경우
                    fixedClickOnLoop(true)
                } else {
                    //MsgList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
                }
                observerBottomScroll()       
                await procRows() 
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onUnmounted(() => {
        if (observerBottom && observerBottom.value) observerBottom.value.disconnect()
    })

    function setBasicInfo() {
        document.title = "WiSEBand 나중에"
        gst.selSideMenu = "mnuFixed" //MsgList.vue에 Blank 방지
    }

    const onScrolling = () => {
        if (afterScrolled.value == false) afterScrolled.value = true //false 조건에 유의 (아니면 마지막 hide 안됨)
    }

    async function procRows() {
        if (listFixed.value.length > 0) {
            const row = listFixed.value[listFixed.value.length - 1]
            await getList(null, row.UDT) //가장 오래된 메시지 일시로 패널내 모든 데이터를 읽어와서 기존과 비교하고자 함
        } else { 
            await getList(true) //await getList(null, hush.cons.cdtAtFirst)
        }
    }

    async function getList(refresh, oldestMsgDt) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            if (refresh) {
                listFixed.value = []
                savPrevMsgMstCdt = hush.cons.cdtAtLast
            }
            const prevMsgMstCdt = savPrevMsgMstCdt
            const res = await axios.post("/menu/qryPanel", { kind: "fixed", prevMsgMstCdt: prevMsgMstCdt, oldestMsgDt: oldestMsgDt })
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            if (!rs) {
                onGoingGetList = false
                afterScrolled.value = null
                return
            }
            if (rs.list.length == 0) {
                onGoingGetList = false
                afterScrolled.value = null
                if (oldestMsgDt) { //패널에 한개 남았을 때 DT보다 큰걸 조회하면 length가 0로 나와서 여기로 들어오는데 key1,key2로 찾아 있으면 업데이트 없으면 제거하면 됨
                    for (let i = 0; i < listLater.value.length; i++) {
                        let row = listLater.value[i]
                        const res = await axios.post("/menu/qryPanel", { kind: kindLater.value, key: row.MSGID })
                        const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
                        if (rs) {
                            if (rs.list.length == 0) {
                                row.checkedForDelete = true
                            } else {
                                listLater.value[i] = rs.list[0] //하나만 존재
                                row = listLater.value[i]
                                setRowPicture(row)
                            }
                        }
                    }
                    const len = listLater.value.length
                    for (let i = len - 1; i >= 0; i--) {
                        const row = listLater.value[i]
                        if (row.checkedForDelete) {
                            listLater.value.splice(i, 1)
                        }
                    }
                }
                return
            }
            if (!oldestMsgDt) {
                afterScrolled.value = false
                for (let i = 0; i < rs.list.length; i++) {
                    const row = rs.list[i]
                    //row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                    setRowPicture(row)
                    listFixed.value.push(row)
                    if (row.CDT < savPrevMsgMstCdt) savPrevMsgMstCdt = row.CDT
                }
                await nextTick()
                if (prevMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                    scrollArea.value.scrollTo({ top: 0 }) //{ top: scrollArea.value.scrollHeight }
                } else if (prevMsgMstCdt) {
                    //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
                }
                getCount()
            } else {
                let len = listFixed.value.length //기존 데이터
                const arr = rs.list //새로 읽어온 데이터                
                for (let i = 0; i < len; i++) {
                    const row = listFixed.value[i]
                    //if (!row) break //중간에 항목 삭제가 있는데 len은 그대로 둘것이므로 체크해야 함
                    const idx = arr.findIndex((item) => item.MSGID == row.MSGID)
                    if (idx > -1) {
                        const item = arr[idx]    
                        if (row.BODYTEXT != item.BODYTEXT) {
                            setRowPicture(item)
                            listFixed.value[i] = item //MsgList에 반영되어야 함 OK
                        }
                        item.checkedForUpdate = true //새로운 배열에서 구배열과의 비교를 완료했다는 표시 (아래에서 이것 빼고 추가할 것임)
                    } else { //구배열의 항목이 새배열에 없으면 아예 삭제해야 함
                        //listFixed.value.splice(i, 1) //MsgList에 해당 채널이 떠 있다면 그것도 막아야 함 OK
                        row.checkedForDelete = true
                    }
                }
                len = listFixed.value.length
                for (let i = len - 1; i >= 0; i--) {
                    const row = listFixed.value[i]
                    if (row.checkedForDelete) {
                        listFixed.value.splice(i, 1)
                    }
                }
                len = arr.length
                for (let i = len - 1; i >= 0; i--) {
                    const item = arr[i]
                    if (!item.checkedForUpdate) { //신규로 추가된 방인데 배열의 맨위로 넣으면 됨
                        setRowPicture(item)
                        listFixed.value.unshift(item) //최초 생성된 방인데 (알림바를 누르면 패널에 추가되어 보여야 하고) MsgList에 메시지도 보여야 함 OK
                    }
                }
            }
            onGoingGetList = false
        } catch (ex) {
            onGoingGetList = false
            gst.util.showEx(ex, true)
        }
    }

    function setRowPicture(row) {
        row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
    }

    function fixedClickOnLoop(clickNode, msgid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 false. msgid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        try {
            const msgidToChk = msgid ? msgid : localStorage.wiseband_lastsel_fixedmsgid
            let foundIdx = -1
            listFixed.value.forEach((item, index) => {
                if (item.MSGID == msgidToChk) {
                    gst.util.scrollIntoView(msgRow, msgidToChk)
                    fixedClick(item, index, clickNode, msgid)
                    foundIdx = index
                }
            })
            if (foundIdx == -1 && listFixed.value.length > 0) { //무한스크롤이므로 다음 페이지에서 선택된 것은 못가져오는데 그 경우는 처음 노드를 기본으로 선택하도록 함
                const row = listFixed.value[0]
                fixedClick(row, 0, true)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    async function fixedClick(row, idx, clickNode, msgid) {
        try {            
            listFixed.value.forEach((item) => {
               item.sel = false
               item.hover = false
            })
            if (msgid) { //Back() 경우
                const row1 = listFixed.value.find((item) => item.MSGID == msgid)
                if (row1) {
                    row1.sel = true
                    localStorage.wiseband_lastsel_fixedmsgid = msgid
                }
            } else {
                row.sel = true
                localStorage.wiseband_lastsel_fixedmsgid = row.MSGID
                if (clickNode) gst.util.goMsgList('fixed_body', { chanid: row.CHANID, msgid: row.MSGID })
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function changeAction(kind, row) { //delete만 존재
        try { //처리된 내용을 본인만 보면 되므로 소켓으로 타인에게 전달할 필요는 없음
            const msgid = row.MSGID
            const rq = { chanid: row.CHANID, msgid: msgid, kind: kind }
            const res = await axios.post("/chanmsg/changeAction", rq)
            let rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return //아래에서는 뭐가 되었던 현재 보이는 Fixed 패널 탭에서는 제거해야 함
            const idx = listFixed.value.findIndex((item) => item.MSGID == msgid)
            if (idx > -1) listFixed.value.splice(idx, 1)
            getCount() //화면에 갯수 업데이트
            if (kind != "delete") return //delete인 경우만 아래에서 MsgList 업데이트
            const msgidParent = (row.REPLYTO) ? row.REPLYTO : msgid //자식에게 처리되어 있는 경우는 부모 색상도 원위치 필요함
            msglistRef.value.procFromParent("fixed", { msgid: msgid, msgidParent: msgidParent, work: "delete" })
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        const url = gst.util.getUrlForBodyListNewWin(row.CHANID, row.MSGID, "fixed")
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {
                window.open(url)
            }},
            { nm: "메시지 링크 복사", deli: true, func: function(item, idx) {
                navigator.clipboard.writeText(url).then(() => {
                    gst.util.setToast("메시지 링크가 복사되었습니다.")
                }).catch(() => {
                    gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                })
            }},
            { nm: "제거", color: "red", func: function(item, idx) {
                changeAction('delete', row)                
            }}
        ]            
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
        await getList(true)            
        fixedClickOnLoop(true)
    }

    async function handleEvFromMsgList(param) {
        if (param.kind == "selectRow") {
            fixedClickOnLoop(false, param.msgid) //뒤로가기는 clickNode = false
        // } else if (param.kind == "update") {
        //     const row = listFixed.value.find((item) => item.MSGID == param.msgid)
        //     if (row) row.BODYTEXT = param.bodytext
        } else if (param.kind == "procRows") {
            procRows()
        // } else if (param.kind == "create" || param.kind == "delete") { //MsgList.vue의 changeAction() 참조 : { msgid: msgid, kind: work }
        //     if (param.kind == "delete") { 
        //         const idx = listFixed.value.findIndex((item) => item.MSGID == param.msgid)
        //         if (idx > -1) listFixed.value.splice(idx, 1)
        //     } else { //create (화면에 없는 걸 보이게 하는 것임)
        //         const res = await axios.post("/menu/qryPanel", { msgid: param.msgid })
        //         const rs = gst.util.chkAxiosCode(res.data)
        //         if (!rs || rs.list.length == 0) return
        //         const row = rs.list[0]
        //         row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
        //         let added = false
        //         const len = listFixed.value.length
        //         for (let i = 0; i < len; i++) { //최근일시가 맨 위에 있음
        //             if (param.msgid > listFixed.value[i].MSGID) {
        //                 listFixed.value.splice(i, 0, row)
        //                 added = true
        //                 break
        //             }
        //         }
        //         if (!added) listFixed.value.push(row)
        //     }
        //     getCount()
        }
    }

    async function getCount() { //화면에 갯수 업데이트
        try {
            const res = await axios.post("/menu/qryPanelCount", { kind: "fixed" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            cntFixed.value = rs.list[0].CNT
        } catch (ex) {
            util.showEx(ex, true)
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">고정</div>
            <div class="chan_side_top_right">
                <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_refresh.png')" title="새로고침" style="margin-right:12px" @click="refreshPanel">
                <span style="color:white;font-size:15px;font-weight:bold">{{ cntFixed }}</span>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in listFixed" :key="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }" :keyidx="idx"
                class="node" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']" 
                @click="fixedClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;color:lightgray">
                        <div v-if="row.TYP=='GS'" style="display:flex;align-items:center">
                            <span>[DM] {{ row.memnm.join(", ") }}{{ row.memcnt > hush.cons.picCnt ? '..' : '' }}</span>
                        </div>
                        <div v-else style="display:flex;align-items:center">
                            <img class="coImg14" :src="gst.html.getImageUrl(hush.cons.color_light + ((row.STATE == 'A') ? 'channel.png' : 'lock.png'))">
                            <span style="margin-left:3px">{{ row.CHANNM }}</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray">
                        {{ row.REPLYTO ? '댓글' : '' }}
                    </div>
                </div>
                <div class="nodeMiddle">
                    <div style="display:flex;align-items:center">
                        <member-piceach :picUrl="row.url" sizeName="wh32"></member-piceach>
                        <div style="color:white;font-weight:bold;margin-left:5px">{{ row.AUTHORNM }}</div>    
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray;margin-right:3px">
                        {{ hush.util.displayDt(row.CDT, false) }}
                    </div>
                </div>
                <div style="width:100%">
                    <div class="coDotDot" style="color:white;font-weight:bold">{{ row.BODYTEXT }}</div> 
                </div>
            </div>
            <div v-if="listFixed.length == 0" style="width:calc(100% - 20px);height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 '고정' 데이터가 없습니다.<br><br>
                    채널이나 DM 메시지에서 '고정' 처리를<br>
                    누르면 여기에 표시됩니다.
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget">{{ hush.cons.moreData }}</div>
        </div>
    </div>
    <resizer nm="fixed" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listFixed.length > 0" id="chan_body" :style="{ width: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive ref="keepAliveRef">
                <component :is="Component" :key="$route.fullPath" ref="msglistRef" @ev-to-panel="handleEvFromMsgList"/>
            </keep-alive>
        </router-view>
    </div>
    <div v-else id="chan_body" :style="{ width: chanMainWidth }" style="display:flex;justify-content:center;align-items:center">
        <img style="width:100px;height:100px" src="/src/assets/images/color_slacklogo.png"/>
    </div>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>
</template>

<style scoped>    
    .chan_side {
        height:100%; /* width는 resizing처리됨 */
        display:flex;flex-direction:column;background:var(--second-color);border-top-left-radius:10px;border-bottom-left-radius:10px
    }
    .chan_side_top {
        width:100%;height:50px;display:flex;justify-content:space-between;border-bottom:var(--border-lg);cursor:pointer
    }
    .chan_side_top_left {
        width:20%;height:100%;padding-left:10px;display:flex;align-items:center;font-size:18px;font-weight:bold;color:white
    }
    .chan_side_top_right {
        width:80%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
    }
    .chan_side_main {
        width:100%;height:100%;display:flex;display:flex;flex-direction:column;flex:1;overflow-y:auto
    }
    .node { padding:10px;display:flex;flex-direction:column;font-size:15px;border-bottom:var(--border-lg);cursor:pointer }
    .nodeHover, .nodeSel { background:var(--second-hover-color) }
    .nodeMiddle {
        width:100%;height:45px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--second-select-color);cursor:pointer
    }
    .procMenu { padding:3px;margin-left:10px;color:lightgray;font-weight:bold;border-bottom:3px solid rgb(90, 46, 93) }
    .procMenu:hover { color:white;font-weight:bold }
    .procMenuSel { color:white;border-bottom:3px solid white }
</style>
