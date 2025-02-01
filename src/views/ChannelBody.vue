<script setup>
    import { ref, onMounted, watch } from 'vue' 
    import { useRouter } from 'vue-router'
    import axios from 'axios'

    import GeneralStore from '/src/stores/GeneralStore.js'
    import ContextMenu from "/src/components/ContextMenu.vue"
    
    const gst = GeneralStore()
    const router = useRouter()

    onMounted(async () => { 
        try {
            
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    })

    // watch(kind, async () => {
    //     localStorage.wiseband_lastsel_kind = kind.value
    //     await getList() 
    // }) //immediate:true시 먼저 못읽는 경우도 발생할 수 있으므로 onMounted에서도 처리

    async function getList() {
        try {            
            
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
                <span class="spanHover" style="padding:5px 10px;border:1px solid lightgray">멤버 11</span>
                <span class="spanHover" style="padding:5px;margin-top:3px;margin-left:10px">
                    <img class="coImg20" :src="gst.html.getImageUrl('dimgray_option_vertical.png')">
                </span>                
            </div>
        </div>
        <div class="chan_center_nav">
            <div class="spanHover" style="display:flex;align-items:center;padding:5px 8px 5px 0">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                <span style="margin-left:5px">메시지</span> 
            </div>
            <div class="spanHover" style="display:flex;align-items:center;padding:5px 8px">
                <img class="coImg18" :src="gst.html.getImageUrl('dimgray_msg.png')">
                <span style="margin-left:5px">파일</span> 
            </div>
        </div>
        <div class="chan_center_body">
            
        </div>
        <div class="chan_center_footer">
            
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
        width:100%;height:70px;display:flex;justify-content:space-between;
        
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
        width:100%;height:50px;display:flex;align-items:center;
        border-bottom:1px solid dimgray
    }
    .chan_center_body {
        width:100%;height:100%;display:flex;flex-direction:column;
        border:0px solid blue
    }
    .chan_center_footer {
        width:100%;height:150px;display:flex;
        border:0px solid gray
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
    .spanHover { border-radius:5px;cursor:pointer }
    .spanHover:hover { background:whitesmoke;font-weight:bold }
    .nodeSel { background:var(--second-select-color);color:var(--primary-color); }
    .resizer {
        background-color:transparent;cursor:ew-resize;height:100%;width:5px; /* 5px 미만은 커서 너무 민감해짐 #cbd5e0 */
    }
    
</style>
