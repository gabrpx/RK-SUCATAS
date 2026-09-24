param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\.env'),
  [int]$Port = 3001
)

$ErrorActionPreference = 'Stop'
$worktreeRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = (Resolve-Path $EnvFile).Path

if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw "Arquivo de ambiente não encontrado: $envPath"
}

Set-Location $worktreeRoot
$env:DOTENV_CONFIG_PATH = $envPath
$env:PORT = [string]$Port
$env:NODE_ENV = 'development'
$env:VITE_CACHE_DIR = Join-Path ([System.IO.Path]::GetTempPath()) 'rk-sucatas-vite-preview'

Write-Host "PROJETO: RK Sucatas — NOVO SISTEMA"
Write-Host "DIRETORIO: $worktreeRoot"
Write-Host "Iniciando o preview novo em http://127.0.0.1:$Port/tarefas"
Write-Host "A porta 4173 pertence ao projeto legado e não deve ser usada para validar este checkout."
Write-Host "Arquivo de ambiente carregado de forma privada: $envPath"

$projectNode = Join-Path $worktreeRoot 'node_modules\node\bin\node.exe'
$tsxCli = Join-Path $worktreeRoot 'node_modules\tsx\dist\cli.mjs'

if ((Test-Path -LiteralPath $projectNode) -and (Test-Path -LiteralPath $tsxCli)) {
  # Executar o TypeScript diretamente preserva a resolução de dependências
  # pelo node_modules do checkout e evita bundles temporários bloqueados.
  & $projectNode $tsxCli 'server.ts'
} else {
  npm run dev
}
