import { useMemo, useRef, useState } from 'react';

type RowState = {
  takerIndex: number | null;
  takerScore: string;
  editingPlayerIndex: number | null;
  draftScore: string;
};

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;
const MIN_GAMES = 3;
const MAX_GAMES = 10;
const DEFAULT_PLAYER_NAMES = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'];
const PLAYER_SETUP_OPTIONS = ['3x3', '3x2', '4', '5', '6'] as const;
type PlayerSetup = (typeof PLAYER_SETUP_OPTIONS)[number];

function getPlayerSetupConfig(playerSetup: PlayerSetup) {
  if (playerSetup === '3x3') {
    return { playerCount: 3, divider: 3 };
  }

  if (playerSetup === '3x2') {
    return { playerCount: 3, divider: 2 };
  }

  return { playerCount: Number(playerSetup), divider: 3 };
}

function createEmptyRow(): RowState {
  return {
    takerIndex: null,
    takerScore: '',
    editingPlayerIndex: null,
    draftScore: ''
  };
}

function parseScore(rawValue: string) {
  if (rawValue.trim() === '') {
    return null;
  }

  const score = Number(rawValue);
  return Number.isInteger(score) ? score : null;
}

function formatScore(value: number) {
  return `${value}`;
}

function getGrayPlayers(rowIndex: number, playerCount: number) {
  if (playerCount === 5) {
    return [rowIndex % playerCount];
  }

  if (playerCount === 6) {
    return [rowIndex % playerCount, (rowIndex + 1) % playerCount];
  }

  return [];
}

function isGrayPlayer(rowIndex: number, playerCount: number, playerIndex: number) {
  return getGrayPlayers(rowIndex, playerCount).includes(playerIndex);
}

function getFirstEditableCell(playerSetup: PlayerSetup) {
  const { playerCount } = getPlayerSetupConfig(playerSetup);

  for (let playerIndex = 0; playerIndex < playerCount; playerIndex += 1) {
    if (!isGrayPlayer(0, playerCount, playerIndex)) {
      return { rowIndex: 0, playerIndex };
    }
  }

  return { rowIndex: 0, playerIndex: 0 };
}

export default function App() {
  const [playerSetup, setPlayerSetup] = useState<PlayerSetup>('4');
  const [gameCount, setGameCount] = useState(6);
  const [playerNames, setPlayerNames] = useState(DEFAULT_PLAYER_NAMES);
  const [rows, setRows] = useState<RowState[]>(() => Array.from({ length: MAX_GAMES }, () => createEmptyRow()));
  const [pendingPlayerSetup, setPendingPlayerSetup] = useState<PlayerSetup | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const inputRefs = useRef<Array<Array<HTMLInputElement | null>>>([]);

  const { playerCount, divider } = getPlayerSetupConfig(playerSetup);
  const visiblePlayers = useMemo(() => Array.from({ length: playerCount }, (_, index) => index), [playerCount]);
  const visibleRows = rows.slice(0, gameCount);

  const updateRow = (rowIndex: number, updater: (row: RowState) => RowState) => {
    setRows((currentRows) => currentRows.map((row, index) => (index === rowIndex ? updater(row) : row)));
  };

  const startEditingCell = (rowIndex: number, playerIndex: number) => {
    if (isGrayPlayer(rowIndex, playerCount, playerIndex)) {
      return;
    }

    updateRow(rowIndex, (row) => ({
      ...row,
      editingPlayerIndex: playerIndex,
      takerIndex: playerIndex,
      draftScore: row.takerIndex === null ? '' : row.takerScore
    }));
  };

  const updateDraftScore = (rowIndex: number, value: string) => {
    updateRow(rowIndex, (row) => ({
      ...row,
      draftScore: value
    }));
  };

  const commitCellScore = (rowIndex: number, playerIndex: number, rawValue: string, inputElement: HTMLInputElement) => {
    if (isGrayPlayer(rowIndex, playerCount, playerIndex)) {
      return;
    }

    const score = parseScore(rawValue);

    if (rawValue.trim() === '' || score === 0) {
      inputElement.setCustomValidity('');
      updateRow(rowIndex, () => ({
        takerIndex: rawValue.trim() === '' ? null : playerIndex,
        takerScore: rawValue.trim() === '' ? '' : '0',
        editingPlayerIndex: null,
        draftScore: ''
      }));
      return;
    }

    if (score === null || score % divider !== 0) {
      inputElement.setCustomValidity(`Le score doit être un multiple de ${divider}.`);
      inputElement.reportValidity();
      requestAnimationFrame(() => inputElement.focus());
      updateRow(rowIndex, (row) => ({
        ...row,
        editingPlayerIndex: playerIndex,
        draftScore: rawValue
      }));
      return;
    }

    inputElement.setCustomValidity('');
    updateRow(rowIndex, () => ({
      takerIndex: playerIndex,
      takerScore: rawValue,
      editingPlayerIndex: null,
      draftScore: ''
    }));
  };

  const applyPlayerSetup = (nextPlayerSetup: PlayerSetup, keepScores: boolean) => {
    const { playerCount: nextPlayerCount } = getPlayerSetupConfig(nextPlayerSetup);

    setPendingPlayerSetup(null);

    if (!keepScores) {
      resetBoard(nextPlayerSetup, true);
      return;
    }

    setPlayerSetup(nextPlayerSetup);

    setPlayerNames((currentNames) => currentNames.map((name, index) => (index < nextPlayerCount ? name : DEFAULT_PLAYER_NAMES[index])));
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) => {
        const grayPlayers = getGrayPlayers(rowIndex, nextPlayerCount);

        if (row.takerIndex === null || (row.takerIndex < nextPlayerCount && !grayPlayers.includes(row.takerIndex))) {
          return row;
        }

        return {
          takerIndex: null,
          takerScore: '',
          editingPlayerIndex: null,
          draftScore: ''
        };
      })
    );
  };

  const openPlayerSetupDialog = (nextPlayerSetup: PlayerSetup) => {
    if (nextPlayerSetup === playerSetup) {
      return;
    }

    setPendingPlayerSetup(nextPlayerSetup);
  };

  const resetBoard = (targetPlayerSetup: PlayerSetup, skipConfirm = false) => {
    const shouldClear = skipConfirm;

    if (!shouldClear) {
      return;
    }

    setPendingReset(false);
    setPlayerSetup(targetPlayerSetup);
    setGameCount(6);
    setPlayerNames(DEFAULT_PLAYER_NAMES);
    setRows(Array.from({ length: MAX_GAMES }, () => createEmptyRow()));

    const firstEditableCell = getFirstEditableCell(targetPlayerSetup);
    requestAnimationFrame(() => {
      inputRefs.current[firstEditableCell.rowIndex]?.[firstEditableCell.playerIndex]?.focus();
    });
  };

  const clearAll = () => {
    setPendingReset(true);
  };

  const totals = useMemo(() => {
    return visiblePlayers.map((playerIndex) => {
      let total = 0;

      visibleRows.forEach((row, rowIndex) => {
        const grayPlayers = getGrayPlayers(rowIndex, playerCount);

        if (grayPlayers.includes(playerIndex)) {
          return;
        }

        if (row.takerIndex === null) {
          return;
        }

        const score = parseScore(row.takerScore);
        if (score === null || score % divider !== 0) {
          return;
        }

        const share = score / divider;

        if (playerIndex === row.takerIndex) {
          total += score;
        } else {
          total -= share;
        }
      });

      return total;
    });
  }, [divider, playerCount, visiblePlayers, visibleRows]);

  return (
    <main className="app-shell">
      <section className="hero-card">
        <h1>Feuille de marque autonome</h1>

        <div className="controls">
          <label>
            <span>Joueurs</span>
            <select value={playerSetup} onChange={(event) => openPlayerSetupDialog(event.target.value as PlayerSetup)}>
              {PLAYER_SETUP_OPTIONS.map((setup) => {
                if (setup === '3x3') {
                  return (
                    <option key={setup} value={setup}>
                      3 joueurs X3 (D=-P/3)
                    </option>
                  );
                }

                if (setup === '3x2') {
                  return (
                    <option key={setup} value={setup}>
                      3 joueurs X2 (D=-P/2)
                    </option>
                  );
                }

                return (
                  <option key={setup} value={setup}>
                    {setup} joueurs
                  </option>
                );
              })}
            </select>
          </label>

          <label>
            <span>Parties</span>
            <select value={gameCount} onChange={(event) => setGameCount(Number(event.target.value))}>
              {Array.from({ length: MAX_GAMES - MIN_GAMES + 1 }, (_, index) => MIN_GAMES + index).map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </label>

          <button className="reset-button" type="button" onClick={clearAll} aria-label="Tout effacer">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3 6h18" />
              <path d="M8 6V4.75A1.75 1.75 0 0 1 9.75 3h4.5A1.75 1.75 0 0 1 16 4.75V6" />
              <path d="M6.5 6.5l.85 11.15A2 2 0 0 0 9.34 19.5h5.32a2 2 0 0 0 1.99-1.85l.85-11.15" />
              <path d="M10 10v5M14 10v5" />
            </svg>
          </button>
        </div>
      </section>

      {pendingPlayerSetup ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setPendingPlayerSetup(null)}>
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="player-setup-dialog-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="player-setup-dialog-title">Changer le nombre de joueurs ?</h2>
            <p>Que veux-tu faire avec les scores en cours ?</p>

            <div className="dialog-actions">
              <button type="button" className="dialog-secondary" onClick={() => setPendingPlayerSetup(null)}>
                Annuler
              </button>
              <button type="button" className="dialog-primary" onClick={() => applyPlayerSetup(pendingPlayerSetup, true)}>
                Conserver les scores
              </button>
              <button type="button" className="dialog-danger" onClick={() => applyPlayerSetup(pendingPlayerSetup, false)}>
                Tout effacer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingReset ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setPendingReset(false)}>
          <div className="dialog-card" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="reset-dialog-title">Tout effacer ?</h2>
            <p>Cette action supprimera les scores et les noms saisis.</p>

            <div className="dialog-actions">
              <button type="button" className="dialog-secondary" onClick={() => setPendingReset(false)}>
                Annuler
              </button>
              <button type="button" className="dialog-danger" onClick={() => {
                setPendingReset(false);
                resetBoard('4', true);
              }}>
                Tout effacer
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <section className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="sticky-left part-header">N°</th>
                {visiblePlayers.map((playerIndex) => (
                  <th key={`header-${playerIndex}`}>
                    <input
                      aria-label={`Nom du joueur ${playerIndex + 1}`}
                      value={playerNames[playerIndex]}
                      placeholder={`J${playerIndex + 1}`}
                      onChange={(event) =>
                        setPlayerNames((currentNames) =>
                          currentNames.map((name, index) => (index === playerIndex ? event.target.value : name))
                        )
                      }
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {visibleRows.map((row, rowIndex) => {
                const score = parseScore(row.takerScore);
                const grayPlayers = getGrayPlayers(rowIndex, playerCount);
                const canCalculate = row.takerIndex !== null && score !== null && score % divider === 0;
                const share = canCalculate ? score / divider : null;

                return (
                  <tr key={rowIndex}>
                    <td className="sticky-left part-number">{rowIndex + 1}</td>

                    {visiblePlayers.map((playerIndex) => {
                      const isEditing = row.editingPlayerIndex === playerIndex;
                      const isTaker = row.takerIndex === playerIndex;
                      const isGray = grayPlayers.includes(playerIndex);
                      const displayValue = isEditing
                        ? row.draftScore
                        : isGray
                          ? ''
                          : row.takerIndex === null
                            ? ''
                            : isTaker
                              ? row.takerScore
                              : canCalculate && share !== null
                                ? formatScore(-share)
                                : '';
                      const isNegativeScore = !isEditing && !isGray && displayValue.trim().startsWith('-');

                      return (
                        <td key={`${rowIndex}-${playerIndex}`} className={isGray ? 'gray' : canCalculate ? (isTaker ? 'taker' : 'defender') : 'ghost'}>
                          <input
                            ref={(element) => {
                              inputRefs.current[rowIndex] = inputRefs.current[rowIndex] ?? [];
                              inputRefs.current[rowIndex][playerIndex] = element;
                            }}
                            aria-label={`Score de J${playerIndex + 1} pour la partie ${rowIndex + 1}`}
                            inputMode="numeric"
                            type="text"
                            value={displayValue}
                            className={isNegativeScore ? 'score-negative' : undefined}
                            readOnly={isGray}
                            onFocus={() => startEditingCell(rowIndex, playerIndex)}
                            onChange={(event) => updateDraftScore(rowIndex, event.target.value)}
                            onBlur={(event) => commitCellScore(rowIndex, playerIndex, event.target.value, event.currentTarget)}
                            placeholder={isGray ? '' : '0'}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr>
                <th className="sticky-left">Total</th>
                {totals.map((total, playerIndex) => (
                  <th key={`total-${playerIndex}`}>{formatScore(total)}</th>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </main>
  );
}