# Identidade do projeto

Este arquivo é um marcador operacional para humanos e agentes. Ele existe para evitar que o projeto novo seja confundido com o checkout legado.

## Projeto correto: novo sistema

- Nome: `RK Sucatas — NOVO SISTEMA`
- Caminho absoluto: `D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`
- Abas de referência: `Clientes`, `Vendas`, `Caixa`, `Tarefas`
- Rota principal da nova tela: `/tarefas`
- Porta local reservada: `3001`
- URL de validação: `http://127.0.0.1:3001/tarefas`
- Título do navegador: `RK Sucatas · NOVO SISTEMA`

## Projeto que não deve ser usado

- Caminho legado: `D:\SISTEMA CLAUDE`
- Porta observada no legado: `4173`
- A URL `http://127.0.0.1:4173/tarefas-preview` não valida este checkout.
- Não editar arquivos, iniciar servidores ou concluir auditorias do novo sistema dentro do caminho legado.

## Procedimento obrigatório antes de trabalhar

No PowerShell, a partir deste checkout:

```powershell
Set-Location 'D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE'
Get-Location
git status --short --branch
./scripts/verify-new-project.ps1
```

O script falha se o diretório atual não for exatamente o checkout novo. Para abrir o preview do novo sistema, use a porta `3001` e valide a rota `/tarefas`. Se outra porta for necessária, ela deve ser informada explicitamente no comando e no relatório; nunca reutilize `4173` sem confirmar a origem do processo.

## Regra para agentes

Relatórios, capturas de tela e servidores em execução são evidências auxiliares. A fonte de verdade é o caminho do checkout e o código presente neste repositório. Ao assumir uma tarefa, confirme primeiro a identidade do projeto; se houver divergência, registre-a e corrija o contexto antes de modificar a aplicação.
