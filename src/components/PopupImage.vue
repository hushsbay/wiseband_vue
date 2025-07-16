<script setup>
    import { ref } from 'vue'     
    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()

    defineExpose({ open, close })
    const props = defineProps({ param: Object })    

    let show = ref(false), vRotate = ref(0), vScale = ref(10), scalMin = ref(10), scaleMax = ref(20)
    let menuShow = ref(false)

    function open() {
        show.value = true
        zoomImg()
    }

    function close() {
        show.value = false
    }

    function rotateImg() {
        vRotate.value += 90
    }

    function zoomImg(bool) {
        if (bool == true) {
            if (vScale.value >= scaleMax.value) return
            vScale.value = parseInt(vScale.value) + 1
        } else if (bool == false) {
            if (vScale.value >= scalMin.value) return
            vScale.value = parseInt(vScale.value) - 1
        } else if (bool == 'toggle') {
            vScale.value = (vScale.value == scalMin.value) ? scaleMax.value : scalMin.value
        } else {
            vScale.value = scalMin.value
        }
    }

    function popupEnter() {
        menuShow.value = true
    }

    function popupLeave() {
        menuShow.value = false
    }

    function copyImg() { //이미지를 클립보드에 복사
        try {
            gst.util.downloadBlob("I", props.param.msgid, props.param.chanid, props.param.cdt, "copyImage")
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }

    function downloadFile() { //이미지를 파일로 만들어 다운로드드
        try {
            gst.util.downloadBlob("I", props.param.msgid, props.param.chanid, props.param.cdt, props.param.msgid + "_" + props.param.cdt + ".png")
        } catch (ex) {
            gst.util.showEx(ex, true)
        }
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup" @mouseenter="popupEnter" @mouseleave="popupLeave" >
                <div :style="{ transform: 'rotate(' + vRotate + 'deg) scale(' + parseFloat(vScale/10) + ',' + parseFloat(vScale/10) + ')' }" @click="zoomImg('toggle')">
                    <slot></slot>
                </div>
                <div v-show="menuShow" class="menu">
                    <div style="display:flex;margin-left:20px">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_rotate_right.png')" @click="rotateImg" title="회전">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_minus.png')" @click="zoomImg(false)" title="축소">
                        <input type="range" min="10" max="20" v-model="vScale">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_plus.png')" @click="zoomImg(true)" title="확대">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_reset.png')" @click="zoomImg()" title="리셋">
                    </div>
                    <div style="display:flex;margin-right:20px">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_copy.png')" @click="copyImg" title="복사">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_download.png')" @click="downloadFile" title="파일다운로드">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('close.png')" @click="close" title="닫기">
                    </div>
                </div>
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    .popup {
        position:fixed;width:90%;height:90%;top:50%;left:50%;transform:translate(-50%, -50%);padding:20px;z-index:1000;background:white;
        display:flex;flex-direction:column;justify-content:center;align-items:center
    }

    .menu {
        position:fixed;width:100%;height:50px;bottom:0;left:0;padding:0px;z-index:1001;background:transparent;
        display:flex;justify-content:space-between;align-items:center
    }

    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }

    .editorMenu { display:flex;align-items:center;padding:5px;margin-left:5px;border-radius:5px;cursor:pointer }
    .editorMenu:hover { background:lightgray }
    .editorMenu:active { background:var(--active-color) }
</style>