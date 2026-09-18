<script setup>
import { onMounted, ref } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
  option: {
    type: Object,
    required: true
  }
})

const chartRef = ref(null)

onMounted(() => {
  if (chartRef.value) {
    const chart = echarts.init(chartRef.value)
    chart.setOption(props.option)
    
    // 响应式调整
    window.addEventListener('resize', () => {
      chart.resize()
    })
  }
})
</script>

<template>
  <div ref="chartRef" style="width: 100%; height: 400px;"></div>
</template>

<style scoped>
div {
  margin: 20px 0;
  border-radius: 8px;
  overflow: hidden;
}
</style>
