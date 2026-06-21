import type { OcgResourceProvider, OcgRuntime, PrimeRequest } from './types';

/** Hard cap on process iterations before we give up reaching Main Phase 1. */
const PROCESS_GUARD = 4000;
const SYSTEM_SCRIPTS = ['constant.lua', 'utility.lua'] as const;

/**
 * Enumerate which of `req.candidateCodes` are Special-Summonable from the board
 * `req.materialCodes` — by building a single-player duel, advancing to Main Phase 1,
 * and reading `MSG_SELECT_IDLECMD.special_summons` (the engine only offers a monster
 * there once its materials are validated, so this is a single pass — see the engine
 * README's Stage-0 finding). Pure: all IO goes through the injected provider.
 */
export function enumerateSummonable(
  runtime: OcgRuntime,
  provider: OcgResourceProvider,
  req: PrimeRequest,
): Set<number> {
  const { core, constants: C } = runtime;
  const handle = core.createDuel({
    flags: C.modeMR5,
    seed: [1n, 2n, 3n, 4n],
    team1: { startingLP: 8000, startingDrawCount: 0, drawCountPerTurn: 0 },
    team2: { startingLP: 8000, startingDrawCount: 0, drawCountPerTurn: 0 },
    cardReader: (code) => provider.readCard(code),
    scriptReader: (name) => provider.readScript(name),
  });
  if (!handle) throw new Error('ocgcore: createDuel returned null');

  try {
    // utility.lua defines GetID/Auxiliary and Duel.LoadScript()s the proc_*.lua
    // (served on demand by the scriptReader); without these, card effects error.
    for (const sys of SYSTEM_SCRIPTS) {
      const content = provider.readScript(sys);
      if (content == null) throw new Error(`ocgcore: missing system script ${sys}`);
      core.loadScript(handle, sys, content);
    }

    req.materialCodes.forEach((code, sequence) =>
      core.duelNewCard(handle, {
        team: 0, duelist: 0, code, controller: 0,
        location: C.locMzone, sequence, position: C.posFaceupAttack,
      }),
    );
    req.candidateCodes.forEach((code, sequence) =>
      core.duelNewCard(handle, {
        team: 0, duelist: 0, code, controller: 0,
        location: C.locExtra, sequence, position: C.posFacedownDefense,
      }),
    );

    core.startDuel(handle);

    const summonable = new Set<number>();
    for (let i = 0; i < PROCESS_GUARD; i++) {
      const status = core.duelProcess(handle);
      for (const msg of core.duelGetMessage(handle)) {
        if (msg.type === C.msgSelectIdlecmd) {
          for (const s of msg.special_summons ?? []) summonable.add(s.code);
          core.duelSetResponse(handle, {
            type: C.respSelectIdlecmd, action: C.actionToEp, index: null,
          });
          return summonable; // single pass — we have the answer
        }
      }
      if (status === C.procEnd) break;
      if (status === C.procWaiting) break; // unexpected prompt before MP1 idle
    }
    return summonable;
  } finally {
    core.destroyDuel(handle);
  }
}
