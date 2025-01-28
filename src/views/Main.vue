<script setup>
    import { ref, onMounted, nextTick } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupList from "/src/components/PopupList.vue"

    const gst = GeneralStore()
    const router = useRouter()

    const POPUPHEIGHT = 300
    const popupMenuOn = ref(false) //아래 popupMenuPos는 main_side내 팝업메뉴 (left는 고정. top or bottom만 결정하면 됨) 
    const popupMenuPos = ref({ position:'fixed', top:'0px', bottom:'0px', left:'70px', width:'320px', height:POPUPHEIGHT+'px' })
    const popupData = ref({ id: '', lines: false })
    const seeMore = ref(false)
    const listAll = ref([]), listSel = ref([]), listUnSel = ref([]) //listAll = listSel + listUnSel (더보기에서의 수식)
    let listNotSeen = ref([]), listPopupMenu = ref([]) //listPopupMenu = listUnSel + listNotSeen (더보기에서의 수식이며 다른 경우는 수식이나 데이터가 다름)

    let prevX
    
    onMounted(async () => { 
        try {
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return    
            listAll.value = rs.list
            listSel.value = rs.list.filter(x => x.USER_ID != null)
            listUnSel.value = rs.list.filter(x => x.USER_ID == null)
            window.addEventListener('resize', () => { decideSeeMore() })
            await nextTick() //아니면 decideSeeMore()에서 .cntTarget가 읽히지 않아 문제 발생
            decideSeeMore()
            const lastSelMenu = localStorage.wiseband_lastsel_menu
            let idx = -1
            if (lastSelMenu) idx = listSel.value.findIndex((item) => { return item.ID == lastSelMenu })
            idx = (idx == -1) ? 0 : idx
            sideClick(listSel.value[idx].ID, listSel.value[idx], idx)
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function decideSeeMore() {
        listNotSeen.value = []
        const sideTop = document.querySelector('#sideTop')
        const sizeH = sideTop.offsetTop + sideTop.offsetHeight
        let targetAll = document.querySelectorAll('.cntTarget') //console.log(targetAll.length+"@@@")
        targetAll.forEach(menuDiv => {
            if ((menuDiv.offsetTop + menuDiv.offsetHeight) > sizeH) {
                const found = listAll.value.find((item) => item.ID == menuDiv.id.replace("Target", ""))
                if (found) listNotSeen.value.push(found) //console.log(menuDiv.id+"@@@@")
            }
        })        
        if (listUnSel.value.length > 0 || listNotSeen.value.length > 0) { //(사용자가 원래 선택하지 않은 메뉴 포함해) (화면이 작아진 후) 눈에 안 보이는 메뉴가 있으면 더보기 버튼 필요
            seeMore.value = true
        } else {
            seeMore.value = false
        }
    }

    function mouseEnter(e) {
        prevX = e.pageX
        const menuDiv = e.target //console.log(e.pageY + "====mouseenter===" + prevX + "===" + menuDiv.offsetTop)
        if (menuDiv.id == "mnuSeeMore") {
            listPopupMenu.value = [...listUnSel.value, ...listNotSeen.value]
        } else {
            const found = listAll.value.find((item) => item.ID == menuDiv.id)
            if (!found || found.POPUP != "Y") return //팝업이 뜨지 않음
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
        if (e.pageX > prevX) {
            //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
        } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
            popupMenuOn.value = false
        }
    }

    function sideClick(popupId, row, idx) {
        clickPopupRow(popupId, row, idx)
    }

    //더보기 메뉴는 로컬에 저장하기 않는 전제임 (더보기 누르면 나오는 목록 클릭시 저장)
    //row까지 받는 것은 좀 과하다 싶지만 일단 개발 편의 고려해 처리하고자 함
    function clickPopupRow(popupId, row, idx) {
        popupMenuOn.value = false
        const id = (popupId == "mnuSeeMore") ? row.ID : popupId
        const obj = { row: row, idx: idx }; procMenu[id].call(null, obj)
        for (let i = 0; i < listSel.value.length; i++) {
            if (listSel.value[i].sel) listSel.value[i].sel = false
        }
        row.sel = true
        if (popupId != "mnuSeeMore" && popupId != localStorage.wiseband_lastsel_menu) {
            localStorage.wiseband_lastsel_menu = popupId
        }
    }

    const procMenu = { //obj.idx and obj,row
        ["mnuHome"] : (obj) => {
            try { //alert("mnuHome====" + obj.idx + "@@@" + JSON.stringify(obj.row))
                router.push({ path : '/main/channel' })
            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        },
        ["mnuDm"] : (obj) => {
            try { //alert("mnuDm====" + obj.idx + "@@@" + JSON.stringify(obj.row))

            } catch (ex) {
                gst.util.showEx(ex, true)
            }
        },
    }
</script>

<template>
    <div class="coMain" @click="gst.ctx.on=false">
        <div class="header">

        </div>
        <div class="body">
            <div class="side" id="main_side"> <!--main_side는 Channel.vue에서 resizng에서 사용-->
                <div class="sideTop">
                    <div id="sideTop" class="sideTop">
                        <div v-for="(row, idx) in listSel" @click="(e) => sideClick(row.ID, row, idx)" :id="row.ID + 'Target'" class="menu cntTarget">
                            <div :id="row.ID" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img :class="['coMenuImg', row.sel ? 'coMenuImgSel' : '']" :src="gst.html.getImageUrl(row.IMG)">
                            </div>
                            <div class="coMenuText">
                                {{ row.NM }}
                            </div>
                        </div>                      
                    </div>
                    <div v-show="seeMore" class="sideBottom">
                        <div class="menu"> 
                            <div id="mnuSeeMore" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img class="coMenuImg" :src="gst.html.getImageUrl('white_option_horizontal.png')">
                            </div>
                            <div class="coMenuText">
                                더보기
                            </div>
                        </div>
                    </div>
                </div>
                <div class="sideBottom">
                    <div class="menu"> 
                        <img class="menu32" :src="gst.html.getImageUrl('plus.png')">
                    </div>
                    <div class="menu"> 
                        <img class="menu32" :src="gst.html.getImageUrl('user.png')">
                    </div>
                </div>
            </div>
            <div class="main">
                <div class="content">
                    <router-view />
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
        width:100%;height:100%;display:flex;flex-direction:column;
    }
    .content {
        width:calc(100% - 3px);height:100%;display:flex;margin-right:3px;margin-bottom:3px;
        overflow:hidden;
    }
    .footer {
        width:calc(100% - 20px);min-height:40px;margin:auto 0 0 0;padding:0 10px;
        display:none;align-items:center;
        background:var(--footer-notify-color);
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:var(--menu-color);cursor:pointer; }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
