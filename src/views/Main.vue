<script setup>
    import { ref, onMounted } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import PopupList from "/src/components/PopupList.vue"

    const gst = GeneralStore()
    const router = useRouter()

    const popupMenuOn = ref(false), popupMenuPos = ref({ top:'0px', bottom:'0px' })
    const seeMore = ref(false)
    const listAll = ref([]), listSel = ref([]), listUnSel = ref([]) //listAll = listSel + listUnSel
    let listNotSeen = ref([]), listPopupMenu = ref([]) //listPopupMenu = listUnSel + listNotSeen (더보기에서의 수식이며 다른 경우는 수식이나 데이터가 다름)

    let prevX
    
    onMounted(async () => { 
        try {
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return //rs.data 또는 rs.list로 받음            
            listAll.value = rs.list
            listSel.value = rs.list.filter(x => x.USER_ID != null)
            listUnSel.value = rs.list.filter(x => x.USER_ID == null)
            decideSeeMore()
            window.addEventListener('resize', () => { decideSeeMore() })          
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function decideSeeMore() {
        listNotSeen.value = []
        const sideTop = document.querySelector('#sideTop')
        const sizeH = sideTop.offsetTop + sideTop.offsetHeight
        let targetAll = document.querySelectorAll('.cntTarget')
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
        if (menuDiv.offsetTop > 300) {
            popupMenuPos.value.top = null
            popupMenuPos.value.bottom = (docHeight - menuDiv.offsetTop - 150) + "px"
        } else {
            popupMenuPos.value.top = (menuDiv.offsetTop - 50) + "px"
            popupMenuPos.value.bottom = null
        }
    }

    function mouseLeave(e) {
        if (e.pageX > prevX) {
            //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
        } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
            popupMenuOn.value = false
        }
    }

    function sideClick(row, idx) {
        alert(idx + "===" + JSON.stringify(row))
    }

    function clickPopupRow(row, idx) {
        alert(idx + "@@@" + JSON.stringify(row))
        popupMenuOn.value = false
    }
</script>

<template>
    <div class="coMain">
        <div class="header">

        </div>
        <div class="body">
            <div class="side">
                <div class="sideTop">
                    <div id="sideTop" class="sideTop">
                        <div v-for="(row, idx) in listSel" @click="(e) => sideClick(row, idx)" :id="row.ID + 'Target'" class="menu cntTarget">
                            <div :id="row.ID" class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
                                <img class="coMenuImg" :src="gst.html.getImageUrl(row.IMG)">
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
                    
                </div>
                <div class="footer">
            
                </div>
            </div>
        </div>
    </div>
    <popup-list :popupOn="popupMenuOn" :popupPos="popupMenuPos" :list="listPopupMenu" @ev-click="clickPopupRow" @ev-leave="popupMenuOn=false"></popup-list> 
</template>

<style scoped>    
    .header {
        width:100%;min-height:50px;
        background:var(--primary-color);
    }
    .body {
        width:100%;height:100%;display:flex;overflow:hidden; /* hidden이 있어야 sidebar의 아랫공간이 always seen 가능 */
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
        width:100%;height:100%;display:flex;
    }
    .footer {
        width:calc(100% - 20px);min-height:40px;margin:auto 0 0 0;padding:0 10px;
        display:flex;align-items:center;
        background:var(--footer-notify-color);        
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:var(--menu-color);cursor:pointer; }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
