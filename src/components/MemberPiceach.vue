<script setup>
    import GeneralStore from '/src/stores/GeneralStore.js'
    
    const gst = GeneralStore()

    const props = defineProps({ picUrl: String, sizeName: String })
</script>

<template>
    <img v-if="picUrl" :src="picUrl" :class="'wh16wh24wh32'.includes(sizeName) ? sizeName : 'wh16'">
    <img v-else :src="gst.html.getImageUrl('user.png')" :class="'wh16wh24wh32'.includes(sizeName) ? sizeName : 'wh16'">
</template>

<style scoped>
    .wh16 { width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center }
    .wh24 { width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center }
    .wh32 { width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center }
</style>
