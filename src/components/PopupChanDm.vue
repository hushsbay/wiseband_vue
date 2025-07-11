<script setup>
    import { ref } from 'vue' 
    import axios from 'axios'
    
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import HomePanel from '/src/views/HomePanel.vue'
    import DmPanel from '/src/views/DmPanel.vue'

    const gst = GeneralStore()
    
    defineExpose({ open, close })

    const emits = defineEmits(["ev-click-chandm"])

    function setInfoToParent() {
        emits("ev-click-chandm", kind.value, chanid.value, msgid.value)
    }

    let show = ref(false), kind = ref('home'), chanid = ref(''), msgid = ref('')

    async function open(strKind, strMsgid) {
        show.value = true
        changeKind(strKind)
        msgid.value = strMsgid
    }

    function changeKind(strKind) {
        kind.value = strKind
    }

    function close() {
        show.value = false
    }

    function handleFromChanDm(strKind, strChanid) {
        kind.value = strKind
        chanid.value = strChanid
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                    <div style="display:flex;align-items:center">
                        <div class="topMenu" :class="kind == 'home' ? 'tab_sel' : 'tab_unsel'" @click="changeKind('home')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_msg.png')">
                            <span style="margin-left:5px;font-weight:bold">채널</span> 
                        </div>
                        <div class="topMenu" :class="kind == 'dm' ? 'tab_sel' : 'tab_unsel'" @click="changeKind('dm')">
                            <img class="coImg18" :src="gst.html.getImageUrl('dimgray_search_file.png')">
                            <span style="margin-left:5px;font-weight:bold">DM</span> 
                        </div>
                    </div>
                    <div style="display:flex;justify-content:flex-end;align-items:center">
                        <img class="coImg24" :src="gst.html.getImageUrl('close.png')" style="margin-right:10px;" @click="close" title="닫기">
                    </div>
                </div>
                <div class="chan_center">
                    <div v-if="kind=='home'" class="chan_center_body">
                        <home-panel fromPopupChanDm="Y" @ev-click="handleFromChanDm"></home-panel>
                    </div>
                    <div v-else class="chan_center_body">
                        <dm-panel fromPopupChanDm="Y" @ev-click="handleFromChanDm"></dm-panel>
                    </div>
                </div>
                <div class="popupFooter" @click="() => setInfoToParent()">확인</div>        
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
</template>

<style scoped>
    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }
    input { height:28px;margin-right:8px;border:1px solid dimgray;border-radius:0px }
    input[type=search]:focus { outline:2px solid lightgreen }
    .popup {
        position:fixed;width:350px;height:700px;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;border-radius:10px
    }
    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }
    .topMenu { cursor:pointer }
    .topMenu:hover { background:var(--hover-color);border-radius:5px }
    .topMenu:active { background:var(--active-color);border-radius:5px }
    .tab_sel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid black }
    .tab_unsel { display:flex;align-items:center;padding:5px 8px;border-bottom:3px solid white; }
    .chan_center {
        width:100%;height:100%;overflow:hidden;
        display:flex;flex-direction:column;border:0 solid dimgray
    }
    .chan_center_body {
        width:100%;height:100%;margin-bottom:5px;display:flex;flex-direction:column;background:var(--second-color)
    }
    .popupFooter { 
        margin-top:10px;padding:8px;display:flex;justify-content:center;align-items:center;border-radius:5px;cursor:pointer;
        background:#510143;color:white 
    }
    /* .item {  				
        padding:5px;display:flex;flex-direction:column;justify-content:center;align-items:center;border:1px solid lightgray
    }
    .item:hover { background:var(--hover-color) } */
</style>