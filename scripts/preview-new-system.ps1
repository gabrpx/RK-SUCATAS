param(
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\..\..\.env'),
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

Write-Host "Iniciando o preview novo em http://127.0.0.1:$Port/estoque"
Write-Host "Arquivo de ambiente carregado de forma privada: $envPath"

$projectNode = Join-Path $worktreeRoot 'node_modules\node\bin\node.exe'
$esbuildCli = Join-Path $worktreeRoot 'node_modules\esbuild\bin\esbuild'
$serverBundle = Join-Path $worktreeRoot '.codex-preview-server.mjs'

if ((Test-Path -LiteralPath $projectNode) -and (Test-Path -LiteralPath $esbuildCli)) {
  & $projectNode $esbuildCli 'server.ts' '--bundle' '--platform=node' '--format=esm' '--packages=external' "--outfile=$serverBundle"
  if ($LASTEXITCODE -ne 0) { throw 'Não foi possível preparar o backend do preview.' }

  try {
    # O Node carrega o arquivo antes dos imports do backend, inclusive do
    # cliente Supabase, que valida as variáveis durante a inicialização.
    & $projectNode "--env-file=$envPath" $serverBundle
  } finally {
    if (Test-Path -LiteralPath $serverBundle) {
      Remove-Item -LiteralPath $serverBundle -Force
    }
  }
} else {
  npm run dev
}
