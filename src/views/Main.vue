<script setup>
    import { ref, onMounted } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const router = useRouter()

    const menuDivOn = ref(false), menuDivPos = ref({ top:'0px', bottom:'0px' })
    const seeMore = ref(false)
    const list = ref([])

    let showMore, prevX, menuSeen = []
    
    onMounted(async () => { 
        try {
            const res = await axios.post("/menu/qry", { kind : "side" })
            const rs = gst.util.chkAxiosCode(res.data)
            debugger
            if (!rs) return //rs.data 또는 rs.list로 받음            
            if (rs.data.showMore) showMore = true
            decideSeeMore()
            list.value = rs.list
            let popupMenu = document.querySelector('.popupMenu')
            let menuDivAll = document.querySelectorAll('.coMenuDiv')
            menuDivAll.forEach(menuDiv => menuDiv.addEventListener('mouseenter', e => {
                prevX = e.pageX //console.log(e.pageY + "====mouseenter===" + prevX + "@@@@" + menuDiv.offsetTop);
                menuDivOn.value = true
                const docHeight = document.documentElement.offsetHeight
                if (menuDiv.offsetTop > 300) {
                    menuDivPos.value.top = null
                    menuDivPos.value.bottom = (docHeight - menuDiv.offsetTop - 150) + "px"
                } else {
                    menuDivPos.value.top = (menuDiv.offsetTop - 50) + "px"
                    menuDivPos.value.bottom = null
                } //console.log("menuDivPos.value.top:"+menuDivPos.value.top)
            }))
            menuDivAll.forEach(menuDiv => menuDiv.addEventListener('mouseleave', e => {
                if (e.pageX > prevX) {
                    //마우스가 오른쪽으로 나가면 팝업으로 들어가게 되므로 팝업을 그대로 유지하기로 함
                } else { //console.log(e.pageY + "====leave : " + e.pageX + "===" + prevX);
                    menuDivOn.value = false
                }
            }))
            popupMenu.addEventListener('mouseleave', e => {
                menuDivOn.value = false
            })
            window.addEventListener('resize', e => {
                decideSeeMore()
            })
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    function decideSeeMore() { //개인설정에서 전체메뉴가 아닌 일부메뉴만 사이드바에 추가한 경우는 무조건 더보기 버튼이 보여야 함
        if (showMore) {
            if (!seeMore.value) seeMore.value = true
        } else {
            menuSeen = []
            let sideTop = document.querySelector('#sideTop')
            const sizeH = sideTop.offsetTop + sideTop.offsetHeight
            let targetAll = document.querySelectorAll('.cntTarget')
            targetAll.forEach(menuDiv => {
                if ((menuDiv.offsetTop + menuDiv.offsetHeight) <= sizeH) {
                    menuSeen.push(menuDiv.id) //console.log(menuDiv.id+"@@@@")
                }
            }) //console.log(targetAll.length+"@@@@@@"+menuSeen.length)
            if (menuSeen.length < targetAll.length) {
                seeMore.value = true //눈에 보이는 메뉴 갯수가 총 갯수보다 적으므로 가려져 있음. 따라서, 더보기 버튼 필요
            } else {
                seeMore.value = false
            }
        }
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
                        <div v-for="(row, idx) in list" @click="(e) => rowClick(e, row, idx)" :id="row.menu.ID" class="menu cntTarget">
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl(row.menu.IMG)"></div>
                            <div class="coMenuText">{{ row.menu.NM }}</div>
                        </div>
                        <!--<div id="mnuHome" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_home.png')"></div>
                            <div class="coMenuText">홈</div>
                        </div>
                        <div id="mnuDm" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_dm.png')"></div>
                            <div class="coMenuText">DM</div>
                        </div>
                        <div id="mnuMyAct" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_notify.png')"></div>
                            <div class="coMenuText">내활동</div>
                        </div>
                        <div id="mnuLater" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_later.png')"></div>
                            <div class="coMenuText">나중에</div>
                        </div>
                        <div id="mnuAuto" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_play.png')"></div>
                            <div class="coMenuText">자동화</div>
                        </div>
                        <div id="mnuFile" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_file.png')"></div>
                            <div class="coMenuText">파일</div>
                        </div>
                        <div id="mnuChannel" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_channel.png')"></div>
                            <div class="coMenuText">채널</div>
                        </div>
                        <div id="mnuMember" class="menu cntTarget"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_member.png')"></div>
                            <div class="coMenuText">임직원</div>
                        </div>-->                        
                    </div>
                    <div v-show="seeMore" class="sideBottom">
                        <div class="menu"> 
                            <div class="coMenuDiv"><img class="coMenuImg" :src="gst.html.getImageUrl('white_option_horizontal.png')"></div>
                            <div class="coMenuText">더보기</div>
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
    <div v-show="menuDivOn" class="popupMenu" :style="menuDivPos">
        <div style="width:calc(100% - 12px);height:40px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid var(--border-color);background:white">
            <div style="font-weight:bold">더보기</div>
            <div>설정</div>
        </div>
        <div class="coScrollable" style="width:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto;">
            <div class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="coMenuContext">
                        <img class="coMenuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" title="테스트" style="margin-top:7px;font-weight:bold">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" style="margin-top:3px;font-size:12px">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                </div>
            </div>

            <div class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="coMenuContext">
                        <img class="coMenuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" title="테스트" style="margin-top:7px;font-weight:bold">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" style="margin-top:3px;font-size:12px">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                </div>
            </div>
            <div class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="coMenuContext">
                        <img class="coMenuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" title="테스트" style="margin-top:7px;font-weight:bold">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" style="margin-top:3px;font-size:12px">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                </div>
            </div>
            <div class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="coMenuContext">
                        <img class="coMenuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" title="테스트" style="margin-top:7px;font-weight:bold">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" style="margin-top:3px;font-size:12px">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                </div>
            </div>
            <div class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="coMenuContext">
                        <img class="coMenuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" title="테스트" style="margin-top:7px;font-weight:bold">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" style="margin-top:3px;font-size:12px">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                </div>
            </div>
            <div class="coHover" style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:0px solid var(--border-color)">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="coMenuContext">
                        <img class="coMenuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:calc(100% - 50px);height:100%;display:flex;flex-direction:column">
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" title="테스트" style="margin-top:7px;font-weight:bold">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                    <div style="width:100%;display:flex;align-items:center">
                        <div class="coDotDot" style="margin-top:3px;font-size:12px">
                            가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                        </div>
                    </div>        
                </div>
            </div>
        </div>
        <div style="width:calc(100% - 12px);height:40px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-top:1px solid var(--border-color);background:var(--menu-color)">
            <div style="font-weight:bold">추가</div>
            <div style="color:darkblue">안내</div>
        </div>        
    </div>
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
    .popupMenu { /* 아래에서 제외든 top or bottom을 menuDivPos로 표시하고 있음 */
        width:300px;height:364px;position:fixed;left:70px;
        display:flex;flex-direction:column;z-index:9999;
        background:var(--menu-color);border:1px solid var(--border-color);border-radius:5px;box-shadow:2px 2px 2px var(--shadow-color)
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:var(--menu-color);cursor:pointer; }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
</style>
