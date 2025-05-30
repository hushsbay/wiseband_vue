<script setup>
    import { ref, onMounted, onActivated } from 'vue' 
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

    //1. HomePanel 상태 정의는 아래와 같음
    //   1) Depth는 1,2 단계만 존재 : 1단계는 사용자그룹 (슬랙의 워크스페이스) 2단계는 채널
    //   2) 트리노드는 펼치기/접기 상태 기억해 브라우저를 닫고 열어도 직전 상태를 유지 (예: 새로고침때도 기억)
    //   3) 스크롤 위치도 2)와 마찬가지로 기억 => localStorage와 scrollIntoView() 이용해서 현재 클릭한 채널노드를 화면에 보이도록 하는 것으로 변경함
    //2. HomePanel에서는 MsgList의 라우팅과 Sync를 맞춰야 하는 것이 핵심과제임 
    //   예1) MsgList url에서 뒤로 가기 눌러 다른 MsgList url로 라우팅되면 MsgList가 먼저 호출되므로 HomePanel의 트리노드 등도 같이 맞춰져야 함
    //   예2) 사이드메뉴 '홈'을 누르면 HomePanel이 먼저 호출되고 MsgList가 나중 호출되므로 역으로 같이 맞춰져야 함

    let scrollArea = ref(null), chanRow = ref({}) //chanRow는 element를 동적으로 할당
    let memberlistRef = ref(null), listHome = ref([]), kind = ref('all')
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
            gst.util.chkOnMountedTwice(route, 'HomePanel')
            setBasicInfo()
            if (localStorage.wiseband_lastsel_kind) kind.value = localStorage.wiseband_lastsel_kind
            await getList()
            chanClickOnLoop(true)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    onActivated(async () => {
        if (mounting) {
            mounting = false
        } else { //아래는 onMounted()직후에는 실행되지 않도록 함 : Back()의 경우 onActivated() 호출되고 onMounted()는 미호출됨
            setBasicInfo()
            if (route.path == "/main/home") {
                chanClickOnLoop(true)
            } else {
                //MsgList가 라우팅되는 루틴이며 MsgList로부터 처리될 것임
            }
        }
    })

    async function changeKind() {
        localStorage.wiseband_lastsel_kind = kind.value
        await getList()
        chanClickOnLoop(true)
    }

    function setBasicInfo() {
        document.title = "WiSEBand 홈"
        gst.selSideMenu = "mnuHome" //MsgList.vue에 Blank 방지
    }

    async function getList() {
        try { //모든 데이터 가져오기 (페이징,무한스크롤 필요없음)
            const res = await axios.post("/menu/qryChan", { kind : kind.value }) //my,other,all
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            listHome.value = rs.list
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function chanClickOnLoop(clickNode, chanid) {
        const arr = (!localStorage.wiseband_exploded_grid) ? [] : localStorage.wiseband_exploded_grid.split(",")
        const chanidToChk = chanid ? chanid : localStorage.wiseband_lastsel_chanid
        if (!chanidToChk) return
        listHome.value.forEach((item, index) => { //depth1,2 모두 GR_ID 가지고 있음
            if (arr) { //onMounted때만 해당
                item.exploded = (arr.indexOf(item.GR_ID) == -1) ? false : true
                procChanRowImg(item)
            }
            if (item.CHANID == chanidToChk) {
                if (item.CHANID) gst.util.scrollIntoView(chanRow, item.CHANID) //chanRow.value[item.CHANID].scrollIntoView({ behavior: "smooth", block: "nearest" })
                chanClick(item, index, clickNode, chanid)
            }
        })
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
                    if (clickNode) gst.util.goMsgList('home_body', { chanid: row.CHANID })
                }
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function mouseRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        const img = row.nodeImg.replace(hush.cons.color_light, hush.cons.color_dark)        
        const nm = !row.CHANID ? row.GR_NM : row.CHANNM
        gst.ctx.data.header = "<img src='/src/assets/images/" + img + "' class='coImg18' style='margin-right:5px'>" + "<span>" + nm + "</span>"
        if (!row.CHANID) {            
            gst.ctx.menu = [
                { nm: "채널 생성", func: function(item, idx) {
                    memberlistRef.value.open("chan", "new", row.GR_ID)
                }},
                { nm: "환경 설정" }
            ]
        } else {
            gst.ctx.menu = [
                { nm: "메시지목록 새로고침", func: function(item, idx) {
                    gst.util.goMsgList('home_body', { chanid: row.CHANID }, true)
                }},
                { nm: "새창에서 열기", deli: true, func: async function(item, idx) {
                    let url = gst.util.getUrlForOneMsgNotYet(row.CHANID)
                    window.open(url)
                }},
                { nm: "정보 보기", func: function(item, idx) {
                    memberlistRef.value.open("chan", row.CHANID, row.CHANNM, row.nodeImg)
                }},
                { nm: "즐겨찾기" },
                { nm: "초대" },
                { nm: "복사", img: hush.cons.color_dark + "other.png", child: [
                    { nm: "채널 복사", func: function(item, idx) { 
                        
                    }},
                    { nm: "링크 복사" }
                ]},                
                { nm: "나가기", color: "red" }
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

    async function handleEvFromBody(param) { //MsgList.vue에서 실행
        if (param.kind == "selectRow") {
            chanClickOnLoop(false, param.chanid) //뒤로가기는 clickNode = false
        } else if (param.kind == "updateUnreadCnt") { //사용자가 읽고 나서 갯수 새로 고침
            const row = listHome.value.find((item) => item.CHANID == param.chanid)
            if (!row) return
            const res = await axios.post("/menu/qryKindCnt", { chanid: param.chanid, kind: "notyet" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            row.mynotyetCnt = rs.data.kindCnt
        }
    }

    function handleEvFromMemberList(chanid) { //MemberList에서 실행
        getList() //qryDm으로 하나의 행만 업데이트하기 (신규일 때는 맨 위에 추가하기)
    }
</script>

<template>
    <div class="chan_side" id="chan_side" :style="{ width: chanSideWidth }">
        <div class="chan_side_top">
            <div class="chan_side_top_left">
                <select v-model="kind" style="background:var(--second-color);color:var(--second-select-color);border:none" @change="changeKind">
                    <option value="my">내 채널</option>
                    <option value="other">다른 채널</option>
                    <option value="all">모든 채널</option>
                </select>
            </div>
            <div class="chan_side_top_right">
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('C')">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'collapseall.png')" title="모두접기기">
                </div>
                <div style="padding:5px;border-radius:8px;" @click="procExpCol('E')">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'expandall.png')" title="모두펼치기">
                </div>
                <!-- <div style="padding:5px;border-radius:8px;" @click="newMsg">
                    <img class="coImg20" :src="gst.html.getImageUrl(hush.cons.color_light + 'compose.png')" title="새메시지">
                </div> -->
            </div>
        </div>
        <div class="chan_side_main coScrollable" id="chan_side_main" ref="scrollArea">
            <div v-for="(row, idx) in listHome" :id="row.DEPTH == '1' ? row.GR_ID : row.CHANID"
                :ref="(ele) => { chanRow[row.DEPTH == '1' ? row.GR_ID : row.CHANID] = ele }"
                @click="chanClick(row, idx, true)" @mouseenter="mouseEnter(row)" @mouseleave="mouseLeave(row)" @mousedown.right="(e) => mouseRight(e, row)">
                <div v-show="row.DEPTH == '1' || (row.DEPTH == '2' && row.exploded)" :class="['node', row.hover ? 'nodeHover' : '', row.sel ? 'nodeSel' : '']">
                    <div class="coDotDot" :title="row.DEPTH == '1' ? row.GR_NM : row.CHANNM" :style="{ paddingLeft: row.DEPTH == '1' ? '0' : '15px' }">
                        <img class="coImg14" :src="gst.html.getImageUrl(row.nodeImg)">
                        {{ row.DEPTH == '1' ? row.GR_NM : row.CHANNM }}
                    </div>
                    <div class="nodeRight">
                        <span style="margin-right:5px;color:darkgray">{{ row.mynotyetCnt == 0 ? "" : row.mynotyetCnt }}</span>
                        <img v-if="row.notioffImg" class="coImg14" :src="gst.html.getImageUrl(row.notioffImg)" title="알림Off">
                        <img v-if="row.bookmarkImg" class="coImg14" :src="gst.html.getImageUrl(row.bookmarkImg)" title="북마크">
                        <img v-if="row.otherImg" class="coImg14" :src="gst.html.getImageUrl(row.otherImg)" title="다른 채널">
                    </div>
                </div>
            </div>
        </div>
    </div>
    <resizer nm="chan" @ev-from-resizer="handleFromResizer"></resizer>
    <div id="chan_body" :style="{ width: chanMainWidth }">
        <router-view v-slot="{ Component }">
            <keep-alive>
                <component :is="Component" :key="$route.fullPath" @ev-to-panel="handleEvFromBody"/>
            </keep-alive>
        </router-view>
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
        width:50%;height:100%;padding-left:10px;display:flex;align-items:center;
    }
    .chan_side_top_right {
        width:50%;height:100%;padding-right:10px;display:flex;justify-content:flex-end;align-items:center
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
