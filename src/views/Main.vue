<script setup>
    import { ref, onMounted, nextTick, watch } from 'vue' 
    import { useRouter, useRoute } from 'vue-router'
    import axios from 'axios'

    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupSidemenu from "/src/components/PopupSidemenu.vue"
    import MediaSearch from "/src/components/MediaSearch.vue"

    const gst = GeneralStore()
    const router = useRouter()
    const route = useRoute()

    const POPUPHEIGHT = 300
    const popupMenuOn = ref(false) //바로 아래 popupMenuPos는 main_side내 팝업메뉴 (left는 고정. top만 결정하면 됨) 
    const popupMenuPos = ref({ top: '0px', bottom: '0px', height: POPUPHEIGHT + 'px' })
    const popupData = ref({ id: '', lines: false })
    const seeMore = ref(false)
    const listAll = ref([]), listSel = ref([]), listUnSel = ref([]) //listAll = listSel(사용자가 설정한 메뉴) + listUnSel(사용자가 설정하지 않은 메뉴)
    let listNotSeen = ref([]), listPopupMenu = ref([]) //listPopupMenu = listUnSel(사용자가 설정하지 않은 메뉴) + listNotSeen(화면에서 육안으로 안보이는 메뉴) = 더보기에서의 수식
    //## 더보기를 누르면 사용자가 설정하지 않은 메뉴와 화면에서 육안으로 보이지 않는 메뉴가 (화면 사이즈가 변함에 따라) 실시간으로 보여져야 함

    let prevX, prevY
    let mediaPopupRef = ref(null), searchText = ref('')
    
    onMounted(async () => {
        try {
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return   
            listAll.value = rs.list
            listSel.value = rs.list.filter(x => x.USERID != null)
            listUnSel.value = rs.list.filter(x => x.USERID == null)
            window.addEventListener('resize', () => { decideSeeMore() })
            await nextTick() //아니면 decideSeeMore()에서 .cntTarget가 읽히지 않아 문제 발생
            decideSeeMore()
            let idx = -1    
            let lastSelMenu = localStorage.wiseband_lastsel_menu
            if (lastSelMenu) {
                idx = listSel.value.findIndex((item) => { return item.ID == lastSelMenu })
            } else {
                lastSelMenu = "mnuHome"
            }
            const idxReal = (idx == -1) ? 0 : idx
            const row = listSel.value[idxReal]
            sideClick(lastSelMenu, row, true)
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
            let targetAll = document.querySelectorAll('.cntTarget') //더보기 제외 console.log(targetAll.length)
            targetAll.forEach(menuDiv => {
                if ((menuDiv.offsetTop + menuDiv.offsetHeight) > sizeH) { //사이드바에서 육안으로 안보이면 listNotSeen에 추가
                    const found = listAll.value.find((item) => item.ID == menuDiv.id.replace("Target", ""))
                    if (found) listNotSeen.value.push(found) //console.log(menuDiv.id)
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
        //setTimeout(function() {
            prevX = e.pageX
            prevY = e.pageY
            const menuDiv = e.target //console.log(e.pageY + "====mouseenter===" + prevX + "===" + menuDiv.offsetTop)
            if (menuDiv.id == "mnuSeeMore") {
                listPopupMenu.value = [...listUnSel.value, ...listNotSeen.value] //위 ## 주석 참조
            } else {
                return //더보기 말고 팝업표시하는 것은 육안으로는 화면이 더 복잡해져서 오히려 불편함을 느낌 (주관적) : 향후 필요시 return 빼고 팝업 메뉴 추가하면 됨 (일단은 더보기에 대해서만 팝업 지원)
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
        //}, 500)
    }

    function mouseLeave(e) {
        const angle = hush.util.getAngle(prevX, prevY, e.pageX, e.pageY)
        if (angle >= -60 && angle <= 60) { //if (e.pageX > prevX) {
            //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
        } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
            popupMenuOn.value = false
        }
    }

    //더보기 메뉴는 로컬에 저장하기 않는 전제임 (더보기 누르면 나오는 목록 클릭시 저장) : row까지 argument로 받는 것은 좀 과하다 싶지만 일단 개발 편의 고려해 처리하고자 함
    function sideClick(popupId, row, onMounted) {
        try {
            popupMenuOn.value = false
            const id = (popupId == "mnuSeeMore") ? row.ID : popupId //mnuSeeMore일 경우는 무조건 mnuHome
            for (let i = 0; i < listSel.value.length; i++) {
                if (listSel.value[i].sel) listSel.value[i].sel = false
            }
            row.sel = true
            if (!onMounted && id == gst.selSideMenu) return //사용자 최초 시작시엔 무조건 HomePanel 호출
            if (popupId != "mnuSeeMore") {
                gst.selSideMenu = id
                localStorage.wiseband_lastsel_menu = id
            }
            procMenu[id].call(null, row, onMounted)
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

    async function goRoute(obj, onMounted) {
        //Object.assign(obj, { query : { ver : Math.random() }}) //obj에 merge : 사이드메뉴 클릭시 (예:Home.vue 호출) 캐시 제거하고 호출해야 MsgList.vue 안뜨는 상황 방지될 것임
        if (onMounted) { //사이드메뉴 클릭시 맨 처음 로드시 push로 라우팅하면 오른쪽 공백이 생기므로 replace 필요
            await router.replace(obj)
        } else {
            await router.push(obj)
        }
        popupMenuOn.value = false
    }

    const procMenu = {
        ["mnuHome"] : async (row, onMounted) => { await goRoute({ path: '/main/home' }, onMounted) },        
        ["mnuDm"] : async (row, onMounted) => { await goRoute({ name: 'dm' }, onMounted) },
        ["mnuActivity"] : async (row, onMounted) => { await goRoute({ name: 'activity' }, onMounted) },
        ["mnuLater"] : async (row, onMounted) => { await goRoute({ name: 'later' }, onMounted) },
        ["mnuFixed"] : async (row, onMounted) => { await goRoute({ name: 'fixed' }, onMounted) },
        ["mnuAuto"] : async (row, onMounted) => { 
            gst.util.setToast("미개발된 메뉴입니다.") //await goRoute({ name: 'auto' }, onMounted) 
        },
        ["mnuGroup"] : async (row, onMounted) => { await goRoute({ name: 'group' }, onMounted) }
    }

    function openMsgSearch() {
        mediaPopupRef.value.open("msg", '', '', '', searchText.value.trim())
    }

    async function logout() {
        if (!confirm("로그아웃합니다. 계속 진행할까요?")) return
        gst.auth.logout()
        await goRoute({ name: 'login' }, true)
    }

    function handleEvFromPanel(kind, menu) {
        alert(kind+"==="+menu)
    }
</script>

<template>
    <div class="coMain" @click="gst.ctx.hide">
        <div class="header" id="header"><!-- MsgList에서 id 사용-->
            <div style="display:flex;align-items:center">
                <!-- <img class="coImg32" src="/src/assets/images/color_slacklogo.png"/>
                <div style="margin-left:5px;font-size:22px;color:whitesmoke;font-weight:bold;cursor:pointer"></div> -->
            </div>
            <div style="display:flex;justify-content:center;align-items:center">
                <input type="search" v-model="searchText" @keyup.enter="openMsgSearch()" class="search" placeholder="통합검색키워드"/>
                <div class="btn_basic" @click="openMsgSearch()"><img :src="gst.html.getImageUrl('search.png')" style="width:16;height:16px" ></div>
                <div class="btn_basic" @click="openMsgSearch()"><span>통합검색으로이동</span></div>
            </div>
            <div style="display:flex;justify-content:flex-end;align-items:center;cursor:pointer">
                <span style="margin-right:10px;color:whitesmoke">{{ gst.auth.getCookie("usernm") }}</span>
                <span style="color:whitesmoke;font-weight:bold" @click="logout">Logout</span>
            </div>
        </div>
        <div class="body">
            <div class="side" id="main_side"> <!--main_side는 Home.vue에서 resizing에서 사용-->
                <div class="sideTop" style="margin-top:8px">
                    <div style="margin-bottom:16px;display:flex;justify-content:center;align-items:center">
                        <img class="coImg32" src="/src/assets/images/color_slacklogo.png" style=""/>
                    </div>
                    <div id="sideTop" class="sideTop">
                        <div v-for="(row, idx) in listSel" @click="sideClick(row.ID, row)" :id="row.ID + 'Target'" class="menu cntTarget">
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
                    <div class="menu" style="margin:0"><img class="menu32" :src="gst.html.getImageUrl('plus.png')"></div>
                    <div class="menu" style="margin:0 0 8px 0"><img class="menu32" :src="gst.html.getImageUrl('user.png')"></div>
                </div>
            </div>
            <div class="main">
                <div class="content"><!-- <component :is="Component" :key="$route.fullPath" />로 구현시 MsgList의 $route.fullPath이므로 unique하지 않아 onMounted가 수회 발생 or 무한루프(예:홈 메뉴)-->
                    <router-view v-slot="{ Component }">
                        <keep-alive>                
                            <component :is="Component" :key="$route.fullPath.split('/')[2]" @ev-to-side="handleEvFromPanel"/>
                        </keep-alive>
                    </router-view>
                </div>
                <div class="footer">
                    <div class="coDotDot">
                        {{ gst.bottomMsg }}
                    </div>
                </div>
            </div>
        </div>
    </div>
    <popup-sidemenu :popupOn="popupMenuOn" :popupPos="popupMenuPos" :list="listPopupMenu" :popupData="popupData" @ev-click="sideClick" @ev-leave="popupMenuOn=false"></popup-sidemenu> 
    <media-search ref="mediaPopupRef"></media-search>
</template>

<style scoped>
    .body {
        width:100%;height:100%;display:flex;
        background:var(--primary-color);overflow:hidden; /* hidden이 있어야 sidebar의 아랫공간이 always seen 가능 */
    }
    input[type=search]:focus { outline:2px solid lightgreen }
    .header {
        width:calc(100% - 40px);min-height:45px;padding:0 20px;display:flex;justify-content:space-between;align-items:center;
        background:var(--primary-color);
    }
    .search { width:240px;padding-left:5px;background-color:var(--second-color);color:var(--second-select-color);border:none;border-radius:4px }
    .search::placeholder { color:var(--second-select-color) }
    .btn_basic { 
        height:28px;margin-left:10px;padding:0 8px;display:flex;justify-content:center;align-items:center;
        border:1px solid dimgray;border-radius:4px;background-color:var(--primary-color);color:var(--second-select-color);cursor:pointer 
    }
    .btn_basic:hover { background:var(--second-hover-color) }
    /* .btn_basic:active { background:var(--active-btn) } */
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
        width:calc(100% - 24px);height:24px;margin:auto 0 0 0;padding:0 10px;
        display:flex;align-items:center;
        background:var(-primary-color);color:whitesmoke
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:white;cursor:pointer; 
    }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
