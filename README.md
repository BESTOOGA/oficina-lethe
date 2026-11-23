# Oficina Lethe

Editor de **theme packs de Mirror Dungeon** para o [Lethe](https://lethelc.site), feito para rodar no navegador e em português.

**▶ Usar agora:** https://bestooga.github.io/oficina-lethe/

Você monta o pacote, vê como ele vai ficar e baixa um `.zip` pronto para colocar na pasta de mods do Lethe.

## O que dá para fazer

- **Lutas:** escolher entre mais de 900 lutas base do Mirror Dungeon (com busca), trocar inimigos, quantidades e níveis, criar até 6 ondas, mudar o cenário de cada onda, fazer chain battle e dar nome a cada luta.
- **Mapa do andar:** árvore ou reta, número de passos e de eventos “?”, com prévia exata do mapa que vai para o jogo.
- **Andares:** em quais andares do modo normal (1–5) e difícil (1–15) o pacote aparece, e rate up no sorteio.
- **Encontros de abno:** quais eventos podem aparecer nos “?” e quais têm rate up.
- **Visual:** aparência de um pacote do jogo ou capa própria, com recorte no formato do pacote.
- **Bosses customizados:** envie o `.zip` de um mod de boss do Lethe e use o boss nas lutas do pacote; os arquivos dele vão juntos na exportação.
- **Prévia:** pacote como aparece na seleção de temas, mapa e lista de arquivos do ZIP.

O rascunho fica salvo no seu navegador.

## Instalar o pacote no Lethe

1. Clique em **Exportar pacote** e baixe o `.zip`.
2. Extraia dentro de `BepInEx/plugins/Lethe/mods/` na pasta do Lethe. Se estiver atualizando um pacote, tire a pasta da versão antiga antes.
3. No jogo, aperte **8** para recarregar os mods e procure o pacote na seleção de temas do Mirror Dungeon.

> Se o pacote usa um boss customizado, não instale também o mod original desse boss: os IDs se repetiriam.

## Usar sem internet

Baixe o arquivo [`Oficina Lethe.html`](Oficina%20Lethe.html) e abra no Chrome. Ele já tem tudo dentro (sem internet, só as fontes mudam).

## Desenvolvimento

O código fica em `dist/` (HTML, CSS e JavaScript puros, sem build). Detalhes da arquitetura e dos formatos do jogo estão em [`CLAUDE.md`](CLAUDE.md).

```sh
python -m http.server 8000 --bind 127.0.0.1 --directory dist   # testar em http://127.0.0.1:8000
python tools/gerar_offline.py     # regenera "Oficina Lethe.html"
python tools/gerar_catalogo.py    # refaz dist/catalog.js a partir do OpenLethe
```

Cada push na branch `main` publica `dist/` no GitHub Pages.

## Créditos

- Dados de lutas, inimigos, temas e eventos: [OpenLethe](https://github.com/LEAGUE-OF-NINE/OpenLethe) (LEAGUE-OF-NINE).
- Limbus Company e seus nomes, dados e artes pertencem à Project Moon. Este é um projeto de fã, sem ligação com a Project Moon nem com o Lethe.
