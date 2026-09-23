# Filtro por empresa multiselect

_Started 2026-09-23 14:00 UTC_

---

## User

Objetivo: Implementar filtro por empresa, onde o usuario pode selecionar quantas empresas quiser, e salvar elas como visão padrão. Quando conectar com supabase, lá tem 60 empresas, então o filtro de buscar empresa precisa ter pesquisa e trazer barra de rolagem. Siga o modelo existente em "cadastro de usuários"

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

Now implementing: add `mkMultiDropdown` helper, load/save default-view logic, filter groups by selected companies, and wire the UI into the Programação do dia filter bar.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now wire it into `progVals()` — add filter state, catalog, default-view save/load, and filter the rows.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now add the return-object fields (ddPgEmp, save/label/style, empty-state) and update `pgExpandAll`/`pgCollapseAll` which referenced `this.state.pgRows` (still fine, unrelated). Let's view current return block to insert cleanly.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

Good — `\u00b3` was fine as an actual escape (renders as `·` in JS). No further fix needed. Now add componentDidMount load logic and template markup.

_[tool: str_replace_edit]_

Now the template. Replace the empty placeholder div in the filter bar with the empresa filter + save button, add the dropdown-close overlay, and add an empty-state row for zero-company selection.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now add the overlay for outside-click closing, right after this filter bar block.

_[tool: str_replace_edit]_

Now add the empty-state row for when zero companies are selected, in the table body.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

Now let's verify it renders correctly.

_[tool: show_html]_

_[tool: get_webview_logs]_

_[tool: eval_js]_

_[tool: ready_for_verification]_

Added a multi-select company filter to Programação do dia, following the "cadastro de usuários" dropdown pattern: searchable, scrollable checkbox list ("Selecionar todas"/"Limpar seleção"), plus a "Salvar como visão padrão" button that persists the selection to localStorage and restores it on load. The rows table now filters by selected companies, with an empty-state message if none are selected. Built to scale to Supabase's 60 companies (search appears once the catalog is large enough, list scrolls past ~260px).

