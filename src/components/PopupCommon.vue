<script setup>
    import { ref } from 'vue' 

    //import GeneralStore from '/src/stores/GeneralStore.js'

    //const gst = GeneralStore()
    const props = defineProps({ kind: String })
    const emits = defineEmits(["ev-click"])
    defineExpose({ open, close })

    let show = ref(false)

    function open() {
        show.value = true
    }

    function close() {
        show.value = false
    }

    function ok() {
        emits("ev-click", props.kind)
    } 
</script>

<template>
    <Transition>
        <div v-if="show">
            <div class="popup">
                <slot></slot>
                <div style="margin-top:15px;display:flex;align-items:center;justify-content:flex-end;">
                    <div v-if="props.kind=='addlink' || props.kind=='makelink'" class="btn" @click="ok" style="margin-right:10px">확인</div>
                    <div class="btn" @click="close">닫기</div>
                </div>
            </div>
            <div class="overlay" @click="close"></div>
        </div>
    </Transition>
</template>

<style scoped>

    .v-enter-active, .v-leave-active { transition: opacity 0.5s ease; }
    .v-enter-from, .v-leave-to { opacity: 0; }

    .popup {
        position:fixed;top:50%;left:50%;transform:translate(-50%, -50%);background:white;padding:20px;z-index:1000;
    }

    .overlay {
        position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0, 0, 0, 0.5);z-index: 999;
    }

    .btn {
        height:24px;padding:5px 8px;display:flex;align-items:center;color:dimgray;border:1px solid dimgray;border-radius:5px;cursor:pointer
    }
    .btn:hover { background:var(--second-select-color)}
    .btn:active { background:var(--active-color)}
</style>