<script setup>
    import { watchEffect } from 'vue'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()

    watchEffect(() => {
        const { msg, toastSec } = gst.snackBar
        if (msg && Number.isInteger(toastSec) && toastSec > 0) setTimeout(() => closeBar(), toastSec * 1000)    
    })

    function closeBar() {
        gst.util.setSnack("")
    }
</script>

<template>
    <Transition>
        <div v-if="gst.snackBar.msg" style="width:100%;height:100%;position:fixed;top:0;left:0;display:flex;flex-direction:column;background:rgba(0,0,0,0.5);z-index:9999">
            <div style="width:100%;display:flex;flex-direction:column;background:ivory;padding:10px;margin-top:auto">
                <div style="width:100%;display:flex;flex-direction:row;justify-content:space-between">
                    <div v-html="gst.snackBar.msg"/>
                    <div style="padding-right:20px">
                        <button @click="closeBar">Close</button>
                    </div>
                </div>
                <div style="width:100%;display:flex;flex-direction:row;justify-content:space-between">
                    <div style="color:darkgray">
                        {{ gst.snackBar.where }}
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>

  .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }

  .v-enter-from, .v-leave-to { opacity: 0; }

  /* .black-bg {
    width:100%;height:100%;background:rgba(0,0,0,0.5);position:fixed;top:0;left:0;padding:20px
    width:100%;height:100%;position:fixed;top:0;left:0;background:rgba(0,0,0,0.5);display:flex;flex-direction:column
  }

  .white-bg {
    width:100%;height:100px;top:100;left:0;background:white;border-radius:8px;padding:20px
    width:100%;display:flex;flex-direction:row;background:ivory;padding:10px;margin-top:auto
  } */

</style>