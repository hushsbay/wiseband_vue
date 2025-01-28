<script setup>
    import Snackbar from "/src/components/Snackbar.vue"
    import Toast from "/src/components/Toast.vue"
    import ContextMenu from "/src/components/ContextMenu.vue"
</script>

<template>
    <router-view />
    <snackbar></snackbar>
    <toast></toast>
    <context-menu></context-menu>   
</template>
