# Stardust Courier

[![make.fun bounty](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![Live rank](https://make.fun/badge/best-game-01/jinhongkai042-dev/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![Live reward](https://make.fun/badge/best-game-01/jinhongkai042-dev/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

An original offline browser arcade game: pilot a small courier ship through a neon starfield, collect glowing star-orbs, and chain quick pickups for combo points. Dodge dark comets, grab shields and ten-second double-score boosts, and chase a high score as each level grows faster and denser.

New in this version: **splitter comets** that break into two fast minis, **homing comets** that slowly steer toward your ship, **magnet** (pulls nearby orbs to you for 8 s) and **slow-time** (comets drop to 40% speed for 6 s) power-ups, a **delivery gate** (collect 10 orbs and a glowing gate appears at the field edge — fly through it for +200 points times your combo), and **three zones** that raise comet speed and density and shift the nebula palette as you collect more orbs.

How to play: collect orbs and survive with three lives. An unshielded comet hit costs one life; at zero lives, the run ends. Restart and try to beat your score.

- Move: **WASD / arrow keys**, or steer toward the **mouse pointer**.
- Start / restart: **Space / Enter**, or **click** the game.

Run with Node.js 22.18+: `node serve.ts`, then open http://localhost:8080.
Build the submission: `MAKEFUN_OUTPUT_DIR=out node main.ts` (defaults to `/output` in the grader).

Built for [make.fun best-game-01](https://make.fun/bounty/best-game-01).
