<script setup>
    import Snackbar from "/src/components/Snackbar.vue"
    import Toast from "/src/components/Toast.vue"
</script>

<template>
    <router-view />   
    <snackbar></snackbar>
    <toast></toast>
</template>
