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

    defineExpose({ procMainToMsglist })

    let keepAliveRef = ref(null)
    let observerBottom = ref(null), observerBottomTarget = ref(null), afterScrolled = ref(false)
    const msglistRef = ref(null), notyetChk = ref(false)
    let scrollArea = ref(null), listActivity = ref([]), kindActivity = ref('all'), msgRow = ref({}) //msgRow는 element를 동적으로 할당
    let savPrevMsgMstCdt = hush.cons.cdtAtLast //가장 큰 일시(9999-99-99)로부터 시작해서 스크롤이 내려갈 때마다 점점 작은 일시가 저장됨
    let mounting = true, onGoingGetList = false

    async function procMainToMsglist(kind, obj) { //단순 전달
        if (msglistRef.value && msglistRef.value.procMainToMsglist) { //없을 수도 있으므로 체크 필요
            await msglistRef.value.procMainToMsglist(kind, obj)
        }
    }

    ///////////////////////////////////////////////////////////////////////////패널 리사이징
    let chanSideWidth = ref(localStorage.wiseband_lastsel_activitysidewidth ?? '320px') //localStorage 이름 유의
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
            gst.util.chkOnMountedTwice(route, 'ActivityPanel')
            setBasicInfo()
            notyetChk.value = (localStorage.wiseband_notyet_activity == "Y") ? true : false
            kindActivity.value = localStorage.wiseband_lastsel_activity ? localStorage.wiseband_lastsel_activity : "all"
            await getList(true)            
            activityClickOnLoop(true)
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
                if (route.path == "/main/activity") { //사이드메뉴에서 클릭한 경우
                    activityClickOnLoop(true)
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
        gst.selSideMenu = "mnuActivity" //MsgList.vue에 Blank 방지
    }

    const onScrolling = () => {
        if (afterScrolled.value == false) afterScrolled.value = true //false 조건에 유의 (아니면 마지막 hide 안됨 => 계속 onScrolling 반복되어버림)
    }

    function procChangedQuery() {
        localStorage.wiseband_notyet_activity = notyetChk.value ? "Y" : "N"
        getList(true)
    }

    function procQuery(kind) {
        if (kind == "mention") {
            alert("웹에디터와 같이 개발 진행 예정")
            return
        }
        kindActivity.value = kind
        localStorage.wiseband_lastsel_activity = kind
        getList(true)
    }

    async function procRows() {
        if (listActivity.value.length > 0) {
            const row = listActivity.value[listActivity.value.length - 1]
            await getList(null, row.DT) //가장 오래된 메시지 일시로 패널내 모든 데이터를 읽어와서 기존과 비교하고자 함
        } else { 
            await getList(true) //await getList(null, hush.cons.cdtAtFirst)
        }
    }

    async function getList(refresh, oldestMsgDt) {
        try {
            if (onGoingGetList) return
            onGoingGetList = true
            if (refresh) {
                listActivity.value = []
                savPrevMsgMstCdt = hush.cons.cdtAtLast
            }
            const prevMsgMstCdt = savPrevMsgMstCdt
            const yn = notyetChk.value ? "Y" : "N"
            const res = await axios.post("/menu/qryActivity", { kind: kindActivity.value, notyet: yn, prevMsgMstCdt: prevMsgMstCdt, oldestMsgDt: oldestMsgDt })
            const rs = gst.util.chkAxiosCode(res.data, true) //NOT_FOUND일 경우도 오류메시지 표시하지 않기
            if (!rs || rs.list.length == 0) {
                onGoingGetList = false
                afterScrolled.value = null
                return
            }
            if (!oldestMsgDt) {
                afterScrolled.value = false
                for (let i = 0; i < rs.list.length; i++) {
                    const row = rs.list[i]
                    setRowPicture(row)
                    listActivity.value.push(row)
                    if (row.DT < savPrevMsgMstCdt) savPrevMsgMstCdt = row.DT
                }
                await nextTick()
                if (prevMsgMstCdt == hush.cons.cdtAtLast) { //맨 처음엔 최신인 맨 위로 스크롤 이동
                    scrollArea.value.scrollTo({ top: 0 }) //{ top: scrollArea.value.scrollHeight }
                } else if (prevMsgMstCdt) {
                    //최신일자순으로 위에서부터 뿌리면서 스크롤 아래로 내릴 때 데이터 가져오는 것이므로 특별히 처리할 것 없음
                }
            } else {
                let len = listActivity.value.length //기존 데이터
                const arr = rs.list //새로 읽어온 데이터                
                for (let i = 0; i < len; i++) {
                    const row = listActivity.value[i]
                    if (!row) break //중간에 항목 삭제가 있는데 len은 그대로 둘것이므로 체크해야 함
                    const idx = arr.findIndex((item) => item.MSGID == row.MSGID)
                    if (idx > -1) {
                        const item = arr[idx]    
                        if (row.TITLE == "react") { //예) done을 제거하면 msgdtl에 남아 있지 않아서 CHKDT로 비교 불가
                            let updated = false
                            if ((row.msgdtl && !item.msgdtl) || (!row.msgdtl && item.msgdtl)) {
                                updated = true
                            } else if (row.msgdtl.length != item.msgdtl.length) {
                                updated = true
                            } else {
                                for (let i = 0; i < row.msgdtl.length; i++) {
                                    const row1 = row.msgdtl[i]
                                    const item1 = item.msgdtl[i]
                                    if (row1.ID != item1.ID || row1.KIND != item1.KIND) {
                                        updated = true
                                        break
                                    }
                                }
                            }
                            if (updated) {
                                setRowPicture(item)
                                listActivity.value[i] = item //MsgList에 반영되어야 함 OK
                            }                       
                        } else {              
                            if (row.CHKDT != item.CHKDT || row.BODYTEXT != item.BODYTEXT || row.LASTMSG != item.LASTMSG) {
                                setRowPicture(item)
                                listActivity.value[i] = item //MsgList에 반영되어야 함 OK
                            }
                        }
                        item.checkedForUpdate = true //새로운 배열에서 구배열과의 비교를 완료했다는 표시 (아래에서 이것 빼고 추가할 것임)
                    } else { //구배열의 항목이 새배열에 없으면 아예 삭제해야 함
                        listActivity.value.splice(i, 1) //MsgList에 해당 채널이 떠 있다면 그것도 막아야 함 OK
                    }
                }
                len = arr.length
                for (let i = len - 1; i >= 0; i--) {
                    const item = arr[i]
                    if (!item.checkedForUpdate) { //신규로 추가된 방인데 배열의 맨위로 넣으면 됨
                        setRowPicture(item)
                        listActivity.value.unshift(item) //최초 생성된 방인데 (알림바를 누르면 패널에 추가되어 보여야 하고) MsgList에 메시지도 보여야 함 OK
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
        if (row.TITLE == "vip") {
            row.title = "VIP"
        } else if (row.TITLE == "mention") {
            row.title = "맨션"
        } else if (row.TITLE == "thread") {
            row.title = "스레드"
        } else if (row.TITLE == "react") {
            row.title = "반응"
        }
    }

    function activityClickOnLoop(clickNode, msgid) { //clickNode는 노드를 클릭하지 않고 단지 선택된 노드를 색상으로 표시하는 경우 false. msgid는 명시적으로 해당 노드를 지정해서 처리하는 것임
        try {
            const msgidToChk = msgid ? msgid : localStorage.wiseband_lastsel_activitymsgid
            let foundIdx = -1
            listActivity.value.forEach((item, index) => {
                if (item.MSGID == msgidToChk) {
                    gst.util.scrollIntoView(msgRow, msgidToChk)
                    activityClick(item, index, clickNode, msgid)
                    foundIdx = index
                }
            })
            if (foundIdx == -1 && listActivity.value.length > 0) { //무한스크롤이므로 다음 페이지에서 선택된 것은 못가져오는데 그 경우는 처음 노드를 기본으로 선택하도록 함
                const row = listActivity.value[0]
                activityClick(row, 0, true)
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
    
    async function activityClick(row, idx, clickNode, msgid) {
        try { 
            listActivity.value.forEach((item) => {
               item.sel = false
               item.hover = false
            })
            if (msgid) { //Back() 경우
                const row1 = listActivity.value.find((item) => item.MSGID == msgid)
                if (row1) {
                    row1.sel = true
                    localStorage.wiseband_lastsel_activitymsgid = msgid
                }
            } else {
                row.sel = true
                localStorage.wiseband_lastsel_activitymsgid = row.MSGID
                if (clickNode) gst.util.goMsgList('activity_body', { chanid: row.CHANID, msgid: row.MSGID })
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) {
        gst.ctx.data.header = ""
        const url = gst.util.openWinForBodyList(row.CHANID, row.MSGID, "activity")
        gst.ctx.menu = [
            { nm: "새창에서 열기", func: function(item, idx) {
                window.open(url)
            }},
            { nm: "메시지 링크 복사", func: function(item, idx) {
                navigator.clipboard.writeText(url).then(() => {
                    gst.util.setToast("메시지 링크가 복사되었습니다.")
                }).catch(() => {
                    gst.util.setToast("복사 실패. 알 수 없는 문제가 발생했습니다.")
                })
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
        activityClickOnLoop(true)
    }

    async function handleEvFromMsgList(param) {
        if (param.kind == "selectRow") {
            activityClickOnLoop(false, param.msgid) //뒤로가기는 clickNode = false
        } else if (param.kind == "update") {
            const row = listActivity.value.find((item) => item.MSGID == param.msgid)
            if (row) row.BODYTEXT = param.bodytext
        } else if (param.kind == "create" || param.kind == "delete") { //MsgList.vue의 changeAction() 참조 : { msgid: msgid, kind: work }
            if (param.kind == "delete") { 
                const idx = listActivity.value.findIndex((item) => item.MSGID == param.msgid)
                if (idx > -1) listActivity.value.splice(idx, 1)
            } else { //create (화면에 없는 걸 보이게 하는 것임)
                if (kindActivity.value != "later") { 
                    const res = await axios.post("/menu/qryActivity", { msgid: param.msgid })
                    const rs = gst.util.chkAxiosCode(res.data)
                    if (!rs || rs.list.length == 0) return
                    const row = rs.list[0]
                    row.url = (row.PICTURE) ? hush.util.getImageBlobUrl(row.PICTURE.data) : null
                    let added = false
                    const len = listActivity.value.length
                    for (let i = 0; i < len; i++) { //최근일시가 맨 위에 있음
                        if (param.msgid > listActivity.value[i].MSGID) {
                            listActivity.value.splice(i, 0, row)
                            added = true
                            break
                        }
                    }
                    if (!added) listActivity.value.push(row)
                }
            }
        }
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_1">
                <span style="font-size:18px;font-weight:bold">내활동</span>
                <div style="margin-right:5px;display:flex;align-items:center">
                    <input type="checkbox" id="checkbox" v-model="notyetChk" @change="procChangedQuery" /><label for="checkbox" style="margin-right:12px;color:whitesmoke">안읽음</label>
                    <img class="coImg20" :src="gst.html.getImageUrl('whitesmoke_refresh.png')" title="새로고침" style="margin-right:12px" @click="refreshPanel">
                </div>
            </div>
            <div class="chan_side_top_2">
                <div class="procMenu" :class="(kindActivity == 'all') ? 'procMenuSel' : ''" @click="procQuery('all')">
                    전체<span style="margin-left:3px"></span>
                </div>
                <div class="procMenu" :class="(kindActivity == 'vip') ? 'procMenuSel' : ''" @click="procQuery('vip')">
                    VIP
                </div>
                <div class="procMenu" :class="(kindActivity == 'mention') ? 'procMenuSel' : ''" @click="procQuery('mention')">
                    맨션
                </div>
                <div class="procMenu" :class="(kindActivity == 'thread') ? 'procMenuSel' : ''" @click="procQuery('thread')">
                    스레드
                </div>
                <div class="procMenu" :class="(kindActivity == 'react') ? 'procMenuSel' : ''" @click="procQuery('react')">
                    반응
                </div>
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea" @scroll="onScrolling">
            <div v-for="(row, idx) in listActivity" :key="row.MSGID" :ref="(ele) => { msgRow[row.MSGID] = ele }" :keyidx="idx"
                class="node" :class="[row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']" 
                @click="activityClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div style="display:flex;align-items:center;justify-content:space-between">
                    <!-- <div style="display:flex;align-items:center;color:lightgray">
                        <div style="display:flex;align-items:center">
                            <span style="margin-left:3px">[{{ row.title }}]</span>
                            <img class="coImg14" style="margin-left:3px" :src="gst.html.getImageUrl(hush.cons.color_light + ((row.STATE == 'A') ? 'channel.png' : 'lock.png'))">
                            <span style="margin-left:3px">{{ row.CHANNM }}</span>                            
                        </div>
                    </div> -->
                    <div style="width:calc(100% - 35px);display:flex;align-items:center;color:lightgray" class="coDotDot">
			            <span style="margin:0 3px">[{{ row.title }}]</span>
                        <div v-if="row.TYP=='GS'" style="display:flex;align-items:center" class="coDotDot">
                            <span>[DM] {{ row.memnm.join(", ") }}{{ row.memcnt > hush.cons.picCnt ? '..' : '' }}</span>
                        </div>
                        <div v-else style="display:flex;align-items:center">
                            <img class="coImg14" :src="gst.html.getImageUrl(hush.cons.color_light + ((row.STATE == 'A') ? 'channel.png' : 'lock.png'))">
                            <span style="margin-left:3px">{{ row.CHANNM }}</span>
                        </div>
                    </div>
                    <div style="min-width:30px;display:flex;align-items:center;color:lightgray">
                        {{ row.REPLYTO ? '댓글' : '' }}
                    </div>
                </div>
                <div class="nodeMiddle">
                    <div style="display:flex;align-items:center">
                        <div v-if="row.title.endsWith('react')">
                            <img class="coImg24" :src="gst.html.getImageUrl('emo_' + row.KIND + '.png')" :title="row.KIND">
                        </div>
                        <div v-else>
                            <member-piceach :picUrl="row.url" sizeName="wh32"></member-piceach>
                        </div>
                        <div style="color:white;font-weight:bold;margin-left:5px">{{ row.AUTHORNM }}</div>    
                    </div>
                    <div style="display:flex;align-items:center;color:lightgray;margin-right:3px">
                        {{ hush.util.displayDt(row.DT, false) }}
                    </div>
                </div>
                <div style="width:100%">
                    <div v-if="row.BODYTEXT!=''" class="coDotDot" style="color:white"><span v-if="row.TITLE=='thread'">원글: </span><span>{{ row.BODYTEXT }}</span></div> 
                    <div v-if="row.LASTMSG!=''" class="coDotDot" style="color:white">{{ row.LASTMSG }}</div> 
                </div>
                <div style="width:100%;margin-top:5px;display:flex;align-items:center">
                    <div v-for="(row1, idx1) in row.msgdtl">
                        <div class="msg_body_sub1" :title="'['+row1.KIND+ '] ' + row1.NM">
                            <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')">
                            <span style="margin-left:3px">{{ row1.CNT}}</span>
                        </div>
                    </div>
                </div>
                <!-- <div style="display:flex;align-items:center;color:lightgray;margin-right:3px;color:white">
                    {{ row.MSGID }} {{ row.SUBKIND }} 
                </div> -->
            </div>
            <div v-if="listActivity.length == 0" style="width:calc(100% - 20px);height:100%;margin-top:50px;padding:0 10px">
                <div style="width:100%;word-break:break-all;color:white">
                    현재 내활동 데이터가 없습니다.<br><br>
                    채널이나 DM 메시지에서 내활동에 필요한<br>
                    Action을 처리하면 여기에 표시됩니다.
                </div>
            </div>
            <div v-show="afterScrolled" ref="observerBottomTarget" class="coObserverTarget">{{ hush.cons.moreData }}</div>
        </div>
    </div>
    <resizer nm="activity" @ev-from-resizer="handleFromResizer"></resizer>
    <div v-if="listActivity.length > 0" id="chan_body" :style="{ width: chanMainWidth }">
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
        width:100%;height:80px;display:flex;flex-direction:column;border-bottom:var(--border-lg);cursor:pointer
    }
    .chan_side_top_1 {
        width:100%;height:50px;padding-left:10px;display:flex;align-items:center;justify-content:space-between;color:white
    }
    .chan_side_top_2 {
        width:100%;height:20px;padding-right:10px;display:flex;align-items:center
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
    .msg_body_sub1 {
        margin-right:10px;padding:2px 4px;display:flex;align-items:center;background:lightgray;;border-radius:12px
    }
</style>
