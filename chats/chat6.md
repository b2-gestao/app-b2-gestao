# Modal sobreposta pelos filtros

_Started 2026-09-23 13:19 UTC_

---

## User

Ao clicar em editar lançamento oui cadastrar novo lançamento, a faixa de "filtros" está sobrepondo a modal de cadastro.

## Assistant

Entendi o problema. A faixa de filtros está com um `z-index` maior que a modal, fazendo-a sobrepor. Vou corrigir isso ajustando o `z-index` da modal para ficar acima dos filtros.

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

Encontrei o problema. Os overlays das modais estão com `z-index:60` enquanto os filtros têm `z-index:80`. Vou aumentar o z-index das modais para ficar acima dos filtros.

_[tool: str_replace_edit]_

Vou ler as linhas exatas para fazer a substituição corretamente.

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Preciso encontrar as linhas com o z-index que vou substituir:

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

Agora vou fazer as substituições:

_[tool: str_replace_edit]_

Pronto. Aumentei o z-index das modais de 60 para 100, acima do z-index dos filtros (80). As modais de lançamento, departamento e usuários agora vão aparecer sobre a faixa de filtros.

_[tool: show_to_user]_

_[tool: ready_for_verification]_

Feito. As modais agora aparecem acima dos filtros quando você abre uma para editar ou cadastrar lançamento.

