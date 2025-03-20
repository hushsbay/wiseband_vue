<script setup>
    import { ref, onMounted, nextTick, watch } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupList from "/src/components/PopupList.vue"

    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    const POPUPHEIGHT = 300
    const popupMenuOn = ref(false) //아래 popupMenuPos는 main_side내 팝업메뉴 (left는 고정. top만 결정하면 됨) 
    const popupMenuPos = ref({ top: '0px', bottom: '0px', height: POPUPHEIGHT + 'px' })
    const popupData = ref({ id: '', lines: false })
    const seeMore = ref(false)
    const listAll = ref([]), listSel = ref([]), listUnSel = ref([]) //listAll = listSel(사용자가 설정한) + listUnSel(사용자가 설정하지 않은) = 더보기에서의 수식
    let listNotSeen = ref([]), listPopupMenu = ref([]) //listPopupMenu = listUnSel(사용자가 설정하지 않은) + listNotSeen(화면에서 육안으로 안보이는) = 더보기에서의 수식
    //## 더보기에서는 사용자가 설정하지 않은 메뉴와 화면에서 육안으로 보이지 않는 메뉴가 화면 사이즈가 변함에 따라 실시간으로 보여져야 함

    let prevX, prevY

    //1. 아래 localStorage 처리 이전에 SPA내에서 Home >> DM 및 A채널 >> B채널과 같이 내부적으로 이동시 이전 상태를 기억하는 것부터 먼저 코딩 => keepalive로 해결함
    //2. localStorage를 사용하는 곳은 1. Main.vue(1개) 2. Home.vue(3개) 총 4군데임 (save/recall)
    //   A) Main.vue = 1) 사이드 메뉴
    //   B) Home.vue = 1) 채널콤보에서 선택한 아이템 2) 채널트리에서 선택한 노드 3) 드래그한 채널트리 넓이
    
    onMounted(async () => { //Main.vue는 App.vue에서 keepalive없는 router-view에서 호출됨
        try {
            document.title = "WiSEBand 메인" //다른 곳에서 title이 업데이트 될 것임
            //console.log(route.fullPath + " : Main.vue") //route.fullPath = /main/home/home_body/20250120084532918913033423/20250122084532918913033403임을 유의
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return   
            listAll.value = rs.list
            listSel.value = rs.list.filter(x => x.USER_ID != null)
            listUnSel.value = rs.list.filter(x => x.USER_ID == null)
            window.addEventListener('resize', () => { decideSeeMore() })
            await nextTick() //아니면 decideSeeMore()에서 .cntTarget가 읽히지 않아 문제 발생
            decideSeeMore()
            let idx = -1            
            const lastSelMenu = localStorage.wiseband_lastsel_menu
            if (lastSelMenu) idx = listSel.value.findIndex((item) => { return item.ID == lastSelMenu })
            idx = (idx == -1) ? 0 : idx
            const row = listSel.value[idx]
            sideClick(row.ID, row, idx) //PopupList.vue내 이벤트에서 popupId(row.ID)가 별도로 필요한 상황이라 row말고도 row.ID param 추가함
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    watch(() => gst.selSideMenu, () => { //Home.vue의 gst.selSideMenu = "mnuHome" 참조
        displayMenuAsSelected(gst.selSideMenu) //Home >> DM >> Back()시 Home을 사용자가 선택한 것으로 표시해야 함
    })

    function decideSeeMore() {
        try {
            listNotSeen.value = []
            const sideTop = document.querySelector('#sideTop')
            const sizeH = sideTop.offsetTop + sideTop.offsetHeight
            let targetAll = document.querySelectorAll('.cntTarget') //더보기 제외 console.log(targetAll.length+"@@@")
            targetAll.forEach(menuDiv => {
                if ((menuDiv.offsetTop + menuDiv.offsetHeight) > sizeH) { //사이드바에서 육안으로 안보이면 listNotSeen에 추가
                    const found = listAll.value.find((item) => item.ID == menuDiv.id.replace("Target", ""))
                    if (found) listNotSeen.value.push(found) //console.log(menuDiv.id+"@@@@")
                }
            })        
            if (listUnSel.value.length > 0 || listNotSeen.value.length > 0) { //(사용자가 원래 선택하지 않은 메뉴 포함해) (화면이 작아진 후) 안 보이는 메뉴가 있으면 더보기 버튼 필요
                seeMore.value = true
            } else {
                seeMore.value = false
            }
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function mouseEnter(e) {
        prevX = e.pageX
        prevY = e.pageY
        const menuDiv = e.target //console.log(e.pageY + "====mouseenter===" + prevX + "===" + menuDiv.offsetTop)
        if (menuDiv.id == "mnuSeeMore") {
            listPopupMenu.value = [...listUnSel.value, ...listNotSeen.value] //위 ## 주석 참조
        } else {
            const found = listAll.value.find((item) => item.ID == menuDiv.id)
            if (!found || found.POPUP != "Y") {
                popupMenuOn.value = false //혹시 떠 있을 팝업 제거
                return
            }
            listPopupMenu.value = [] //임시. 여기서부터는 실시간으로 axios로 가져와도 무방할 것임 (한번 가져오면 그 다음부터는 캐싱..등 고려)
        }
        popupMenuOn.value = true
        const docHeight = document.documentElement.offsetHeight
        if (menuDiv.offsetTop + POPUPHEIGHT > docHeight) {
            popupMenuPos.value.top = null
            popupMenuPos.value.bottom = (docHeight - menuDiv.offsetTop - 100) + "px"
        } else { //100은 사이드메뉴아이템 높이인데 이 화면의 로직에서는 대략 산정해도 무리없음
            popupMenuPos.value.top = (menuDiv.offsetTop - 100) + "px"
            popupMenuPos.value.bottom = null
        }
        popupData.value.id = menuDiv.id
    }

    function mouseLeave(e) {
        const angle = hush.util.getAngle(prevX, prevY, e.pageX, e.pageY)
        if (angle >= -60 && angle <= 60) { //if (e.pageX > prevX) {
            //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
        } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
            popupMenuOn.value = false
        }
    }

    function sideClick(popupId, row, idx) {
        clickPopupRow(popupId, row, idx)
    }

    //더보기 메뉴는 로컬에 저장하기 않는 전제임 (더보기 누르면 나오는 목록 클릭시 저장) row까지 argument로 받는 것은 좀 과하다 싶지만 일단 개발 편의 고려해 처리하고자 함
    function clickPopupRow(popupId, row, idx) {
        try {
            popupMenuOn.value = false
            const id = (popupId == "mnuSeeMore") ? row.ID : popupId //mnuSeeMore일 경우는 무조건 mnuHome
            for (let i = 0; i < listSel.value.length; i++) {
                if (listSel.value[i].sel) listSel.value[i].sel = false
            }
            row.sel = true
            if (id == gst.selSideMenu) return
            if (popupId != "mnuSeeMore") {
                gst.selSideMenu = id
                localStorage.wiseband_lastsel_menu = id
            }
            const obj = { row: row, idx: idx }
            procMenu[id].call(null, obj)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function displayMenuAsSelected(popupId) {
        for (let i = 0; i < listSel.value.length; i++) {
            if (listSel.value[i].ID == popupId) {
                listSel.value[i].sel = true
            } else {
                listSel.value[i].sel = false
            }
        }
        localStorage.wiseband_lastsel_menu = popupId
    }

    const procMenu = { //obj.idx and obj.row
        ["mnuHome"] : (obj) => {
            try {
                router.replace({ path : '/main/home' })
            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        },
        ["mnuDm"] : (obj) => {
            try {
                router.push({ path : '/main/test' })
            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        },
        ["mnuMyAct"] : (obj) => {
            try {
                router.push({ path : '/main/test' })
            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        },
    }
</script>

<template>
    <div class="coMain" @click="gst.ctx.hide">
        <div class="header">

        </div>
        <div class="body">
            <div class="side" id="main_side"> <!--main_side는 Home.vue에서 resizing에서 사용-->
                <div class="sideTop">
                    <div id="sideTop" class="sideTop">
                        <div v-for="(row, idx) in listSel" @click="sideClick(row.ID, row, idx)" :id="row.ID + 'Target'" class="menu cntTarget">
                            <div :id="row.ID" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img :class="['coMenuImg', row.sel ? 'coMenuImgSel' : '']" :src="gst.html.getImageUrl(row.IMG)">
                            </div>
                            <div class="coMenuText">{{ row.NM }}</div>
                        </div>                      
                    </div>
                    <div v-show="seeMore" class="sideBottom"><!--sideTop안에 sideBottom에 들어 있으며 바로 아래는 sideTop과 sibling으로 sideBottom이 있음을 유의-->
                        <div class="menu"><!--더보기엔 cntTarget이 없음을 유의--> 
                            <div id="mnuSeeMore" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img class="coMenuImg" :src="gst.html.getImageUrl('white_option_horizontal.png')">
                            </div>
                            <div class="coMenuText">더보기</div>
                        </div>
                    </div>
                </div>
                <div class="sideBottom">
                    <div class="menu"><img class="menu32" :src="gst.html.getImageUrl('plus.png')"></div>
                    <div class="menu"><img class="menu32" :src="gst.html.getImageUrl('user.png')"></div>
                </div>
            </div>
            <div class="main">
                <div class="content"> <!-- .vue마다 :key 및 keep-alive가 달리 구현되어 있음 -->
                    <router-view v-slot="{ Component }">
                        <keep-alive>
                            <component :is="Component" />
                        </keep-alive>
                    </router-view>
                </div>
                <div class="footer">
            
                </div>
            </div>
        </div>
    </div>
    <popup-list :popupOn="popupMenuOn" :popupPos="popupMenuPos" :list="listPopupMenu" :popupData="popupData"
        @ev-click="clickPopupRow" @ev-leave="popupMenuOn=false">
    </popup-list> 
</template>

<style scoped>    
    .header {
        width:100%;min-height:40px;
        background:var(--primary-color);
    }
    .body {
        width:100%;height:100%;display:flex;
        background:var(--primary-color);overflow:hidden; /* hidden이 있어야 sidebar의 아랫공간이 always seen 가능 */
    }
    .side {
        min-width:70px;height:100%;
        display:flex;flex-direction:column;align-items:center;justify-content:space-between;
        background:var(--primary-color);
    }
    .sideTop {
        display:flex;flex-direction:column;overflow:hidden;
    }
    .sideBottom { /* sidebar의 아랫공간이 always seen 가능하려면 body에 hidden이 필요함 */
        display:flex;flex-direction:column;justify-content:flex-end;
    }
    .main {
        width:calc(100% - 70px);height:100%;display:flex;flex-direction:column;
    }
    .content {
        width:calc(100% - 3px);height:100%;display:flex;margin-right:3px;margin-bottom:3px;
        overflow:hidden;
    }
    .footer {
        width:calc(100% - 20px);min-height:40px;margin:auto 0 0 0;padding:0 10px;
        display:none;align-items:center;
        background:beige;
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:var(--menu-color);cursor:pointer; }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
