<script setup>
import { connected } from "/src/stores/socket.js"
//import GeneralStore from '/src/stores/GeneralStore.js'

//const gst = GeneralStore()
</script>

<template>
  <p>Socket: {{ connected }}</p>
</template>

<style scoped>

</style>