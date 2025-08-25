<script setup>
    import { watchEffect } from 'vue'
    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()

    watchEffect(() => {
        const { msg, toastSec } = gst.snackBar
        if (msg && Number.isInteger(toastSec) && toastSec > 0) {
            setTimeout(() => closeBar(), toastSec * 1000)    
        }
    })

    function closeBar() {
        gst.util.setSnack("")
    }
</script>

<template>
    <Transition>
        <div v-if="gst.snackBar.msg" style="width:100%;height:100%;position:fixed;top:0;left:0;display:flex;flex-direction:column;background:rgba(0,0,0,0.5);z-index:9999">
            <div style="width:100%;display:flex;justify-content:space-between;margin-top:auto">
                <div style="width:calc(100% - 80px);padding:10px;display:flex;flex-direction:column;background:ivory;cursor:pointer" @click="closeBar">
                    <div v-html="gst.snackBar.msg"></div>
                    <div style="color:darkgray">{{ gst.snackBar.where }}</div>
                </div>
                <div style="width:80px;display:flex;justify-content:center;align-items:center;background:var(--primary-btn-color);color:white;cursor:pointer" @click="closeBar">
                    <span>닫기</span>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
  .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
  .v-enter-from, .v-leave-to { opacity: 0; }
</style>