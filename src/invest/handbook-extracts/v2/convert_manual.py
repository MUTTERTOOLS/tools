#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
投资五册手册 Markdown → HTML 转换器
逐册重写生成带导航、样式和 ECharts 图表的 HTML 文件
"""

import os
import re
import json
from pathlib import Path

# 配置
SOURCE_DIR = Path(__file__).parent
HTML_DIR = SOURCE_DIR / "html"
TEMPLATE_FILE = SOURCE_DIR / "html" / "template.html"

# 手册配置（使用动态扫描获取真实文件名）
def get_handbook_files():
    """扫描目录获取真实的 MD 文件名"""
    md_files = [f for f in os.listdir(SOURCE_DIR) if f.endswith('.md')]
    
    # 构建映射：册号 -> 文件名
    file_mapping = {}
    for f in md_files:
        if f.startswith('01'):
            file_mapping['01'] = f
        elif f.startswith('02'):
            file_mapping['02'] = f
        elif f.startswith('03'):
            file_mapping['03'] = f
        elif f.startswith('04'):
            file_mapping['04'] = f
        elif f.startswith('05'):
            file_mapping['05'] = f
    
    return file_mapping

FILE_MAPPING = get_handbook_files()

HANDBOOKS = {
    "01": {
        "md_file": FILE_MAPPING.get('01', '01-裸 K 与价格行为 - 完整手册.md'),
        "html_file": "01-裸 K 与价格行为.html",
        "title": "第 1 册 裸 K 与价格行为",
        "subtitle": "不依赖任何技术指标，直接读懂价格本身的语言"
    },
    "02": {
        "md_file": FILE_MAPPING.get('02', '02-财报与基本面 - 完整手册.md'),
        "html_file": "02-财报与基本面.html",
        "title": "第 2 册 财报与基本面",
        "subtitle": "从财务报表到投资决策的完整分析框架"
    },
    "03": {
        "md_file": FILE_MAPPING.get('03', '03-宏观经济分析 - 完整手册.md'),
        "html_file": "03-宏观经济分析.html",
        "title": "第 3 册 宏观经济分析",
        "subtitle": "理解经济周期与政策对股市的影响"
    },
    "04": {
        "md_file": FILE_MAPPING.get('04', '04-交易系统与实战 - 完整手册.md'),
        "html_file": "04-交易系统与实战.html",
        "title": "第 4 册 交易系统与实战",
        "subtitle": "构建可执行的个人交易体系"
    },
    "05": {
        "md_file": FILE_MAPPING.get('05', '05-风险管理与交易心理 - 完整手册.md'),
        "html_file": "05-风险管理与交易心理.html",
        "title": "第 5 册 风险管理与交易心理",
        "subtitle": "资金红线与情绪管理的生存法则"
    }
}


def read_markdown(filepath):
    """读取 Markdown 文件内容"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def read_template():
    """读取 HTML 模板"""
    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        return f.read()


def extract_echarts(md_content):
    """提取 ECharts 代码块并返回 (清理后的 md, echarts 脚本)"""
    echarts_blocks = []
    chart_index = 0
    
    def replace_echarts(match):
        nonlocal chart_index
        chart_index += 1
        json_str = match.group(1).strip()
        
        # 尝试解析 JSON
        try:
            option = json.loads(json_str)
            chart_id = f"chart-{chart_index}"
            echarts_blocks.append({
                'id': chart_id,
                'option': option
            })
            return f'<div id="{chart_id}" class="echarts-container"></div>'
        except json.JSONDecodeError as e:
            print(f"⚠️  ECharts JSON 解析失败 (图表{chart_index}): {e}")
            return match.group(0)  # 保留原样
    
    # 匹配 ```echarts ... ``` 代码块
    pattern = r'```echarts\s*\n(.*?)\n```'
    cleaned_md = re.sub(pattern, replace_echarts, md_content, flags=re.DOTALL)
    
    # 生成 ECharts 初始化脚本
    script_parts = ["// ECharts 图表初始化"]
    for chart in echarts_blocks:
        script_parts.append(f"""
        // 图表{chart['id']}
        var chart_{chart['id'].replace('-', '_')} = echarts.init(document.getElementById('{chart['id']}'));
        chart_{chart['id'].replace('-', '_')}.setOption({json.dumps(chart['option'], ensure_ascii=False)});
        """)
    
    # 添加响应式调整
    script_parts.append("""
        // 窗口大小调整时重绘图表
        window.addEventListener('resize', function() {
            [""" + ', '.join([f"chart_{c['id'].replace('-', '_')}" for c in echarts_blocks]) + """].forEach(function(chart) {
                if (chart) chart.resize();
            });
        });
    """)
    
    echarts_script = '\n'.join(script_parts) if echarts_blocks else "// 暂无图表"
    
    return cleaned_md, echarts_script


def convert_md_to_html(md_content):
    """将 Markdown 转换为 HTML（简化版）"""
    html = md_content
    
    # 处理标题
    html = re.sub(r'^#### (.+)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    
    # 处理引用块
    html = re.sub(r'^> (.+)$', r'<div class="info-box">\1</div>', html, flags=re.MULTILINE)
    
    # 处理粗体
    html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
    
    # 处理列表（简化）
    html = re.sub(r'^[-*] (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
    html = re.sub(r'^(\d+)\. (.+)$', r'<li>\2</li>', html, flags=re.MULTILINE)
    
    # 处理代码块（非 echarts）
    html = re.sub(r'```(\w*)\n(.*?)\n```', r'<pre><code>\2</code></pre>', html, flags=re.DOTALL)
    
    # 处理行内代码
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    
    # 处理段落
    paragraphs = html.split('\n\n')
    processed = []
    for p in paragraphs:
        p = p.strip()
        if p and not p.startswith('<'):
            # 跳过已经是 HTML 标签的内容
            if not re.match(r'^<(h[1-6]|ul|ol|li|div|pre|table)', p):
                p = f'<p>{p}</p>'
        processed.append(p)
    html = '\n'.join(processed)
    
    return html


def process_handbook(handbook_id, config):
    """处理单册手册"""
    print(f"\n📖 处理第{handbook_id}册：{config['title']}")
    
    # 读取 Markdown
    md_path = SOURCE_DIR / config['md_file']
    if not md_path.exists():
        print(f"❌ 文件不存在：{md_path}")
        return False
    
    md_content = read_markdown(md_path)
    print(f"✓ 读取 Markdown: {len(md_content)} 字符")
    
    # 提取 ECharts
    cleaned_md, echarts_script = extract_echarts(md_content)
    print(f"✓ 提取 ECharts 图表")
    
    # 转换 Markdown 到 HTML
    html_content = convert_md_to_html(cleaned_md)
    print(f"✓ 转换为 HTML")
    
    # 读取模板
    template = read_template()
    
    # 替换模板变量
    active_class = "active"
    html_output = template.replace('{{TITLE}}', config['title'])
    html_output = html_output.replace('{{SUBTITLE}}', config['subtitle'])
    html_output = html_output.replace(f'{{ACTIVE_{handbook_id}}}', active_class)
    
    # 其他册的 active 类清空
    for key in HANDBOOKS.keys():
        if key != handbook_id:
            html_output = html_output.replace(f'{{ACTIVE_{key}}}', '')
    
    html_output = html_output.replace('{{CONTENT}}', html_content)
    html_output = html_output.replace('{{ECHARTS_SCRIPT}}', echarts_script)
    
    # 写入 HTML 文件
    output_path = HTML_DIR / config['html_file']
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(html_output)
    
    print(f"✓ 写入 HTML: {output_path}")
    return True


def generate_index():
    """生成系列首页"""
    print("\n📚 生成系列首页...")
    
    index_html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>投资者教育手册系列 - 全五册</title>
    <style>
        :root {
            --primary-color: #2c5282;
            --secondary-color: #3182ce;
            --bg-color: #f7fafc;
            --text-color: #2d3748;
        }
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.8;
            color: var(--text-color);
            background: var(--bg-color);
        }
        
        .hero {
            background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
            color: white;
            padding: 80px 20px;
            text-align: center;
        }
        
        .hero h1 { font-size: 3em; margin-bottom: 20px; }
        .hero p { font-size: 1.3em; opacity: 0.9; }
        
        .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
        
        .handbook-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 30px;
            margin-top: 40px;
        }
        
        .handbook-card {
            background: white;
            border-radius: 12px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.3s;
            text-decoration: none;
            color: inherit;
        }
        
        .handbook-card:hover {
            transform: translateY(-5px);
        }
        
        .handbook-card h3 {
            color: var(--primary-color);
            font-size: 1.5em;
            margin-bottom: 15px;
        }
        
        .handbook-card p {
            color: #718096;
            margin-bottom: 20px;
        }
        
        .handbook-card .badge {
            display: inline-block;
            background: var(--secondary-color);
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-size: 0.9em;
        }
        
        footer {
            text-align: center;
            padding: 40px;
            color: #718096;
            border-top: 1px solid #e2e8f0;
            margin-top: 60px;
        }
    </style>
</head>
<body>
    <div class="hero">
        <h1>📚 投资者教育手册系列</h1>
        <p>从零开始，建立完整的投资知识体系</p>
    </div>
    
    <div class="container">
        <div class="handbook-grid">
"""
    
    for handbook_id, config in HANDBOOKS.items():
        index_html += f"""
            <a href="html/{config['html_file']}" class="handbook-card">
                <h3>{config['title']}</h3>
                <p>{config['subtitle']}</p>
                <span class="badge">阅读手册 →</span>
            </a>
"""
    
    index_html += """
        </div>
    </div>
    
    <footer>
        <p>《投资者教育手册系列》（全五册） © 2024</p>
        <p>仅供学习参考，不构成投资建议</p>
    </footer>
</body>
</html>
"""
    
    output_path = SOURCE_DIR / "index.html"
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(index_html)
    
    print(f"✓ 生成系列首页：{output_path}")


def main():
    """主函数"""
    print("=" * 60)
    print("🚀 投资五册手册 Markdown → HTML 转换器")
    print("=" * 60)
    
    # 确保 HTML 目录存在
    HTML_DIR.mkdir(exist_ok=True)
    
    # 逐册处理
    success_count = 0
    for handbook_id, config in HANDBOOKS.items():
        if process_handbook(handbook_id, config):
            success_count += 1
    
    # 生成首页
    generate_index()
    
    print("\n" + "=" * 60)
    print(f"✅ 转换完成！成功处理 {success_count}/{len(HANDBOOKS)} 册手册")
    print(f"📁 HTML 文件位于：{HTML_DIR}")
    print(f"🏠 系列首页：{SOURCE_DIR / 'index.html'}")
    print("=" * 60)


if __name__ == "__main__":
    main()
