<script setup>
import { useWebRtcSync } from '../composables/useWebRtcSync';
import SyncDemoPanel from '../components/SyncDemoPanel.vue';

const sync = useWebRtcSync('b');
</script>

<template>
  <SyncDemoPanel role="b" :sync="sync" />
</template>
