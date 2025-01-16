<script setup>
    import { ref, onMounted } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

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
            //아래는 지우기 말기 (vue이전에 순수 javascript로 구현해 본 것임)
            // let menuDivAll = document.querySelectorAll('.coMenuDiv')
            // menuDivAll.forEach(menuDiv => menuDiv.addEventListener('mouseenter', e => {
            //     prevX = e.pageX //console.log(e.pageY + "====mouseenter===" + prevX + "@@@@" + menuDiv.offsetTop);
            //     popupMenuOn.value = true
            //     const docHeight = document.documentElement.offsetHeight
            //     if (menuDiv.offsetTop > 300) {
            //         popupMenuPos.value.top = null
            //         popupMenuPos.value.bottom = (docHeight - menuDiv.offsetTop - 150) + "px"
            //     } else {
            //         popupMenuPos.value.top = (menuDiv.offsetTop - 50) + "px"
            //         popupMenuPos.value.bottom = null
            //     } //console.log("popupMenuPos.value.top:"+popupMenuPos.value.top)
            // }))
            // menuDivAll.forEach(menuDiv => menuDiv.addEventListener('mouseleave', e => {
            //     if (e.pageX > prevX) {
            //         //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
            //     } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
            //         popupMenuOn.value = false
            //     }
            // }))
            // let popupMenu = document.querySelector('.popupMenu')
            // popupMenu.addEventListener('mouseleave', e => {
            //     popupMenuOn.value = false
            // })            
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
                const found = listAll.value.find((item) => item.ID == menuDiv.id)
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

    function listRowClick(row, idx) {
        alert(idx + "===" + JSON.stringify(row))
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
                        <div v-for="(row, idx) in listSel" @click="(e) => sideClick(row, idx)" :id="row.ID" class="menu cntTarget">
                            <div class="coMenuDiv" @mouseenter="(e) => mouseEnter(e)" @mouseleave="(e) => mouseLeave(e)">
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
    <Transition>
        <div v-show="popupMenuOn" class="popupMenu" :style="popupMenuPos" @mouseleave="() => { popupMenuOn = false }">
            <div style="width:calc(100% - 12px);height:40px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
                <div style="font-weight:bold">더보기</div>
                <!-- <div>설정</div> -->
            </div>
            <div class="coScrollable" style="width:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto;">
                <div v-for="(row, idx) in listPopupMenu" @click="(e) => listRowClick(row, idx)" :id="row.ID" class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                    <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                        <div class="coMenuContext">
                            <img class="coMenuImg" style="background:var(--second-color)" :src="gst.html.getImageUrl(row.IMG)">
                        </div>
                    </div>
                    <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                        <div style="width:100%;display:flex;align-items:center">
                            <div class="coDotDot" style="margin-top:7px;font-weight:bold">
                                {{ row.NM }}
                            </div>
                        </div>        
                        <div style="width:100%;display:flex;align-items:center">
                            <div class="coDotDot" style="margin-top:3px;font-size:12px">
                                {{ row.RMKS }}
                            </div>
                        </div>        
                    </div>                
                </div>
            </div>
            <div style="width:calc(100% - 12px);height:30px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-top:1px solid var(--border-color);background:var(--bottom-color)">
                <div style="color:steelblue;font-weight:bold">탐색막대 사용자지정</div>
                <!-- <div style="color:darkblue">안내</div> -->
            </div>        
        </div>
    </Transition>
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
    .popupMenu { /* 아래에서 없는(제외된) top or bottom을 popupMenuPos로 표시하고 있음 */
        width:320px;height:380px;position:fixed;left:70px;
        display:flex;flex-direction:column;z-index:9999;
        background:var(--menu-color);border:1px solid var(--border-color);border-radius:8px;box-shadow:2px 2px 2px var(--shadow-color)
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:var(--menu-color);cursor:pointer; }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
