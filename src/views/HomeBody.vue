<script setup>
    import { ref, reactive, onMounted } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    
    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    let grnm = ref(''), channm = ref('')
    let msglist = ref([])
    let msgbody = ref("구름에 \"달 가듯이\" 가는 나그네<br>술익는 마을마다 <span style='color:red;font-weight:bold'>타는 저녁놀</span> Lets GoGo!!!")
    let imgBlobArrToSave = ref([])

    /* 라우팅 관련 정리 : 현재는 부모(Main) > 자식(Home) > 손자(HomeBody) 구조임 (결론은 맨 마지막에 있음)
    1. Home.vue에서 <router-view />를 사용하면 그 자식인 여기 HomeBody.vue가 한번만 마운트되고 
       그 다음에 router.push해도 다시 마운트(아예 호출도) 안됨 : onMounted가 한번만 호출되고 끝.
    2. 그런데, <router-view :key="$route.fullPath"></router-view>와 같이 :key속성을 사용하면 router.push할 때마다 다시 마운트됨
    3. 그런데, Main.vue에서도 :key를 사용하면 Home.vue에서 router.push할 때에도 Main.vue의 onMounted가 호출되어 문제가 됨
    4. 따라서, 현재 구조에서는 여기 손자인 HomeBody.vue를 호출하는 자식인 Home.vue에서만 :key를 적용하면
       슬랙과 똑같이 채널노드를 클릭할 때마다 라우팅되도록 할 수 있음
       - 만일 손자 아래 증손자가 필요하고 그것도 라우팅으로 처리하려면 매우 복잡한 핸들링이 필요하므로
       - 아예 증손자는 만들지 말든지 아니면 만들어도 라우틴이 아닌 비동기컴포넌트 호출(defineAsyncComponent)하기로 함
       - 슬랙과 똑같이 만드는 목표이기 때문에 이런 라우팅을 했으며 그게 아니라면 애초부터 defineAsyncComponent()를 사용했을 것임
       - 슬랙은 그 이유가 URL로 독자적으로 해당 채널을 부르는 페이지를 제공하려 했을 것인데 그것도 defineAsyncComponent()으로 안될 게 없을 것임
    5. back()시 초기화되는 Vue의 특성상 back()시 이전 채널 선택 상태 복원, 이전 메시지 위치로 스크롤 등의 구현은 반드시 구현 필요
       - <KeepAlive>가 Component의 이전 상태를 그대로 유지해 준다는데 파악 및 테스트가 필요함 
       - 사용자가 마지막으로 선택한 채널, 콤보박스 등은 localStorage로 구현되어 있는데 문제없는지 다시 테스트해보기로 함 */

    /* 위와 같이 처리했는데, HomeBody.vue에서 Endless Scroll을 구현후 Back()시 초기상태로 되돌아가므로
       해당 스크롤 포지션까지 돌아 가는 것을 구현하려면 <keep-alive>가 반드시 필요하게 됨
       1. App.vue, Home.vue, HomeBody.vue 모두 아래와 같이 구현하니 잘되나 안되는 부분도 다음 항목처럼 발생 (해결 필요)
            <router-view v-slot="{ Component }">
                <keep-alive>
                    <component :is="Component" :key="$route.fullPath" /> :key속성을 router-view가 아닌 component에 넣어야 잘 동작함
                </keep-alive>
            </router-view>
        2. 위에서 안되는 부분
           1) login후 /main에서 멈춤 (화면 블랭크) 2) 채널 클릭시 펼쳐진 다른 그룹은 접혀짐 3) back()시 노드 선택 색상이 안움직이는데 변경 필요
        3. 제일 중요한 부분은 채널 클릭시 HomeBody.vue의 onMounted()가 여러번 누적적으로 증가 실행되어, named view로 해결 글도 있긴 한데 구조적으로 어려워,
           App.vue, Home.vue는 기존대로 <router-view />로 다시 돌리고, HomeBody.vue만 <keep-alive 위처럼 적용하니 일단 누적/중복호출은 없어져서
           이 환경을 기본으로 문제들을 해결해 나가기로 함 (데이터 가져오기는 <keep-alive>가 지켜주나 스크롤포지션은 안지켜주는데 그 부분은 코딩으로 해결하면 됨)
           1) back()시 노드 선택 색상이 안움직이는데 변경 필요 - router.beforeEach((to, from)로 해결 완료
        4. 채널내 라우팅은 해결했으나 홈 >> DM >> Back()시 HomeBody.vue의 상태 복원은 안되고 있음. :key="$route.fullPath" 제거후 누적/중복호출 해결. 상태 복원도 잘 됨
            <router-view v-slot="{ Component }">
                <keep-alive>
                    <component :is="Component" />
                </keep-alive>
            </router-view>
           1) 홈 >> DM >> Back()시 Main.vue의 홈 선택 복원은 안되고 있음 : router.beforeEach((to, from)로 해결 완료
           2) 홈 클릭시 HomeBody.vue 블랭크 페이지 나옴 해결 필요 (이미 히스토리에 있으므로 안나오는데 슬랙은 그 상태로 다시 보여줌) : gst.selSideMenuTimeTag로 해결 완료
        5. 결론적으로, App.vue, Main.vue, Home.vue에 있는 <router-view>의 모습이 각각 다르며 
           router의 index.js와 각 watch 메소드를 이용해 Back() 또는 기존 URL 클릭시 캐시를 부르거나 상태복원하는 것으로 구현 완료함
    */

    onMounted(async () => { //Main.vue와는 달리 라우팅된 상태에서 Back()을 누르면 여기가 실행됨
        try { //:key속성이 적용되는 <router-view 이므로 onMounted가 router.push마다 실행됨을 유의 //console.log("########homebody.vue")
            gst.selChanId = route.params.chanid
            gst.selGrId = route.params.grid
            await getList()            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    async function getList() {
        try {
            const res = await axios.post("/chanmsg/qry", { grid : gst.selGrId, chanid : gst.selChanId })
            const rs = gst.util.chkAxiosCode(res.data)
            if (!rs) return
            debugger
            grnm.value = rs.data.chanmst.GR_NM
            channm.value = rs.data.chanmst.CHANNM
            document.title = channm.value + "[채널]"
            msglist.value = rs.data.msglist            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    async function msgRight(e, row) { //채널 우클릭시 채널에 대한 컨텍스트 메뉴 팝업. row는 해당 채널 Object
        
    }

    async function msgEnter(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = true
    }

    function msgLeave(row) { //just for hovering (css만으로는 처리가 힘들어 코딩으로 구현)
        row.hover = false
    }

    function pastedInMsgBody(e) {
        try {
            e.preventDefault()
            const pastedData = e.clipboardData.items//e.originalEvent.clipboardData.items
            if (pastedData.length == 0) return
            const clipboardItem = pastedData[0]
            if (clipboardItem.type.includes("image")) { //예) image/png
                const blob = clipboardItem.getAsFile()
                // if (blob.size > hush.cons.max_size_to_sublink) { //see get_sublink.js
                //     hush.msg.toast("이미지가 너무 큽니다 : " + blob.size + "<br>max : " + hush.util.formatBytes(hush.cons.max_size_to_sublink) + "(" + hush.cons.max_size_to_sublink + "bytes)")
                //     return
                // }
                debugger
                imgBlobArrToSave.value.push(URL.createObjectURL(blob))
            } else if (clipboardItem.type.includes("text")) {
                clipboardItem.getAsString(function(str) {
                    // const _arr = str.split(hush.cons.deli)
                    // if (_arr[0] == "btn_copy_cell") { //e.preventDefault() here has no effect                                    
                    //     g_in_chat.val(g_in_chat.val().replace(str, ""))
                    //     if (g_in_chat.val().trim() != "") {
                    //         alert("이미 작성중인 데이터가 있습니다.")
                    //         return
                    //     }                                                        
                    //     const rq = { msgid : _arr[3] }
                    //     if (hush.webview.ios) { 
                    //     } else if (hush.webview.and) { //it's text
                    //         setTimeout(function() {
                    //             AndroidCom.send(hush.cons.sock_ev_qry_msgcell, JSON.stringify(rq), g_roomid, null, true)
                    //         }, hush.cons.sec_for_webview_func) //비동기로 호출해야 동작
                    //     } else {
                    //         hush.sock.send(g_socket, hush.cons.sock_ev_qry_msgcell, rq, g_roomid)
                    //     }
                    // } else {
                    //     calcBytes()
                    // }
                })
            }                        
        } catch (ex) { 
            gst.util.showEx(ex, true)
        }
    }    

    async function saveMsg() {
        //파일 및 이미지 업로드만 FormData 사용하고 nest.js에서는 multer npm으로 처리하기
        //https://kimmangyu.tistory.com/entry/NestJS-File-upload
        //https://velog.io/@danceintherain/Nestjs%EB%A1%9C-%EC%9D%B4%EB%AF%B8%EC%A7%80%ED%8C%8C%EC%9D%BC-%EC%97%85%EB%A1%9C%EB%93%9C-%EA%B5%AC%ED%98%84%ED%95%98%EA%B8%B0
        /*const fd = new FormData()
        fd.append("crud", "C")
        fd.append("chanid", gst.selChanId)
        fd.append("msgid", null)
        fd.append("body", msgbody.value)
        fd.append("num_file", 0)
        fd.append("num_image", 0)        
        const res = await axios.post("/chanmsg/saveMsg", fd, { headers: { 'Content-Type': 'multipart/form-data' }})*/
        const rq = { 
            crud: "C", chanid: gst.selChanId, msgid: null, body: document.getElementById('msgBody').innerHTML, 
            num_file: 0, num_image: 0 
        }
        const res = await axios.post("/chanmsg/saveMsg", rq)
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return

    }

    async function test() {
        const res = await axios.post("/chanmsg/qry", { grid : gst.selGrId, chanid : gst.selChanId })
        const rs = gst.util.chkAxiosCode(res.data)
        if (!rs) return            
        grnm.value = rs.data.chanmst.GR_NM
        channm.value = rs.data.chanmst.CHANNM
        document.title = channm.value
        msglist.value = [...msglist.value, ...rs.data.msglist]
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
                <div v-html="row.BODY" style="margin:10px"></div> <!--<span>{{ row.BODY }}</span></div>-->
                <div class="msg_body_sub">
                    <div v-for="(row1, idx1) in row.msgdtl" class="msg_body_sub1" :title="row1.NM">
                        <img class="coImg18" :src="gst.html.getImageUrl('emo_' + row1.KIND + '.png')"> <span style="margin-left:3px">{{ row1.CNT}}</span>
                    </div>
                    <div v-for="(row2, idx2) in row.reply" style="margin-right:0px;padding:0px;display:flex;align-items:center" :title="row2.AUTHORNM">
                        <img class="coImg18" :src="gst.html.getImageUrl('user.png')">
                    </div>
                    <div v-if="row.reply.length > 0" style="margin:0 5px;display:flex;align-items:center">
                        댓글:<span>{{ row.reply.length }}</span>개 (최근:<span>{{ row.reply[0].DT }}</span>)
                    </div>
                </div>
                <!-- <div class="msg_body_sub">
                    <div v-for="(row3, idx3) in row.msglink" class="msg_body_sub1">
                        <a :href="row3.BODY"><span>{{ row3.BODY }}</span></a>
                    </div>
                </div> -->
                <div class="msg_body_sub">
                    <div v-for="(row4, idx4) in row.msgfile" class="msg_body_sub1">
                        <span>{{ row4.BODY }}</span>
                    </div>
                </div>
                <div class="msg_body_sub">
                    <div v-for="(row5, idx5) in row.msgimg" class="msg_body_sub1">
                        <img class="coImg64" :src="gst.html.getImageUrl('edms.png')">
                    </div>
                </div>
                <div v-show="row.hover" class="msg_proc">
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('emo_watch.png')" title="알아보는중"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('emo_check.png')" title="접수완료"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('emo_done.png')" title="완료"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드에 댓글 달기"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_later.png')" title="나중에"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기"></span>
                </div>
            </div>
            <div class="msg_body">
                메시지 테스트입니다. 1111 <input type="text" value="00000000" />
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
                <div style="display:flex;align-items:center;padding:3px 5px;margin:0 10px 0 5px;background:darkgreen;border-radius:5px"
                    @click="saveMsg">
                    <img class="coImg24" :src="gst.html.getImageUrl('white_send.png')" title="발송">
                </div>
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘 추가">
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_link.png')" title="링크 추가">
                <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_file.png')" title="파일 추가">                
            </div>
            <!-- 
                <div id="msgBody" class="editor_body" contenteditable="true" spellcheck="false" v-html="editData.edit" @input="updateStyling($event.target)"></div> 
                https://www.jkun.net/702
            -->
            <div id="msgBody" class="editor_body" contenteditable="true" spellcheck="false" v-html="msgbody" @paste="pastedInMsgBody"></div>
            <div v-if="imgBlobArrToSave.length > 0" style="margin-top:10px;display:flex;flex-wrap:wrap;justify-content:flex-start;background:whitesmoke">
                <div v-for="(row, idx) in imgBlobArrToSave" style="width:50px;height:50px;margin:10px;border:1px solid lightgray">
                    <img :src="row" style='width:100%;height:100%'>
                </div>
            </div>
        </div>
    </div>
    <div class="chan_right">
        <div class="chan_right_header">
            <div class="chan_right_header_left">
                   
            </div>
            <div class="chan_right_header_right">
                
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
    .msg_body_sub {
        display:flex;margin:10px;display:flex;flex-wrap:wrap;justify-content:flex-start
    }
    .msg_body_sub1 {
        margin-right:10px;padding:5px;display:flex;background:whitesmoke;border-radius:8px
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
