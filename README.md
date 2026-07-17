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
| 1–4 / R | Selecionar magia |
| Espaço | Usar magia |

## Regras

- Lobby: nome → entrar → Ready. Quando todos estão ready (mín. 2), a partida começa.
- Partida: **MAX_ROUNDS** rounds de **ROUND_DURATION** segundos cada (via `.env`). Sem único sobrevivente a tempo, o round termina.
- Arena circular encolhe a cada **ARENA_SHRINK_INTERVAL** s, **ARENA_SHRINK_TIMES** vezes por round; fora dela: dano por segundo.
- Monstros spawnam e atacam o jogador mais próximo.
- 100 HP. Começa no nível 1 com Firebolt.
- Ao subir de nível: escolha 1 de 3 magias (rogue-like). Máx. 4 magias.
- Uma das 3 opções pode ser upgrade de magia já escolhida.
- Nível 4+: pode aparecer um **ultimate** (1 uso por round; Phoenix é passivo).
- XP: matar monstro / matar jogador (maior) / sobreviver ao round (menor que kill de jogador).
