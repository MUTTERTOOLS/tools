import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '股市投资五册手册',
  description: '面向新人的系统性投资学习手册',
  base: '/handbook-html/',
  
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { 
        text: '手册目录', 
        items: [
          { text: '第1册 裸K与价格行为', link: '/01-裸K与价格行为/' },
          { text: '第2册 财报与基本面', link: '/02-财报与基本面/' },
          { text: '第3册 宏观经济分析', link: '/03-宏观经济分析/' },
          { text: '第4册 交易系统与实战', link: '/04-交易系统与实战/' },
          { text: '第5册 风险管理与心理', link: '/05-风险管理与心理/' }
        ]
      }
    ],

    sidebar: {
      '/01-裸K与价格行为/': getSidebar01(),
      '/02-财报与基本面/': getSidebar02(),
      '/03-宏观经济分析/': getSidebar03(),
      '/04-交易系统与实战/': getSidebar04(),
      '/05-风险管理与心理/': getSidebar05()
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-repo' }
    ]
  },

  markdown: {
    config: (md) => {
      // 支持 ECharts 代码块
      md.use(require('markdown-it-container'), 'echarts')
    }
  }
})

function getSidebar01() {
  return [
    {
      text: '第一篇 K线基础',
      items: [
        { text: '第1章 K线的语言', link: '/01-裸K与价格行为/chapter01' },
        { text: '第2章 单根K线详解', link: '/01-裸K与价格行为/chapter02' },
        { text: '第3章 K线组合形态', link: '/01-裸K与价格行为/chapter03' }
      ]
    },
    {
      text: '第二篇 趋势与结构',
      items: [
        { text: '第4章 趋势的定义', link: '/01-裸K与价格行为/chapter04' },
        { text: '第5章 支撑与阻力', link: '/01-裸K与价格行为/chapter05' }
      ]
    }
  ]
}

function getSidebar02() {
  return [
    {
      text: '第一篇 财报认知',
      items: [
        { text: '第1章 为什么必须读财报', link: '/02-财报与基本面/chapter01' },
        { text: '第2章 三大报表全景速览', link: '/02-财报与基本面/chapter02' }
      ]
    },
    {
      text: '第二篇 三表精读',
      items: [
        { text: '第3章 资产负债表', link: '/02-财报与基本面/chapter03' },
        { text: '第4章 利润表', link: '/02-财报与基本面/chapter04' },
        { text: '第5章 现金流量表', link: '/02-财报与基本面/chapter05' },
        { text: '第6章 勾稽关系', link: '/02-财报与基本面/chapter06' }
      ]
    }
  ]
}

function getSidebar03() {
  return [
    {
      text: '第一篇 宏观框架',
      items: [
        { text: '第1章 宏观经济全景图', link: '/03-宏观经济分析/chapter01' }
      ]
    }
  ]
}

function getSidebar04() {
  return [
    {
      text: '第一篇 系统构建',
      items: [
        { text: '第1章 交易系统概论', link: '/04-交易系统与实战/chapter01' }
      ]
    }
  ]
}

function getSidebar05() {
  return [
    {
      text: '第一篇 风险认知',
      items: [
        { text: '第1章 风险的本质', link: '/05-风险管理与心理/chapter01' }
      ]
    }
  ]
}
