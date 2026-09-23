# Cadastro de Perfis e Permissões

_Started 2026-09-23 18:12 UTC_

---

## User

Objetivo: crie a tela de cadastro de perfis. Nessa tela devo cadastrar o nome de perfil e as permissões. As permissões desse sistema se dará através dos menus e submenus, ou seja liberar permissão para visualizar ou não visualizar o módulo e o submenu. (Ex; Sem permissão para modulo CRC, permissão para modulo apenas de Caixa do setor financeiro). Permissões serão apenas 2, visualizar e editar (ou apenas 1 dos 2).
Siga o padrão da tela de usuarios existente.

## Assistant

_[tool: list_files]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: grep]_

Good — found the modal template near line 2080-2130, outside the `sc-if` blocks (near end of the aside/main structure, before closing). Let me read that full modal block and the surrounding end-of-file structure, plus the departamentos JS state fully.

_[tool: read_file]_

_[tool: grep]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

Now I have everything needed. Applying all edits.

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Now the JS logic edits.

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

Also need to update `isDashboard` exclusion list so the Perfis page doesn't fall back to dashboard rendering.

_[tool: dc_js_str_replace]_

Now let's verify it renders and works.

_[tool: show_html]_

_[tool: ready_for_verification]_

Tela de Perfis criada seguindo o padrão de Usuários/Departamentos: cadastro de nome, descrição e situação, mais uma matriz de permissões por módulo/submenu (espelhando o menu lateral) com checkboxes de Visualizar e Editar — marcar Editar liga Visualizar automaticamente, e desmarcar Visualizar desliga Editar. Item "Perfis" no menu já navega para a nova tela.

