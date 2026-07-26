# Wizard Arena

Arena PvP com Phaser 3 + Socket.io.

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3080](http://localhost:3080).

### Acesso remoto (ngrok)

Requer o [ngrok](https://ngrok.com/) instalado e autenticado (`ngrok config add-authtoken SEU_TOKEN`).

```bash
# sobe o jogo + túnel juntos
npm run dev:remote
```

Ou, com o servidor já rodando em outra aba:

```bash
npm run tunnel
```

Use a URL `https://....ngrok-free.app` que o ngrok imprimir no terminal. Socket.io usa a mesma origem, então o PvP funciona pelo link.

Para testar sozinho: entre no lobby e clique em **+ Bot**.  
Para PvP real: abra duas abas/navegadores, entre com nomes diferentes e dê Ready.

## Controles

| Tecla | Ação |
|-------|------|
| WASD | Mover |
| Mouse | Mirar |
| 1–4 / Tab | Destacar magia (todas autocastam fora de CD) |
| E / H | Escudo / Heal (autocast fora de CD) |
| B | Blink |

## Regras

- Lobby: nome → entrar → Ready. Quando todos estão ready (mín. 2), a partida começa.
- Partida: **MAX_ROUNDS** rounds de **ROUND_DURATION** segundos cada (via `.env`). Sem único sobrevivente a tempo, o round termina.
- Arena circular encolhe a cada **ARENA_SHRINK_INTERVAL** s, **ARENA_SHRINK_TIMES** vezes por round; fora dela: dano por segundo.
- Monstros spawnam e atacam o jogador mais próximo.
- 100 HP. Começa no nível 1 com Firebolt.
- Ao subir de nível: escolha 1 de 3 magias (rogue-like). Máx. 4 magias.
- Uma das 3 opções pode ser upgrade de magia já escolhida.
- Nível 4+: pode aparecer um **ultimate** (autocast; cooldown via `PLAYER_ULTIMATE_COOLDOWN`).
- **Equipamento:** na tela Personagem → Inventário. Itens possuem de 1 a 3 bônus aleatórios, gerados deterministicamente por slot e tier.
- XP: matar monstro / matar jogador (maior) / sobreviver ao round (menor que kill de jogador).

## Equipamentos

8 slots disponíveis: Chapéu, Colar, Anel, Túnica, Capa, Botas, Cajado, Grimório.

Cada slot possui um conjunto fixo de modificadores possíveis:

| Slot | Modificadores disponíveis |
|------|--------------------------|
| Chapéu | Dano mágico, Experiência, Alcance das magias |
| Capa | Velocidade, Alcance das magias, Resistência a lentidão |
| Anel | Dano mágico, Raio das magias, Recarga das magias |
| Túnica | Vida máxima, Força do escudo, Resistência a veneno, Resistência a queimadura |
| Colar | Cura, Força do escudo, Recarga das magias |
| Botas | Velocidade, Resistência a lentidão, Vida máxima |
| Cajado | Dano mágico, Projéteis múltiplos, Alcance das magias, Recarga das magias, Velocidade |
| Grimório | Dano mágico, Cura, Força do escudo, Recarga das magias, Raio das magias, Alcance das magias |

### Modificadores

| Modificador | Efeito | Valor máx. |
|-------------|--------|------------|
| Dano mágico | Aumenta o dano causado | 75% |
| Cura | Aumenta a cura recebida | 75% |
| Força do escudo | Aumenta a força da barreira | 75% |
| Recarga das magias | Reduz o cooldown das magias | 95% |
| Velocidade | Aumenta a velocidade de movimento | 50% |
| Alcance das magias | Aumenta o alcance dos projéteis | 50% |
| Raio das magias | Aumenta o raio das áreas de efeito | 50% |
| Vida máxima | Aumenta o HP máximo | 60% |
| Experiência | Aumenta o XP ganho | 50% |
| Resistência a lentidão | Reduz o efeito de slow | 80% |
| Resistência a veneno | Reduz o dano de veneno | 80% |
| Resistência a queimadura | Reduz o dano de queimadura | 80% |
| Projéteis múltiplos | Dispara projéteis extras (2–5) | 5 |

### Tiers

São 21 tiers de raridade, com nível mínimo para equipar. Um tier novo é liberado a cada 3 níveis, do 1 ao 60:

| Tier | Nível | Material | Cor |
|------|-------|----------|-----|
| 1 | 1 | Pano | Bege |
| 2 | 3 | Couro | Marrom |
| 3 | 6 | Osso | Marfim |
| 4 | 9 | Bronze | Cobre |
| 5 | 12 | Latão | Dourado escuro |
| 6 | 15 | Ferro | Cinza |
| 7 | 18 | Aço | Azulado |
| 8 | 21 | Prata | Prateado |
| 9 | 24 | Ônix | Preto |
| 10 | 27 | Ouro | Dourado |
| 11 | 30 | Jade | Verde |
| 12 | 33 | Esmeralda | Verde vivo |
| 13 | 36 | Rubi | Vermelho |
| 14 | 39 | Cristal | Verde-água |
| 15 | 42 | Safira | Azul |
| 16 | 45 | Mitril | Ciano |
| 17 | 48 | Adamante | Roxo-azulado |
| 18 | 51 | Obsidiana | Preto-arroxeado |
| 19 | 54 | Platina | Branco prateado |
| 20 | 57 | Éter | Azul claro |
| 21 | 60 | Divino | Amarelo |
- XP: matar monstro / matar jogador (maior) / sobreviver ao round (menor que kill de jogador).
