<script setup>
    import { ref } from 'vue' 

    //import GeneralStore from '/src/stores/GeneralStore.js'

    //const gst = GeneralStore()
    //const props = defineProps({ objUrl: Object })
    //const emits = defineEmits(["ev-click", "ev-leave"])
    defineExpose({ open })

    let show = ref(false)

    function open() {
        show.value = true
    }

    function close() {
        show.value = false
    }
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <slot></slot>
                <!-- <div style="width:300px;height:300px;border:1px solid red">
                    <img :src="props.objUrl" style='width:100%;height:100%'>                    
                </div> -->
                <button @click="close">닫기</button>
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    .popup {
        position: fixed;top: 50%;left: 50%;transform: translate(-50%, -50%);background: white;padding: 20px;z-index: 1000;
    }

    .overlay {
        position: fixed;top: 0;left: 0;width: 100%;height: 100%;background: rgba(0, 0, 0, 0.5);z-index: 999;
    }

</style>