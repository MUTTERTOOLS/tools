#!/usr/bin/env python3
"""
将投资五册 Markdown 手册转换为 VitePress HTML 站点格式
- 解析原始 Markdown 文件
- 提取章节内容
- 生成 VitePress 兼容的章节文件
- 处理 ECharts 代码块
"""

import os
import re
import json
from pathlib import Path

# 源文件路径
SOURCE_DIR = Path("/workspace/src/invest/handbook-extracts/v2")
# 目标文件路径
TARGET_DIR = Path("/workspace/src/invest/handbook-html/docs")

# 五册手册映射 - 使用实际存在的文件名（无空格版本）
HANDBOOKS = {
    "01": {
        "file": "01-裸 K 与价格行为 - 完整手册.md",
        "title": "裸 K 与价格行为",
        "dir": "01-裸 K 与价格行为"
    },
    "02": {
        "file": "02-财报与基本面 - 完整手册.md",
        "title": "财报与基本面",
        "dir": "02-财报与基本面"
    },
    "03": {
        "file": "03-宏观经济分析 - 完整手册.md",
        "title": "宏观经济分析",
        "dir": "03-宏观经济分析"
    },
    "04": {
        "file": "04-交易系统与实战 - 完整手册.md",
        "title": "交易系统与实战",
        "dir": "04-交易系统与实战"
    },
    "05": {
        "file": "05-风险管理与交易心理 - 完整手册.md",
        "title": "风险管理与交易心理",
        "dir": "05-风险管理与心理"
    }
}

def find_source_file(filename):
    """查找源文件，处理文件名中可能存在的空格差异"""
    source_file = SOURCE_DIR / filename
    
    if source_file.exists():
        return source_file
    
    # 尝试移除所有空格
    no_space = filename.replace(" ", "")
    alt_file = SOURCE_DIR / no_space
    if alt_file.exists():
        return alt_file
    
    # 尝试添加空格在特定位置
    variations = [
        filename.replace("-", "- "),
        filename.replace("-", " -"),
        filename.replace(".md", " .md"),
    ]
    
    for var in variations:
        alt_file = SOURCE_DIR / var
        if alt_file.exists():
            return alt_file
    
    return None

def extract_chapters(content, handbook_id):
    """从完整手册中提取各章节内容"""
    chapters = []
    
    # 匹配章节标题：第 X 章 XXXX
    chapter_pattern = r'^(#+)\s*(第 [一二三四五六七八九十\d]+ 章 [^\n]+)'
    
    lines = content.split('\n')
    current_chapter = None
    current_content = []
    in_chapter = False
    
    for i, line in enumerate(lines):
        match = re.match(chapter_pattern, line.strip())
        
        if match:
            # 保存前一章
            if current_chapter and current_content:
                chapters.append({
                    'title': current_chapter,
                    'content': '\n'.join(current_content),
                    'chapter_num': extract_chapter_num(current_chapter)
                })
            
            # 开始新章节
            current_chapter = line.strip()
            current_content = [line]
            in_chapter = True
        elif in_chapter:
            current_content.append(line)
    
    # 保存最后一章
    if current_chapter and current_content:
        chapters.append({
            'title': current_chapter,
            'content': '\n'.join(current_content),
            'chapter_num': extract_chapter_num(current_chapter)
        })
    
    return chapters

def extract_chapter_num(title):
    """从章节标题提取章号"""
    match = re.search(r'第 ([\d]+) 章', title)
    if match:
        return int(match.group(1))
    return 0

def convert_echarts_codeblocks(content):
    """转换 ECharts 代码块为 Vue 组件调用"""
    # 匹配 ```echarts 或 ```json 代码块
    pattern = r'```(echarts|json)\s*\n([\s\S]*?)\n```'
    
    def replace_echarts(match):
        lang = match.group(1)
        code = match.group(2)
        
        # 尝试解析 JSON
        try:
            # 清理可能的 markdown 格式
            code_clean = code.strip()
            if code_clean.startswith('{') and code_clean.endswith('}'):
                option = json.loads(code_clean)
                # 生成 Vue 组件调用
                option_str = json.dumps(option, ensure_ascii=False)
                return f'<ECharts :option=\'{option_str}\' />'
        except:
            pass
        
        # 如果解析失败，保留原代码块但标记为 javascript
        return f'```javascript\n{code}\n```'
    
    return re.sub(pattern, replace_echarts, content)

def add_frontmatter(content, title, chapter_num):
    """添加 VitePress frontmatter"""
    frontmatter = f"""---
title: "{title}"
outline: deep
---

"""
    return frontmatter + content

def process_handbook(handbook_id, handbook_info):
    """处理单册手册"""
    # 使用智能文件查找函数
    source_file = find_source_file(handbook_info["file"])
    
    if source_file is None:
        print(f"⚠️  源文件不存在：{handbook_info['file']}")
        return False
    
    target_dir = TARGET_DIR / handbook_info["dir"]
    
    # 创建目标目录
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # 读取源文件
    with open(source_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"📖 正在处理：{handbook_info['title']}")
    
    # 提取章节
    chapters = extract_chapters(content, handbook_id)
    print(f"   找到 {len(chapters)} 个章节")
    
    # 处理每个章节
    for chapter in chapters:
        chapter_num = chapter['chapter_num']
        chapter_title = chapter['title'].replace('#', '').strip()
        
        # 清理内容
        chapter_content = chapter['content']
        
        # 转换 ECharts 代码块
        chapter_content = convert_echarts_codeblocks(chapter_content)
        
        # 添加 frontmatter
        final_content = add_frontmatter(chapter_content, chapter_title, chapter_num)
        
        # 生成文件名
        filename = f"chapter{chapter_num:02d}.md"
        filepath = target_dir / filename
        
        # 写入文件
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(final_content)
        
        print(f"   ✓ {filename}: {chapter_title[:30]}...")
    
    # 创建该册的 index.md
    index_content = f"""---
title: "{handbook_info['title']}"
---

# {handbook_info['title']}

本册共包含 {len(chapters)} 章，涵盖从基础到进阶的完整知识体系。

## 章节目录

"""
    for chapter in chapters:
        chapter_num = chapter['chapter_num']
        chapter_title = chapter['title'].replace('#', '').strip()
        index_content += f"- [第{chapter_num}章 {chapter_title}](./chapter{chapter_num:02d}.md)\n"
    
    index_file = target_dir / "index.md"
    with open(index_file, 'w', encoding='utf-8') as f:
        f.write(index_content)
    
    print(f"   ✓ 生成索引文件 index.md")
    return True

def main():
    print("🚀 开始转换投资五册手册为 HTML 格式...\n")
    
    success_count = 0
    for handbook_id, info in HANDBOOKS.items():
        if process_handbook(handbook_id, info):
            success_count += 1
        print()
    
    print(f"✅ 完成！成功转换 {success_count}/{len(HANDBOOKS)} 册手册")
    print(f"📁 输出目录：{TARGET_DIR}")
    print(f"\n下一步：")
    print(f"  1. cd {TARGET_DIR.parent}")
    print(f"  2. npm run dev  # 启动开发服务器预览")
    print(f"  3. npm run build  # 构建生产版本")

if __name__ == "__main__":
    main()
