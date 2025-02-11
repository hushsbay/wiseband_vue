<script setup>
    import Snackbar from "/src/components/Snackbar.vue"
    import Toast from "/src/components/Toast.vue"
</script>

<template>
    <router-view />
    <!-- <router-view v-slot="{ Component }">
        <keep-alive>
            <component :is="Component" />
        </keep-alive>
    </router-view> -->
    <snackbar></snackbar>
    <toast></toast>        
</template>
