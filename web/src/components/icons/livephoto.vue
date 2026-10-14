<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (C) 2025-2026 lin-snow -->
<template>
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" :stroke="color" stroke-width="1.5" stroke-dasharray="2 2" />
    <circle cx="12" cy="12" r="6" :stroke="color" stroke-width="1.5" />
    <circle cx="12" cy="12" r="3" :fill="color" />
  </svg>
</template>

<script lang="ts">
export default {
  name: 'LivePhotoIcon',
  props: {
    color: {
      type: String,
      default: 'currentColor',
    },
  },
}
</script>
