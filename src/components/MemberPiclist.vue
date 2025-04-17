<script setup>
    import hush from '/src/stores/Common.js'
    import GeneralStore from '/src/stores/GeneralStore.js'
    import MemberPiceach from "/src/components/MemberPiceach.vue"

    const gst = GeneralStore()
    const props = defineProps({ row: Object }) //향후 유지보수 편하게 하기 위해서는 굳이 아래 루프처리하지 말기
</script>

<template>
    <div v-if="row.picCnt == 1"><!-- 1명 (본인도 포함)-->
        <div class="wh32">
            <member-piceach :picUrl="row.url[0]" sizeName="wh32"></member-piceach>
        </div>
    </div>
    <div v-else-if="row.picCnt == 2"><!-- 2명 보여주기 (본인제외) -->
        <div class="wh32">
            <div class="wh24" style="margin:-4px 0 0 0">
                <member-piceach :picUrl="row.url[0]" sizeName="wh24"></member-piceach>
            </div>
            <div class="wh24" style="z-index:1;margin:12px 0 0 -12px">
                <member-piceach :picUrl="row.url[1]" sizeName="wh24"></member-piceach>
            </div>
        </div>
    </div>
    <div v-else-if="row.picCnt == 3" class="wh32P" style="flex-direction:column"><!-- 3명 보여주기 (본인제외) -->
        <div class="wh3216">
            <member-piceach :picUrl="row.url[0]" sizeName="wh16"></member-piceach>
        </div>
        <div class="wh16P">
            <div class="wh16">
                <member-piceach :picUrl="row.url[1]" sizeName="wh16"></member-piceach>
            </div>
            <div class="wh16">
                <member-piceach :picUrl="row.url[2]" sizeName="wh16"></member-piceach>
            </div>
        </div>
    </div>
    <div v-else class="wh32P" style="flex-direction:column"><!-- 4명 보여주기 (본인제외) : 더 이상 없음-->
        <div class="wh16P">
            <div class="wh16">
                <member-piceach :picUrl="row.url[0]" sizeName="wh16"></member-piceach>
            </div>
            <div class="wh16">
                <member-piceach :picUrl="row.url[1]" sizeName="wh16"></member-piceach>
            </div>
        </div>
        <div class="wh16P">
            <div class="wh16">
                <member-piceach :picUrl="row.url[2]" sizeName="wh16"></member-piceach>
            </div>
            <div class="wh16">
                <member-piceach :picUrl="row.url[3]" sizeName="wh16"></member-piceach>
            </div>
        </div>
    </div>
</template>

<style scoped>
    .wh16P { width:16px;height:16px;display:flex }
    .wh32P { width:32px;height:32px;display:flex }
    .wh16 { width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center }
    .wh24 { width:24px;height:24px;border-radius:12px;display:flex;align-items:center;justify-content:center }
    .wh32 { width:32px;height:32px;border-radius:16px;display:flex;align-items:center;justify-content:center }
    .wh3216 { width:32px;height:16px;display:flex;align-items:center;justify-content:center }
</style>
