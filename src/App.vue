<script setup>
    import GeneralStore from '/src/stores/GeneralStore.js'
    import Snackbar from "/src/components/Snackbar.vue"
    import Toast from "/src/components/Toast.vue"
    import ContextMenu from "/src/components/ContextMenu.vue"

    const gst = GeneralStore()
</script>

<template>
    <router-view />
    <snackbar></snackbar>
    <toast></toast>
    <context-menu @ev-menu-click="gst.ctx.proc"></context-menu>    
</template>
