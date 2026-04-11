/**
 * Claude Code 桌面端合并 sidecar 入口。
 *
 * 历史上 server 和 cli 是两个独立的 bun-compile 二进制，各自携带一份
 * ~55MB 的 bun runtime。把两份合并成一个二进制只保留一份 runtime，
 * 是 P0 之后剩余空间的最大优化点。
 *
 * 调用约定（必须由调用方传第一个 positional 参数选择模式）：
 *
 *   claude-sidecar server --app-root <path> --host 127.0.0.1 --port 12345
 *   claude-sidecar cli    --app-root <path> [其它 CLI 参数...]
 *
 * 任何模式都必须先做 process.env / process.argv 设置，再 await 进入相应的
 * 子模块树，原因和 server-launcher.ts / cli-launcher.ts 注释一致 ——
 * src/server/index.ts 顶层立刻读 process.argv，必须在它求值前 splice 掉
 * --app-root 和 mode 这些 launcher-only 参数。
 */

const rawArgs = process.argv.slice(2)
if (rawArgs.length === 0) {
  console.error('claude-sidecar: missing mode argument (expected "server" or "cli")')
  process.exit(2)
}
const mode = rawArgs[0]!
const restArgs = rawArgs.slice(1)

const { appRoot, args } = parseLauncherArgs(restArgs)

process.env.CLAUDE_APP_ROOT = appRoot
process.env.CALLER_DIR ||= process.cwd()
process.argv = [process.argv[0]!, process.argv[1]!, ...args]

await import('../../preload.ts')

if (mode === 'server') {
  const { startServer } = await import('../../src/server/index.ts')
  startServer()
} else if (mode === 'cli') {
  await import('../../src/entrypoints/cli.tsx')
} else {
  console.error(`claude-sidecar: unknown mode "${mode}" (expected "server" or "cli")`)
  process.exit(2)
}

function parseLauncherArgs(rawArgs: string[]): { appRoot: string; args: string[] } {
  const nextArgs: string[] = []
  let appRoot: string | null = process.env.CLAUDE_APP_ROOT ?? null

  for (let index = 0; index < rawArgs.length; index++) {
    const arg = rawArgs[index]
    if (arg === '--app-root') {
      appRoot = rawArgs[index + 1] ?? null
      index += 1
      continue
    }
    nextArgs.push(arg!)
  }

  if (!appRoot) {
    throw new Error('Missing --app-root for claude-sidecar')
  }

  return { appRoot, args: nextArgs }
}
