<script setup>
    import { ref } from 'vue' 

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()
    const props = defineProps({ kind: String })
    const emits = defineEmits(["ev-click"])
    defineExpose({ open, close })

    let show = ref(false), vRotate = ref(0), vScale = ref(10)

    function open() {
        show.value = true
    }

    function close() {
        show.value = false
    }

    function rotateImg() {
        vRotate.value += 90
    }

    function zoomImg(bool) {
        if (bool == true) {
            vScale.value = parseInt(vScale.value) + 1
        } else if (bool == false) {
            vScale.value = parseInt(vScale.value) - 1
        } else {
            vScale.value = 10
        }
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <div :style="{ transform: 'rotate(' + vRotate + 'deg) scale(' + parseFloat(vScale/10) + ',' + parseFloat(vScale/10) + ')' }">
                    <slot></slot>
                </div>
                <div class="menu">
                    <div style="display:flex;margin-left:20px">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_rotate_right.png')" @click="rotateImg" >
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_minus.png')" @click="zoomImg(false)" >
                        <input type="range" min="10" max="20" v-model="vScale">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_plus.png')" @click="zoomImg(true)" >
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_reset.png')" @click="zoomImg()" >
                    </div>
                    <div style="display:flex;margin-right:20px">
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_delete.png')" @click="deleteImg" >
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_copy.png')" @click="copyImg" >
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('dimgray_download.png')" @click="downloadImgAsFile" >
                        <img class="coImg24 editorMenu" :src="gst.html.getImageUrl('close.png')" @click="close">
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