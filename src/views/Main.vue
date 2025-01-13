<script setup>
    import { ref, onMounted } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const router = useRouter()

    const menuDivOn = ref(false), menuDivPos = ref({ top:'0px', bottom:'0px' })

    let prevX
    
    onMounted(async () => { 
        try {
            let popupMenu = document.querySelector('.popupMenu')
            let menuDivAll = document.querySelectorAll('.menuDiv')
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
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })
</script>

<template>
    <div class="coMain">
        <div class="header">

        </div>
        <div class="body">
            <div class="side">
                <div class="sideTop">
                    <div class="sideTop">
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_home.png')"></div>
                            <div class="menuText">홈</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_dm.png')"></div>
                            <div class="menuText">DM</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_notify.png')"></div>
                            <div class="menuText">내활동</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_later.png')"></div>
                            <div class="menuText">나중에</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_play.png')"></div>
                            <div class="menuText">자동화</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_file.png')"></div>
                            <div class="menuText">파일</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_member.png')"></div>
                            <div class="menuText">임직원</div>
                        </div>
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_channel.png')"></div>
                            <div class="menuText">채널</div>
                        </div>
                    </div>
                    <div  class="sideBottom">
                        <div class="menu"> 
                            <div class="menuDiv"><img class="menuImg" :src="gst.html.getImageUrl('white_option_horizontal.png')"></div>
                            <div class="menuText">더보기</div>
                        </div>
                    </div>
                </div>
                <div  class="sideBottom">
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
    <!-- <div v-show="menuDivOn" class="popupMenu" :style="menuDivPos">
        <div style="min-width:60px;max-width:300px;display:flex;flex-direction:column;background:ivory;padding:10px;border:1px solid lightgray;border-radius:10px">
            <div style="width:100%;display:flex;justify-content:center;align-items:center">
                00000
            </div>            
        </div>
    </div> -->
    <div class="popupMenu">
        <div style="width:calc(100% - 12px);height:40px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-bottom:1px solid lightgray;background:whitesmoke">
            <div style="font-weight:bold">더보기</div>
            <div>설정</div>
        </div>
        <div class="coScrollable" style="width:100%;display:flex;flex-direction:column;flex:1;overflow-y:auto;">
            <div style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="menuDiv">
                        <img class="menuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:50%;display:flex;padding-top:5px;font-weight:bold;">
                        DM
                    </div>        
                    <div style="width:100%;height:50%;display:flex;font-size:12px">
                        가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사 가나다라 마바사
                    </div>        
                </div>
            </div>
            <div style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="menuDiv">
                        <img class="menuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:50%;display:flex;padding-top:5px;font-weight:bold;">
                        DM
                    </div>        
                    <div style="width:100%;height:50%;display:flex;font-size:12px">
                        가나다라 마바사
                    </div>        
                </div>
            </div>
            <div style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="menuDiv">
                        <img class="menuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:50%;display:flex;padding-top:5px;font-weight:bold;">
                        DM
                    </div>        
                    <div style="width:100%;height:50%;display:flex;font-size:12px">
                        가나다라 마바사
                    </div>        
                </div>
            </div>
            <div style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="menuDiv">
                        <img class="menuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:50%;display:flex;padding-top:5px;font-weight:bold;">
                        DM
                    </div>        
                    <div style="width:100%;height:50%;display:flex;font-size:12px">
                        가나다라 마바사
                    </div>        
                </div>
            </div>
            <div style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="menuDiv">
                        <img class="menuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:50%;display:flex;padding-top:5px;font-weight:bold;">
                        DM
                    </div>        
                    <div style="width:100%;height:50%;display:flex;font-size:12px">
                        가나다라 마바사
                    </div>        
                </div>
            </div>
            <div style="width:100%;min-height:50px;display:flex;align-items:center;border-bottom:1px solid lightgray">
                <div style="width:50px;height:100%;display:flex;align-items:center;justify-content:center">
                    <div class="menuDiv">
                        <img class="menuImg" style="background:lightsteelblue" :src="gst.html.getImageUrl('white_dm.png')">
                    </div>
                </div>
                <div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center">
                    <div style="width:100%;height:50%;display:flex;padding-top:5px;font-weight:bold;">
                        DM
                    </div>        
                    <div style="width:100%;height:50%;display:flex;font-size:12px">
                        가나다라 마바사
                    </div>        
                </div>
            </div>
        </div>
        <div style="width:calc(100% - 12px);height:40px;display:flex;justify-content:space-between;align-items:center;padding:6px;border-top:1px solid lightgray;background:whitesmoke">
            <div style="font-weight:bold">추가</div>
            <div>안내</div>
        </div>        
    </div>
</template>

<style scoped>    
    .header {
        width:100%;min-height:50px;
        background:lightgray;
    }
    .body {
        width:100%;height:100%;display:flex;overflow:hidden; /* hidden이 있어야 sidebar의 아랫공간이 always seen 가능 */
    }
    .side {
        min-width:70px;height:100%;
        display:flex;flex-direction:column;align-items:center;justify-content:space-between;
        background:darkgreen;        
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
        background:white;        
    }
    .footer {
        width:calc(100% - 20px);min-height:40px;margin:auto 0 0 0;padding:0 10px;
        display:flex;align-items:center;
        background:lightyellow;        
    }
    .menu { 
        width:55px;min-height:55px;margin:8px 0px; 
        display:flex;flex-direction:column;justify-content:center;align-items:center;
        color:white;cursor:pointer; }
    .menuDiv { width:35px;height:35px;display:flex;flex-direction:column;align-items:center; }
    .menuImg { width:20px;height:20px;padding:6px;border-radius:8px; }
    .menuImg:hover { width:22px;height:22px;background-color:hsla(160, 100%, 37%, 0.5); }
    .menuText { font-size:12px;color:white;font-weight:bold }
    .menu32 { width:32px;height:32px; }
    .menu32:hover { width:36px;height:36px; }
    .popupMenu { /* 아래에서 제외든 top or bottom을 menuDivPos로 표시하고 있음 */
        width:300px;height:364px;position:fixed;left:70px;top:100px;
        display:flex;flex-direction:column;
        background:white;z-index:9999;border:1px solid lightgray;border-radius:10px;box-shadow:2px 2px 2px grey
    }
</style>
