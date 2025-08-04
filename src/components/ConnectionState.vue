<script setup>
import {connected, id} from "/src/stores/socket.js"

</script>

<template>
  <p>State: {{ connected }} {{id}}</p>
</template>

<style scoped>

</style>