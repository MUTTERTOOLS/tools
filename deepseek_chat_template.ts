// @env node
/**
 * DeepSeek 终端多轮对话模板。
 *
 * 需要 Node.js 18 或更高版本。
 *
 * 使用方法：
 *   export DEEPSEEK_API_KEY="your-api-key"
 *   npx tsx deepseek_chat_template.ts
 *
 * 可选环境变量：
 *   DEEPSEEK_MODEL          模型名，默认 deepseek-v4-flash
 *   DEEPSEEK_BASE_URL       API 地址，默认 https://api.deepseek.com
 *   DEEPSEEK_SYSTEM_PROMPT  系统提示词
 */

import process from 'node:process'
import { createInterface } from 'node:readline/promises'
import { pathToFileURL } from 'node:url'

const DEFAULT_MODEL = 'deepseek-v4-flash'
const DEFAULT_BASE_URL = 'https://api.deepseek.com'
const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant.'
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

type Role = 'system' | 'user' | 'assistant'

export interface ChatMessage {
  role: Role
  content: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return terminalText(message)
}

function terminalText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g, '')
}

function chatEndpoint(): string {
  const configuredBaseUrl = process.env.DEEPSEEK_BASE_URL?.trim()
  const rawBaseUrl = configuredBaseUrl || DEFAULT_BASE_URL

  let baseUrl: URL
  try {
    baseUrl = new URL(rawBaseUrl)
  }
  catch (error) {
    throw new Error('DEEPSEEK_BASE_URL 不是有效的 URL', { cause: error })
  }

  if (
    baseUrl.protocol !== 'https:'
    || !baseUrl.hostname
    || baseUrl.username
    || baseUrl.password
    || baseUrl.search
    || baseUrl.hash
  ) {
    throw new Error(
      'DEEPSEEK_BASE_URL 必须是不含用户信息、查询参数或片段的 HTTPS 地址',
    )
  }

  baseUrl.pathname = `${baseUrl.pathname.replace(/\/$/, '')}/chat/completions`
  return baseUrl.toString()
}

function apiErrorMessage(rawBody: string): string {
  const fallback = rawBody.trim() || '未返回错误详情'
  let body: unknown

  try {
    body = JSON.parse(rawBody)
  }
  catch {
    return fallback
  }

  if (!isRecord(body) || !isRecord(body.error))
    return fallback

  const message = body.error.message
  return typeof message === 'string' && message.trim() ? message.trim() : fallback
}

function replyFromResponse(body: unknown): string {
  if (!isRecord(body) || !Array.isArray(body.choices))
    throw new Error('DeepSeek API 响应中没有可用的回复')

  const firstChoice = body.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message))
    throw new Error('DeepSeek API 响应中没有可用的回复')

  const content = firstChoice.message.content
  if (typeof content !== 'string' || !content.trim())
    throw new Error('DeepSeek API 返回了空回复')

  return content.trim()
}

async function readResponseBody(response: Response): Promise<string> {
  const contentLength = response.headers.get('content-length')
  if (contentLength) {
    const declaredBytes = Number.parseInt(contentLength, 10)
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_RESPONSE_BYTES) {
      await response.body?.cancel().catch(() => undefined)
      throw new Error('DeepSeek API 响应超过 8 MiB 限制')
    }
  }

  if (!response.body)
    return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let receivedBytes = 0
  let body = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      receivedBytes += value.byteLength
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined)
        throw new Error('DeepSeek API 响应超过 8 MiB 限制')
      }
      body += decoder.decode(value, { stream: true })
    }
    body += decoder.decode()
    return body
  }
  finally {
    reader.releaseLock()
  }
}

export async function requestReply(messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim()
  if (!apiKey)
    throw new Error('请先设置环境变量 DEEPSEEK_API_KEY')

  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL
  let response: Response
  let rawBody: string

  try {
    response = await fetch(chatEndpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        thinking: { type: 'disabled' },
        stream: false,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(120_000),
    })
    rawBody = await readResponseBody(response)
  }
  catch (error) {
    throw new Error(`无法连接 DeepSeek API: ${errorMessage(error)}`, { cause: error })
  }

  if (!response.ok) {
    throw new Error(
      `DeepSeek API 请求失败 (${response.status}): ${terminalText(apiErrorMessage(rawBody))}`,
    )
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  }
  catch (error) {
    throw new Error('DeepSeek API 返回了无效的 JSON', { cause: error })
  }

  return replyFromResponse(body)
}

async function main(): Promise<number> {
  if (!process.env.DEEPSEEK_API_KEY?.trim()) {
    process.stderr.write('请先设置 DEEPSEEK_API_KEY，再运行此模板。\n')
    return 1
  }

  const systemPrompt = process.env.DEEPSEEK_SYSTEM_PROMPT?.trim()
    || DEFAULT_SYSTEM_PROMPT
  const model = process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_MODEL
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
  ]
  const readline = createInterface({ input: process.stdin, output: process.stdout })

  process.stdout.write(
    `DeepSeek 对话已启动（模型：${terminalText(model)}），输入 exit 退出，clear 清空上下文。\n`,
  )

  try {
    while (true) {
      let userInput: string
      try {
        userInput = (await readline.question('\n你：')).trim()
      }
      catch {
        process.stdout.write('\n已退出。\n')
        break
      }

      if (['exit', 'quit', '退出'].includes(userInput.toLowerCase())) {
        process.stdout.write('已退出。\n')
        break
      }
      if (['clear', 'reset', '清空'].includes(userInput.toLowerCase())) {
        messages.splice(1)
        process.stdout.write('已清空对话上下文。\n')
        continue
      }
      if (!userInput)
        continue

      messages.push({ role: 'user', content: userInput })
      try {
        const reply = await requestReply(messages)
        messages.push({ role: 'assistant', content: reply })
        process.stdout.write(`DeepSeek：${terminalText(reply)}\n`)
      }
      catch (error) {
        messages.pop()
        process.stderr.write(`请求失败：${errorMessage(error)}\n`)
      }
    }
  }
  finally {
    readline.close()
  }

  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main()
    .then((exitCode) => {
      process.exitCode = exitCode
    })
    .catch((error: unknown) => {
      process.stderr.write(`运行失败：${errorMessage(error)}\n`)
      process.exitCode = 1
    })
}
