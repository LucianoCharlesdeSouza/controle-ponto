<script setup>
import { useWebRtcSync } from '../composables/useWebRtcSync';
import SyncDemoPanel from '../components/SyncDemoPanel.vue';

const sync = useWebRtcSync('a');
</script>

<template>
  <SyncDemoPanel role="a" :sync="sync" />
</template>
