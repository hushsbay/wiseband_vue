<script setup>
    import Snackbar from "/src/components/Snackbar.vue"
    import Toast from "/src/components/Toast.vue"
</script>

<template>
    <router-view /> <!-- .vue마다 :key 및 keep-alive가 달리 구현되어 있음 -->
    <snackbar></snackbar>
    <toast></toast>        
</template>
