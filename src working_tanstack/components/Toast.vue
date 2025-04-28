<script setup>
    import { watchEffect } from 'vue'

    import GeneralStore from '/src/stores/GeneralStore.js'

    const gst = GeneralStore()

    watchEffect(() => {
        const { msg, toastSec } = gst.toast
        if (msg && Number.isInteger(toastSec) && toastSec > 0) setTimeout(() => close(), toastSec * 1000)    
    })

    function close() {
        gst.util.setToast("")
    }
</script>

<template>
    <Transition>
        <div v-if="gst.toast.msg" style="width:100%;height:100%;position:fixed;top:0;left:0;display:flex;flex-direction:column;justify-content:center;align-items:center;background:transparent;z-index:9999">
            <div style="min-width:60px;max-width:300px;display:flex;flex-direction:column;background:ivory;padding:10px;border:1px solid lightgray;border-radius:10px">
                <div style="width:100%;display:flex;justify-content:center;align-items:center">
                    {{ gst.toast.msg }}
                </div>
                <div v-if="gst.toast.close" style="width:100%;margin-top:5px;display:flex;justify-content:center;align-items:center;cursor:pointer">
                    <div @click="close" style="margin-top:10px;padding:5px;background:lightsteelblue;border-radius:5px">닫기</div>
                </div>
            </div>
        </div>
    </Transition>
</template>

<style scoped>

  .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }

  .v-enter-from, .v-leave-to { opacity: 0; }

</style>