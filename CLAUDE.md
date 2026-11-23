# Oficina Lethe — guia de continuidade

Este é o projeto editável da Oficina Lethe, um editor em português para criar theme packs de Mirror Dungeon no navegador. A interface monta o pacote e baixa um ZIP para instalar no Lethe. Para usar a oficina imediatamente, extraia esta pasta e abra **Oficina Lethe.html** no Chrome. Esse HTML já contém os dados, os scripts e a imagem.

## Como trabalhar no projeto

1. Edite os arquivos em `dist/`. Eles são a fonte do site e da edição offline.
2. Para testar durante a edição, rode o comando abaixo **na pasta que contém este manual** e abra `http://127.0.0.1:8000` no Chrome. Use Ctrl+C para encerrar o servidor.

   ```sh
   python -m http.server 8000 --bind 127.0.0.1 --directory dist
   ```

3. Depois de alterar os fontes, execute `python tools/gerar_offline.py`. Ele atualiza **Oficina Lethe.html** na raiz usando apenas a biblioteca padrão do Python 3. No Windows, também pode usar `py -3` no lugar de `python`.
4. Abra o HTML regenerado e repita o teste de exportação abaixo. Se adicionar um script ou recurso, inclua-o também no gerador offline.

## Onde mexer

| Arquivo em dist/ | Responsabilidade |
| --- | --- |
| index.html, style.css, hero.webp | Estrutura da tela, estilos e ilustração. Tema escuro “sabor Limbus”: tokens no `:root` de style.css (dourado `--gold` para ações e foco, carmesim `--red` para bosses e perigo), títulos em Barlow Condensed caixa alta, rótulos em IBM Plex Mono, cantos chanfrados (`--cut`). As fontes vêm do Google Fonts; sem internet, o HTML offline usa as fontes do sistema. A barra de exportação fica fixa no rodapé enquanto se rola a página. |
| app.js | Eventos da interface, abas, ondas, recorte da capa, rascunho local, prévia do pacote e download |
| catalog.js | Gerado por `tools/gerar_catalogo.py`: 944 lutas base, 561 inimigos, 225 cenários (`maps`) e 82 encontros de abno (`events`) |
| skins.js | 121 aparências, seleção do visual e arquivos PNG por ID de tema |
| export.js | Validação, IDs, lutas, mapa do andar, andares, encontros, sorteio e localização |
| zip.js | `packZip` (monta o ZIP exportado) e `unpackZip` (lê ZIPs enviados, com `DecompressionStream`) |
| bosses.js | Bosses customizados enviados como ZIP de mod do Lethe (leitura, catálogo, IndexedDB, exportação) |

### Catálogo

`python tools/gerar_catalogo.py` baixa os dados do OpenLethe na revisão fixa do script (cache em `tools/_cache_openlethe/`, pode ser apagado) e reescreve `dist/catalog.js`; depois rode `tools/gerar_offline.py`. As lutas base são as usadas nos pools reais dos temas (`battlePool`, `abBattlePool`, `hardBattlePool`, `hardAbBattlePool`, `bossPool`, nós fixos), uma por formação, sem unidades sem nome nem ondas com mais de 12 inimigos. Cada luta guarda o registro original inteiro (scripts, reforços, câmera) e ganha `group` (tema de origem), `kind` (Chefe, Anormalidade, Difícil…) e `scripted` quando usa scripts do jogo. As 26 lutas e 55 inimigos da primeira versão ficam em `legacy` e são mantidos com os mesmos IDs e nomes, para os rascunhos antigos continuarem válidos. Os inimigos têm `types` (tipos de luta em que aparecem; o editor só oferece inimigos do mesmo tipo da luta base, como nos dados do jogo), `level` e `boss`. Os nomes vêm de `EN_Enemies*` pelo id, `viewid`, `sdPortrait` ou o prefixo da aparência; nomes escondidos (“???”) ganham o nome do modelo.

No exportador, uma onda que não foi alterada mantém tudo o que o jogo escreveu (inclusive `subUnitList`, os reforços); se os inimigos mudarem, os reforços são descartados. Os scripts da luta continuam, e a interface avisa que trocar inimigos de uma luta com `scripted` pode quebrar a mecânica.

Os seletores de luta base, inimigo e cenário são campos com busca (`picker` em app.js): um botão que abre um painel com busca por nome, tema, tipo, inimigos da luta e id, navegável pelo teclado.

O HTML offline passou de 1 MB. Ele abre normalmente no Chrome; para testar no painel de navegador do Claude, sirva a pasta por HTTP (comando do passo 2) em vez de abrir o arquivo direto.

### Bosses customizados

Em “Meu pacote”, “Enviar boss customizado (.zip)” aceita o ZIP de um mod de boss do Lethe, sem limite de tamanho. `bosses.js` acha a raiz do mod (a pasta que contém `custom_limbus_data`) e guarda todos os arquivos dela que estão em subpastas (`custom_*`, `motion_appearances` do plugin Motions etc.), em base64. Os arquivos ficam no **IndexedDB** do navegador (banco `oficina-lethe`, store `bosses`, chave `boss-<ids dos inimigos>`); o rascunho no localStorage só guarda `{key, name, file}` de cada boss, e por isso a página termina de carregar de forma assíncrona (`loadDraft`; `save()` não grava antes disso). Rascunhos antigos com os arquivos dentro migram sozinhos para o IndexedDB.

A cada carga, os inimigos de `custom_limbus_data/enemy` e `abnormality-unit` (nome de `custom_limbus_locale/EN/enemyList`) e as lutas de `battle-mirrordungeon` ou `custom_encounters/*/encounter.json` que usam esses inimigos entram no catálogo (grupo “Boss enviado”, `custom: <key>`); o tipo do inimigo vem do `stageType` dessas lutas. Unidades do jogo que essas lutas usam e o catálogo não tem viram “Unidade <id>”. IDs que já existem no catálogo são ignorados, com aviso. Reenviar um ZIP com os mesmos IDs atualiza o boss; lutas do pacote que deixam de combinar (ex.: o boss virou anormalidade) são refeitas a partir da luta do boss, com aviso, tanto no envio quanto ao carregar. Se um boss sumir do IndexedDB, só as lutas dele voltam a uma luta comum.

Na exportação, os bosses usados no pacote mandam todos os seus arquivos, exceto o pacote, as lutas, o estágio e os títulos do próprio mod (`SKIP` em bosses.js), porque a oficina escreve os seus. Não instale o mod original do boss junto com o pacote, para não repetir IDs. Um boss em uso não pode ser removido. Testado no navegador com um boss de 8,9 MB (anormalidade com aparência do Motions); não testado no jogo.

### Prévia e capa

A seção **Prévia do pacote** (`renderPreview` em app.js) chama `LetheExport.buildFiles` e `buildLayout` e desenha o que será exportado: o pacotinho de foil do tema (proporção 300 × 553, como a arte dos pacotes na wiki), o mapa do andar com as cores de `mapOptions`, os inimigos da luta selecionada e a lista de arquivos do ZIP. Os sprites reais do jogo não estão no projeto; sem capa personalizada, o pacote mostra a cor e o `packSpriteId` da aparência. Ao enviar uma capa, abre a janela “Encaixar a capa” (arrastar, zoom, setas do teclado), que recorta em 416 × 767 PNG. A doc do Lethe não informa a resolução de `themePack_<id>.png`.

### Abas

O painel da direita tem as abas Lutas, Andares, Encontros de abno, E.G.O Gifts e Probabilidades; as duas últimas ainda mostram “Em breve”.

**Lutas.** Cada luta pode ter um nome próprio (`title`; sem ele, vale o nome da luta base), de 1 a `MAX_WAVES` (6) ondas, um cenário por onda (`maps`, `null` = cenário da luta base) e o formato chain battle (`chain`). Ondas além das da luta base copiam a última onda dela (música e formação). Os cenários vêm dos registros `battle-mirrordungeon` do OpenLethe. Chain battle grava `useUserSelection: true` em cada onda, como nas lutas da Line 5 (ex.: 2068131), para o jogador escolher uma nova equipe antes de cada onda.

**Andares.** `project.floors = {normal: [0-4], hard: [0-14]}` (andares a partir de 0; sem o campo, vale `{normal:[0], hard:[0]}`) e o rate up do pacote. `floorConditions` converte isso para `exceptionConditions` como nas tabelas do jogo: `dungeonIdx` 0 é o modo normal; 1, 2 e 3 são os andares 1–5, 6–10 e 11–15 do modo difícil; `selectableFloors` é a posição dentro desses cinco andares e é omitido quando os cinco estão marcados (ex.: Line 1 = `[{1,[4]},{2}]`).

**Encontros de abno.** `project.events = {allowed: [ids], up: [ids], chance: 1-100}`; sem o campo, valem os 20 eventos genéricos do pacote 1024 (`EVENT_POOL`). Os liberados sem rate up vão para `eventPool`; os com rate up para `specialEventPool`, com `specialEventProb = chance/100`. No OpenLethe, `MdEventPicker.Pick` tenta primeiro o grupo especial com essa chance; IDs repetidos não pesam (ele usa `Distinct`). Todos entram também em `FILL_EMPTY_EVENT`. Os nomes do catálogo vêm de `EN_MirrorDungeonAbName` (pelo E.G.O gift temático que o evento dá), do gift e da primeira frase do texto do evento.

### Nomes no jogo

O Lethe lê `custom_limbus_locale/<EN|KR|JP>/<lista>/*.json` como um objeto indexado pelo id (`{"600000": {"id": 600000, "name": "..."}}`), não no formato `{dataList: [...]}` dos arquivos do jogo; com `dataList`, os nomes apareciam como “Unknown”. A lista `mirrorDungeonThemeList` (campo `_mirrorDungeonThemeList` do `TextDataSet`) nomeia os pacotes. Os títulos das lutas vão para `stageNodeText`, indexados pelo id da batalha, no formato `{id, title, desc}` dos textos `MirrorDungeonNode` do jogo. O nome dos pacotes segue o formato dos mods do Lethe; a lista usada para o título das lutas é a melhor hipótese e precisa ser confirmada no jogo.

### Mapa do andar

No jogo há dois formatos em `mapGenSequence[0]`: `CREATE_EMPTY_MD4_FLOOR` (árvore sorteada pelo servidor a cada run, largura em `numberList[0]`, sempre 2–3 eventos) e `CREATE_FIXED_FLOOR` (nós escritos no JSON; as Lines 1 e 5 são retas, Walpurgis 4 é uma árvore fixa). A oficina sempre exporta `CREATE_FIXED_FLOOR`, para a prévia ser exata. `project.map = {shape: "tree"|"line", steps, events, seed}`; sem `map`, rascunhos antigos viram uma reta com uma luta por passo, como antes. A árvore porta `MdMapGen.GenerateMd4Graph` com RNG semeado (3 linhas, até 12 passos; a reta vai até 30). Os eventos “?” saem com `encounterId` 0 e são sorteados dos encontros da aba Encontros de abno. As lutas comuns preenchem os combates por profundidade (as primeiras no começo do andar) e se repetem se houver mais nós que lutas; as que não cabem aparecem como “fora do mapa”. Loja e chefe ficam sempre no fim.

Nada disto foi testado dentro do jogo ainda: mapa fixo, eventos, chain battle, andares, nomes e capa.

O rascunho fica no localStorage com a chave `oficina-lethe.rascunho.v1`. Ele pertence ao navegador e à origem em que foi criado. Para preservar projetos antigos, dê valores padrão a novos campos e revise a função `validDraft` antes de mudar o formato.

## Do rascunho ao mod

O exemplo abaixo usa uma das lutas do catálogo com a formação original. Na interface, cada luta editada contém também `waves`, uma lista de ondas. Cada onda é uma lista de grupos com `id`, `count` e `level`.

~~~js
const projeto = {
  name: "Teste da Oficina",
  packId: 600000,
  skinId: "1001",
  rateUp: 2,
  fights: [{ templateId: 2011001 }]
};
const arquivos = LetheExport.buildFiles(projeto);
~~~

`buildFiles` devolve caminhos relativos associados a textos JSON ou bytes PNG. A interface acrescenta a pasta externa `oficina-<packId>/` antes de chamar `packZip`. O mapa tem de 1 a 98 lutas, uma loja antes da última e até 12 inimigos por onda. A última luta ocupa o nó final.

O rate up cria 1, 2 ou 4 IDs de tema elegíveis nos andares marcados na aba Andares. Todos apontam para os mesmos registros de batalha. Duas entradas podem aparecer no mesmo sorteio. A capa enviada pelo usuário é convertida em PNG pelo navegador e exportada em `custom_sprites/themePack_<id>.png` para cada entrada.

## Teste de entrega

1. Monte duas lutas diferentes, troque um inimigo e inverta a ordem. Escolha outra aparência, envie uma imagem e selecione quatro entradas. Recarregue a página e confira o rascunho.
2. Exporte o ZIP pelo editor. Confira quatro IDs distintos no JSON de `mirrordungeon-theme-floor`, dois registros em `battle-mirrordungeon` e quatro capas em `custom_sprites`. Os nós de combate devem apontar para os dois registros na ordem escolhida.
3. Volte à capa do pacote, selecione uma entrada e exporte novamente. Confira um único tema e a ausência de PNG personalizado.
4. Para validar no jogo, extraia **o ZIP gerado pelo editor** em `BepInEx/plugins/Lethe/mods/`. Se estiver substituindo uma versão, mova a pasta anterior para fora de mods antes de extrair. Recarregue os mods com 8 e procure o pacote no primeiro andar. Confira a capa, a ordem, os grupos e o encerramento da luta final.

Na entrega atual, a edição, a persistência e o download foram exercitados no Chrome, e a estrutura do ZIP foi conferida. A execução do pacote no jogo continua pendente.

## Se o usuário pedir o criador de lutas

A aba de lutas personalizadas foi discutida como ideia futura. Um primeiro passo seria salvar e reutilizar uma formação editada em mais de um pacote. Para o exemplo “Ricardo com acompanhantes do Index”, identifique a luta original, as fases e os gatilhos que dependem dos acompanhantes. Teste a troca isoladamente no Lethe antes de generalizá-la. Modificadores que disparam ações durante o combate exigem verificar quais campos ou scripts o jogo realmente suporta.

## Publicação e referências

O site roda no **GitHub Pages** a partir do repositório `BESTOOGA/oficina-lethe`: o workflow `.github/workflows/pages.yml` publica a pasta `dist/` a cada push na branch `main`. O endereço é https://bestooga.github.io/oficina-lethe/. Antes de enviar mudanças, regenere `Oficina Lethe.html` com `tools/gerar_offline.py`, que também vai no repositório para quem quiser usar offline.

- [Dados usados do OpenLethe, na revisão de referência](https://github.com/LEAGUE-OF-NINE/OpenLethe/tree/8f24cba5721482c85a7ab22ba2d2105914d175ac/src/OpenLethe.Resources)
- [Seleção dos temas e geração do mapa](https://github.com/LEAGUE-OF-NINE/OpenLethe/blob/8f24cba5721482c85a7ab22ba2d2105914d175ac/src/OpenLethe.Server/MdMapGen.cs)
- [Capas personalizadas no Lethe](https://docs.lethelc.site/guide/Asset)
- [Instalação de mods](https://docs.lethelc.site/install/AddMod)
