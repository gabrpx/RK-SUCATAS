$ErrorActionPreference = 'Stop'

$expectedRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path.TrimEnd('\')
$actualRoot = (Get-Location).Path.TrimEnd('\')
$expectedName = 'D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE'

if (-not [StringComparer]::OrdinalIgnoreCase.Equals($expectedRoot, $expectedName)) {
  throw "Configuração inesperada: o script está em '$expectedRoot', mas o checkout novo esperado é '$expectedName'."
}

if (-not [StringComparer]::OrdinalIgnoreCase.Equals($actualRoot, $expectedRoot)) {
  throw "PROJETO INCORRETO: diretório atual '$actualRoot'. Execute Set-Location '$expectedRoot' e tente novamente."
}

Write-Host 'PROJETO CONFIRMADO: RK Sucatas — NOVO SISTEMA' -ForegroundColor Green
Write-Host "DIRETORIO: $actualRoot"
Write-Host 'PORTA CANÔNICA: 3001'
Write-Host 'ROTA CANÔNICA DE TAREFAS: /tarefas'
