<script setup>
    import { ref, onMounted, watch } from 'vue' 
    import { useRoute, useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    
    const gst = GeneralStore()
    const route = useRoute()
    const router = useRouter()

    let grid = ref(''), chanid = ref('')

    onMounted(async () => { 
        try {
            chanid.value = route.params.chanid
            grid.value = route.params.grid
            alert(chanid.value+"@@"+grid.value)
            await getList()
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    watch([chanid, grid], async () => {
        alert(chanid.value+"##"+grid.value)
        await getList() 
    }) //, { immediate: true }) //시 먼저 못읽는 경우도 발생할 수 있으므로 onMounted에서도 처리

    async function getList() {
        try {
            const res = await axios.post("/chanmsg/qry", { grid : grid.value, chanid : chanid.value })
            const rs = gst.util.chkAxiosCode(res.data)
            debugger
            if (!rs) return            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
</script>

<template>
    <div class="chan_center">
        <div class="chan_center_header">
            <div class="chan_center_header_left">
                0000000   
            </div>
            <div class="chan_center_header_right">
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
                <div class="msg_proc">
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('action_checkbox.png')" title="완료됨"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('action_watching.png')" title="체크중"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('action_done.png')" title="제대로 완료함"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_emoti.png')" title="이모티콘"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_thread.png')" title="스레드에 댓글 달기"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_forward.png')" title="전달"></span>
                    <span class="procMenu"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_later.png')" title="나중에"></span>
                    <span class="procMenu" style="margin-right:0px"><img class="coImg18" :src="gst.html.getImageUrl('dimgray_option_vertical.png')" title="더보기"></span>
                </div>
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
        width:70%;height:100%;display:flex;align-items:center;
        border:0px solid red
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
        position:relative;display:flex;padding:5px;border-bottom:1px solid lightgray
    }
    .msg_proc {
        position:absolute;height:20px;right:15px;top:-15px;padding:5px 10px;
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
