<script setup>
    import { ref, onMounted, watch, nextTick } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    
    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    let grnm = ref(''), channm = ref('') //let grid = ref(''), grnm = ref(''), chanid = ref(''), channm = ref('')
    let msglist = ref([])

    /* 라우팅 관련 정리 : 현재는 부모(Main) > 자식(Channel) > 손자(ChannelBody) 구조임
    1. Channel.vue에서 <router-view />를 사용하면 그 자식인 여기 ChannelBody.vue가 한번만 마운트되고 
       그 다음에 router.push해도 다시 마운트(아예 호출도) 안됨 : onMounted가 한번만 호출되고 끝.
    2. 그런데, <router-view :key="$route.fullPath"></router-view>와 같이 :key속성을 사용하면 router.push할 때마다 다시 마운트됨
    3. 그런데, Main.vue에서도 :key를 사용하면 Channel.vue에서 router.push할 때에도 Main.vue의 onMounted가 호출되어 문제가 됨
    4. 따라서, 현재 구조에서는 여기 손자인 ChannelBody.vue를 호출하는 자식인 Channel.vue에서만 :key를 적용하면
       슬랙과 똑같이 채널노드를 클릭할 때마다 라우팅되도록 할 수 있음
       - 만일 손자 아래 증손자가 필요하고 그것도 라우팅으로 처리하려면 매우 복잡한 핸들링이 필요하므로
       - 아예 증손자는 만들지 말든지 아니면 만들어도 라우틴이 아닌 비동기컴포넌트 호출(defineAsyncComponent)하기로 함
       - 슬랙과 똑같이 만드는 목표이기 때문에 이런 라우팅을 했으며 그게 아니라면 애초부터 defineAsyncComponent()를 사용했을 것임
       - 슬랙은 그 이유가 URL로 독자적으로 해당 채널을 부르는 페이지를 제공하려 했을 것인데 그것도 defineAsyncComponent()으로 안될 게 없을 것임
    5. back()시 초기화되는 Vue의 특성상 back()시 이전 채널 선택 상태 복원, 이전 메시지 위치로 스크롤 등의 구현은 반드시 구현 필요
       - <KeepAlive>가 Component의 이전 상태를 그대로 유지해 준다는데 파악 및 테스트가 필요함 
       - 사용자가 마지막으로 선택한 채널, 콤보박스 등은 localStorage로 구현되어 있는데 문제없는지 다시 테스트해보기로 함 */

    onMounted(async () => { //Main.vue와는 달리 라우팅된 상태에서 Back()을 누르면 여기가 실행됨
        try { //:key속성이 적용되는 <router-view 이므로 onMounted가 router.push마다 실행됨을 유의
            //gst.savChanCombo = "my"
            //console.log(route.fullPath+"@@@@@@@channelbody.vue")
            console.log("########channelbody.vue")
            gst.selChanId = route.params.chanid //chanid.value = route.params.chanid
            gst.selGrId = route.params.grid //grid.value = route.params.grid
            await getList()            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    // watch([chanid, grid], async () => {
    //     debugger
    //     //chanid.value = route.params.chanid
    //     //grid.value = route.params.grid
    //     console.log(chanid.value+"##")
    //     await getList() 
    // }) //시 먼저 못읽는 경우도 발생할 수 있으므로 onMounted에서도 처리

    async function getList() {
        try {
            //const res = await axios.post("/chanmsg/qry", { grid : grid.value, chanid : chanid.value })
            const res = await axios.post("/chanmsg/qry", { grid : gst.selGrId, chanid : gst.selChanId })
            const rs = gst.util.chkAxiosCode(res.data)
            //debugger
            if (!rs) return            
            grnm.value = rs.data.chanmst.GR_NM
            channm.value = rs.data.chanmst.CHANNM
            document.title = channm.value
            msglist.value = rs.data.msglist            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function msgRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        // const img = row.nodeImg.replace(LIGHT, DARK)        
        // const nm = !row.CHANID ? row.GR_NM : row.CHANNM
        // gst.ctx.data.header = "<img src='/src/assets/images/" + img + "' class='coImg18' style='margin-right:5px'>" + "<span>" + nm + "</span>"
        // if (!row.CHANID) {            
        //     gst.ctx.menu = [
        //         { nm: "사용자 초대" },
        //         { nm: "채널 생성" },
        //         { nm: "환경 설정" }
        //     ]
        // } else {
        //     gst.ctx.menu = [
        //         { nm: "채널정보 보기", color: "darkgreen", func: function(item, idx) {
        //             alert(item.nm+"@@@@"+idx)
        //         }},
        //         { nm: "복사", img: DARK + "other.png", child: [
        //             { nm: "채널 복사", disable: true, func: function(item, idx) { 
        //                 alert(item.nm+"####"+idx)
        //             }},
        //             { nm: "링크 복사", img: DARK + "other.png", color: "red" }
        //         ]},
        //         { nm: "즐겨찾기 설정", disable: true },
        //         { nm: "채널 나가기", color: "red" }
        //     ]            
        // }
        // gst.ctx.show(e)
    }

    async function msgEnter(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = true
    }

    function msgLeave(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = false
    }

    function test() {
        history.go(-1)
    }
</script>

<template>
    <div class="chan_center">
        <div class="chan_center_header">
            <div class="chan_center_header_left">
                {{ grnm }} >> {{ channm }} [{{ gst.selChanId }}]
            </div>
            <div class="chan_center_header_right" @click="test">
                <span class="topMenu" style="padding:5px 10px;border:1px solid lightgray">멤버 11</span>
                <span class="topMenu" style="padding:5px;margin-top:3px;margin-left:10px">
                    <img class="coImg20" :src="gst.html.getImageUrl('dimgray_option_vertical.png')">
                </span>                
            </div>
        </div>
        <div class="chan_center_nav">
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px 5px 0;border-bottom:2px solid black;border-radius:0">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                <span style="margin-left:5px;font-weight:bold">메시지</span> 
            </div>
            <div class="topMenu" style="display:flex;align-items:center;padding:5px 8px">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_file.png')">
                <span style="margin-left:5px">파일</span> 
            </div>
        </div>
        <div class="chan_center_body">
            <div v-for="(row, idx) in msglist" :id="row.MSGID" class="msg_body procMenu"
                @mouseenter="msgEnter(row)" @mouseleave="msgLeave(row)" @mousedown.right="(e) => msgRight(e, row)">
                <div style="display:flex;align-items:center">
                    <img class="coImg32" :src="gst.html.getImageUrl('user.png')"><span style="margin-left:10px">{{ row.AUTHORNM }} {{ row.CDT }} </span>
                </div>
                <div style="display:flex;margin:10px">
                    <span>{{ row.BODY }}</span>
                </div>
                <div style="display:flex;margin:10px;display:flex;flex-wrap:wrap;justify-content:flex-start">
                    <div v-for="(row1, idx1) in row.msgdtl" style="margin-right:10px;padding:5px;display:flex;background:whitesmoke;border-radius:8px" :title="row1.NM">
                        <img class="coImg18" :src="gst.html.getImageUrl('action_' + row1.KIND + '.png')"> <span style="margin-left:3px">{{ row1.CNT }}</span>
                    </div>
                    <div v-for="(row2, idx2) in row.reply" style="margin-right:0px;padding:0px;display:flex;align-items:center" :title="row2.AUTHORNM">
                        <img class="coImg18" :src="gst.html.getImageUrl('user.png')">
                    </div>
                    <div v-if="row.reply.length > 0" style="margin:0 5px;display:flex;align-items:center">
                        댓글:<span>{{ row.reply.length }}</span>개 (최근:<span>{{ row.reply[0].DT }}</span>)
                    </div>
                </div>
                <div style="display:flex;margin:10px;display:flex;flex-wrap:wrap;justify-content:flex-start">
                    <div v-for="(row3, idx3) in row.msglink" style="margin-right:10px;padding:5px;display:flex;background:whitesmoke;border-radius:8px">
                        <a :href="row3.BODY"><span>{{ row3.BODY }}</span></a>
                    </div>
                </div>
                <div style="display:flex;margin:10px;display:flex;flex-wrap:wrap;justify-content:flex-start">
                    <div v-for="(row4, idx4) in row.msgfile" style="margin-right:10px;padding:5px;display:flex;background:whitesmoke;border-radius:8px">
                        <span>{{ row4.BODY }}</span>
                    </div>
                </div>
                <div style="display:flex;margin:10px;display:flex;flex-wrap:wrap;justify-content:flex-start">
                    <div v-for="(row5, idx5) in row.msgimg" style="margin-right:10px;padding:5px;display:flex;background:whitesmoke;border-radius:8px">
                        <img class="coImg64" :src="gst.html.getImageUrl('edms.png')">
                    </div>
                </div>
                <div v-show="row.hover" class="msg_proc">
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('action_A.png')" title="체크중"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('action_C.png')" title="완료됨"></span>                    
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('action_Z.png')" title="제대로 완료함"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드에 댓글 달기"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_later.png')" title="나중에"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기"></span>
                </div>
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 1111
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 2222                
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
                메시지 테스트입니다. 3333<br>
            </div>
            <div class="msg_body" style="display:flex;flex-direction:column;">
                <div style="display:flex;align-items:center;margin-bottom:10px">
                    <img class="coImg32" :src="gst.html.getImageUrl('user.png')" title="완료됨">
                    <span>이상병 2025-01-01 13:43:22</span>
                </div>
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444 
                메시지 테스트입니다. 4444
                <br><br>
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네 
                구름에 달 가듯이 가는 나그네                
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 5555
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 6666
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 7777                
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 8888
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 9999
            </div>
            <div class="msg_body">
                술익는 마을마다 타는 저녁놀<br>
                술익는 마을마다 타는 저녁놀<br>
                술익는 마을마다 타는 저녁놀<br>
                술익는 마을마다 타는 저녁놀<br>
                술익는 마을마다 타는 저녁놀<br>
                술익는 마을마다 타는 저녁놀<br>
            </div>
            <div class="msg_body">
                메시지 테스트입니다. aaaa
            </div>
            <div class="msg_body">
                메시지 테스트입니다. bbbb
            </div>
            <div class="msg_body">
                메시지 테스트입니다. cccc                
            </div>
            <div class="msg_body">
                메시지 테스트입니다. dddd
            </div>
            <div class="msg_body">
                메시지 테스트입니다. eeee
            </div>
        </div>
        <div class="chan_center_footer">
            <div class="editor_header">
                <div style="display:flex;align-items:center;padding:3px 5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px">
                    <img class="coImg24" :src="gst.html.getImageUrl('white_send.png')" title="발송">
                </div>
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘 추가">
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_link.png')" title="링크 추가">
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일 추가">                
            </div>    
            <div class="editor_body" contenteditable="true" spellcheck="false">
                구름에 달 가듯이 가는 나그네<br>술익는 마을마다 <span style="color:red;font-weight:bold">타는 저녁놀</span> Let's GoGo!!!
            </div>
        </div>
    </div>
    <div class="chan_right">
        <div class="chan_right_header">
            <div class="chan_right_header_left">
                00000   
            </div>
            <div class="chan_right_header_right">
                11111
            </div>
        </div>
        <div class="chan_right_body">
            
        </div>
        <div class="chan_right_footer">
            
        </div>
    </div>   
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>    
</template>

<style scoped>    
    .chan_center {
        width:100%;height:100%;padding: 0 20px;
        display:flex;flex-direction:column;
    }
    .chan_center_header {
        width:100%;min-height:50px;display:flex;justify-content:space-between;
        overflow:hidden
    }
    .chan_center_header_left {
        width:80%;height:100%;display:flex;align-items:center;
        font-weight:bold;border:0px solid red
    }
    .chan_center_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;
        border:0px solid red
    }
    .chan_center_nav {
        width:100%;min-height:30px;display:flex;align-items:center;
        border-bottom:1px solid dimgray;overflow:hidden
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;flex:1;overflow-y:auto;
        border:0px solid blue
    }
    .msg_body {
        position:relative;display:flex;flex-direction:column;margin:10px 0;border-bottom:1px solid lightgray
    }
    .msg_proc {
        position:absolute;height:20px;right:15px;top:-5px;padding:5px 10px;z-index:9999;
        display:flex;align-items:center;
        background:white;border:1px solid lightgray;border-radius:5px
    }
    .chan_center_footer {
        width:100%;margin:auto 0 10px 0;
        display:flex;flex-direction:column;
        border:1px solid lightgray;border-radius:5px;
    }
    .editor_header {
        width:100%;height:40px;
        display:flex;align-items:center;
        background:whitesmoke;
    }
    .editor_body {
        width:calc(100% - 10px);min-height:40px;max-height:300px;padding:5px;overflow:hidden       
    }
    .chan_right {
        width:400px;height:100%;padding: 0 20px;
        display:none;flex-direction:column;
    }
    .chan_right_header {
        width:100%;height:70px;display:flex;justify-content:space-between;
        border:0px solid red
    }
    .chan_right_header_left {
        width:70%;height:100%;display:flex;align-items:center;
        border:0px solid red
    }
    .chan_right_header_right {
        width:30%;height:100%;display:flex;align-items:center;justify-content:flex-end;
        border:0px solid red
    }
    .chan_right_body {
        width:100%;height:100%;display:flex;flex-direction:column;
        border:0px solid blue
    }
    .chan_right_footer {
        width:100%;height:150px;display:flex;
        border:0px solid gray
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
    .node {
        width:calc(100% - 30px);min-height:36px;padding:0 10px;margin:0 5px;
        display:flex;align-items:center;justify-content:space-between;
        font-size:15px;color:var(--text-white-color);border-radius:5px;cursor:pointer;
    }
    .nodeRight { display:flex;align-items:center;justify-content:flex-end; }
    .topMenu { border-radius:5px;cursor:pointer }
    .topMenu:hover { background:whitesmoke;font-weight:bold }
    .procMenu { padding:5px;margin-right:10px;border-radius:5px;cursor:pointer }
    .procMenu:hover { background:whitesmoke }
    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .nodeSel { background:var(--second-select-color);color:var(--primary-color); }
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px; /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
    
</style>
